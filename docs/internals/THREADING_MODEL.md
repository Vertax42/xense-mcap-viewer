# Threading Model — Workers, Transports, and Shared Memory

> Code under `src/infra/workers/` and `src/infra/workers/transports/`.

Xense MCAP Viewer runs **two kinds of JS contexts**: the main thread (React + DOM + WebGL) and one **format worker per loaded dataset** (parse + decode + queue). A third kind, the **Image render worker**, decodes H.264 via WebCodecs into an OffscreenCanvas.

There is no worker pool. Switching files spawns a fresh worker; closing terminates it.

---

## 1. Who Runs Where

| Thread | Responsibilities | Owns |
|---|---|---|
| **Main** | React tree, IterablePlayer state machine, RAF tick, DockView, WebGL, uPlot, cytoscape, DOM | `IterablePlayer`, `MessageBus`, Zustand store, all panel React trees |
| **Format Worker** (one per dataset) | File I/O (Range/Blob), index reading, chunk decompression, message deserialization, batching | `IIterableSource`, `MessageCursor` queue, `SharedPayloadRing` (writer side), `CachedFilelike` |
| **Image render worker** (one per Image panel) | WebCodecs `VideoDecoder` for H.264, OffscreenCanvas blit | Decoder state, 10-key-chunk ring for re-init on seek-back |

3D point cloud decoding stays on main (no separate worker) but reuses the SAB-backed buffers from the format worker. Worker count is intentionally bounded so the OS scheduler stays predictable.

## 2. Transports — Three Tiers

Defined in `src/infra/workers/transports/`. Selected by `detectTransport.ts:19–42`:

```ts
if (hasSAB && hasAtomics && crossOriginIsolated) return { mode: 'sab' }
if (!crossOriginIsolated) return { mode: 'transfer', fallbackReason: ... }
return { mode: 'comlink' }  // last resort
```

### 2.1 SabTransport (preferred)

`SabTransport.ts`. Requires COOP `same-origin` + COEP `credentialless` (already set in `vite.config.ts`).

- Threshold: payloads ≥ 64 KiB go through the `SharedPayloadRing`.
- Below threshold: ride along in the Comlink message envelope (no transfer).
- Ring is 64 slots × 4 MiB = 256 MiB. Single producer (format worker), single reader (main).

### 2.2 TransferTransport (portable)

`TransferTransport.ts`. Uses `Comlink.transfer(arg, [transferList])` to give the main thread ownership of the underlying `ArrayBuffer`. No shared memory — each chunk is moved exactly once.

- Threshold: same 64 KiB.
- `collectTransferables()` (`transferables.ts`) recursively walks message graphs to extract all `ArrayBuffer` and `ArrayBuffer.isView()` instances for the transfer list.

### 2.3 ComlinkTransport (last resort)

`ComlinkTransport.ts`. Threshold = `Number.MAX_SAFE_INTEGER` (i.e., never moves to a fast path — every payload goes through structured clone). Used when neither SAB nor Transfer is viable.

## 3. SharedArrayBuffer Ring

`src/infra/workers/sharedPayloadRing.ts` (95 lines, read it).

```
SharedArrayBuffer layout:
  ┌─────────────────────────────────┐
  │ Int32Array control [4 ints]:    │
  │   [0] IDX_WRITE_SEQ             │   ← Atomics.store / notify
  │   [1] IDX_SLOT_COUNT (e.g., 64) │
  │   [2] IDX_SLOT_SIZE  (e.g., 4MB)│
  │   [3] IDX_DROPPED               │   ← incremented on oversize/full
  ├─────────────────────────────────┤
  │ Uint8Array data:                │
  │   slot 0 (4 MiB)                │
  │   slot 1                        │
  │   ...                           │
  │   slot N-1                      │
  └─────────────────────────────────┘
```

### Write (worker)

```ts
write(payload: Uint8Array): SharedPayloadRef | null {
  if (payload.byteLength > slotSize) { Atomics.add(control, IDX_DROPPED, 1); return null }
  const seq = Atomics.load(control, IDX_WRITE_SEQ)
  const slot = seq % slotCount
  data.set(payload, slot * slotSize)
  Atomics.store(control, IDX_WRITE_SEQ, seq + 1)
  Atomics.notify(control, IDX_WRITE_SEQ)
  return { __xenseSharedPayloadRef: true, seq, slot, length: payload.byteLength }
}
```

### Read (main)

```ts
isLive(ref): boolean {
  const cur = Atomics.load(control, IDX_WRITE_SEQ)
  return cur > ref.seq && cur - ref.seq <= slotCount
}
view(ref): Uint8Array | null { return isLive ? Uint8Array(buf, slot*slotSize, length) : null }
read(ref): Uint8Array | null { return isLive ? copy of view : null }
```

The ring is **lock-free, single-producer, single-reader**. `Atomics.notify` is currently unused (no main-side `Atomics.wait`) — the producer never blocks; if the reader is slow, refs become stale (`current_seq - ref.seq > slotCount`) and the main thread silently drops them, incrementing a `stalePayloadRefs` counter for diagnostics.

### When `view` vs `read`

- **High-frequency `latest` mode** (`onLatestMessage`): zero-copy `view()` — the consumer must consume *this tick* (it's overwritten on subsequent producer cycles).
- **Normal subscriber or stored event**: `read()` — copies to a stable buffer because `MessageBus` retains the event reference across ticks.

`WorkerSerializedSource` (`resolveMessageBatch`, `resolveMessageForHighFrequencyLane`, lines 167–211) makes this choice per dispatch lane.

## 4. MessageCursor — The Worker Pump

`src/infra/workers/MessageCursor.ts` (327 lines).

```ts
class MessageCursor {
  static DEFAULT_MAX_BATCH_MESSAGES = 256
  static DEFAULT_MAX_BATCH_WALL_MS  = 6        // wall-clock cap
  static DEFAULT_MAX_BUFFER_MESSAGES = 2048
  static DEFAULT_MAX_BUFFER_BYTES    = 128 * 1024 * 1024

  // Background pump consumes source.messageIterator() into _queue
  // _queue.length ≥ 2048 or _queueBytes ≥ 128 MiB → await _waitForCapacity()

  async nextBatch(durationMs: number): Promise<MessageEvent[]> {
    while (Date.now() - start < maxWallTimeMs) {
      const msg = this._dequeue()
      if (!msg) break
      result.push(msg)
      if (result.length >= maxMessages) break
      if (toNano(msg.receiveTime) > dataEndNano) break  // duration window exceeded
    }
    return result
  }
}
```

Cutoffs (first-wins): 6 ms wall, 256 messages, or message receive-time crosses the `startTime + durationMs` window.

**SAB encoding inside the pump** (lines 248–284): when a message's binary field (`data` for `sensor_msgs/Image`, `points` for `PointCloud2`, etc.) ≥ 64 KiB, write to ring, replace with `SharedPayloadRef`, tag event with `payloadKind: 'hybrid-sab'` and `sizeInBytes` (original length, before the field was replaced).

## 5. Worker Boot

All five workers follow the same shape (`mcap.worker.ts` as reference):

```ts
import * as Comlink from 'comlink'
import { McapIndexedIterableSource } from '@/infra/sources/McapIndexedIterableSource'
import { MessageCursor } from '@/infra/workers/MessageCursor'

class McapWorkerImpl {
  private source!: IIterableSource
  async initialize(args) {
    if (args.url) {
      const reader = new HttpFileReader(args.url)
      this.source = new McapIndexedIterableSource({ readable: new CachedFilelike({ reader, cacheSizeInBytes }) })
    } else {
      this.source = new McapIndexedIterableSource({ readable: new BlobReadable(args.file) })
    }
    const init = await this.source.initialize()
    if (args.autoDataQualityScan && shouldAutoScan(init.totalMessageCount))
      this.qualityController = new DataQualityScanController(...)
    return init
  }
  async getMessageCursor(args) {
    const cursor = new MessageCursor({ source: this.source, ...args })
    return Comlink.proxy(cursor)
  }
  async getBackfillMessages(args) { return this.source.getBackfillMessages(args) }
  async terminate() { /* abort, cleanup */ }
}

Comlink.expose(new McapWorkerImpl())
```

Worker entries are referenced via `new Worker(new URL('./mcap.worker.ts', import.meta.url), { type: 'module' })` from `WorkerSerializedSource`'s factory.

## 6. Main-side wrapper — `WorkerSerializedSource`

`src/infra/workers/WorkerSerializedSource.ts` (293 lines).

Responsibilities:
1. Wrap the raw `Worker` with `Comlink.wrap<IWorkerSerializedSourceWorker>()`.
2. Negotiate transport: call `transport.configure(remote)` so the worker knows whether to use the SAB ring.
3. Hold the **reader** side of `SharedPayloadRing` (same `SharedArrayBuffer` instance — passed in `transport.configure`).
4. Resolve incoming `SharedPayloadRef` instances into `Uint8Array`s (view or copy).
5. Surface a clean `IIterableSource`-compatible API to the player (with a `terminate()` extension that posts a worker termination message).

Crash monitoring: `initialize()` races a 30 s timeout. If the worker crashes mid-RPC, the wrapper rejects with a recoverable error so the UI can fall back to single-file diagnostics.

## 7. Comlink Proxy Lifecycle

- `Comlink.wrap(worker)` creates the main-side proxy.
- `worker.getMessageCursor(args)` returns a **proxied cursor object** — every method call is an RPC.
- The cursor is short-lived; replaced on every subscription / seek / loop event.
- `Comlink.releaseProxy()` should be called when discarding, but in practice `worker.terminate()` discards the whole worker, releasing all proxies.

Memory cost: a Comlink proxy retains a small `MessagePort` channel; not a leak but counts toward total `MessagePort` quota in some browsers.

## 8. Image render worker

`src/features/panels/Image/image-core/ImageRender.worker.ts` (one per Image panel).

- Constructed as `?worker&inline` so Vite bundles the worker as a data URL — no separate file emission needed.
- `canvas.transferControlToOffscreen()` is called once on mount; the main thread loses canvas ownership.
- `VideoDecoder` (WebCodecs) is configured per stream; H.264 NAL units detected via `h264.ts:getH264ChunkType()`.
- Maintains `#lastKeyChunks` ring (max 10) so seek-back can re-init the decoder from the most recent SPS/PPS + IDR.
- Communicates back to main via `postMessage({ type: 'status', status })` (NOT Comlink — just raw messages).

No SharedArrayBuffer involvement here; frames are copied directly to OffscreenCanvas which then composites via WebGL.

## 9. Quality scan as a side-channel job

`src/infra/workers/dataQualityScanController.ts` runs **inside** the format worker (not a separate worker). When auto-scan triggers (file ≤ 10 k messages or user-requested), it iterates the source on a side chain that does NOT block the main cursor. Progress reported via Comlink-proxied callbacks back to main. Final report includes incidents grouped by topic.

## 10. Concurrency Diagram

```
Main thread                      Format worker (one per dataset)
─────────────────────────────    ─────────────────────────────────────────
React tree                       Source.initialize() ─ once at boot
  IterablePlayer
    RAF tick (30 Hz):
      cursor.nextBatch(advanceMs) ────RPC───> MessageCursor.nextBatch()
                                                while wall<6ms, msg<256:
                                                  drain queue
                                                  (background pump fills queue
                                                   from source.messageIterator()
                                                   with backpressure at 2048/128MiB)
      ◀────────msgs (transferable / SAB refs)──── return MessageEvent[]
      _distributeMessages
      messageBus.update
        ↓
      panel listeners fire
        ↓
      panels imperatively pull events
      panels render (RAF-coalesced)

Image worker (per Image panel)
─────────────────────────────
  receive H.264 chunks via postMessage
  VideoDecoder.decode → OffscreenCanvas blit
```

## 11. Diagnostics

`workerPerf.ts` (`WorkerPerfCollector`) buckets timings by operation name and topic, flushing top-20 per-topic stats every 2 s. Hot instrumentation points:

- `cursor.iterator.next` — raw message production
- `cursor.sharedRing.write` — SAB ring write
- `cursor.nextBatch.total` — wall-time of batch collection

`source.iterator.deserialize.<topic>` per-message decode time, summarized per topic.

Surface via `workerPerf.getReport()` (proxy on the worker side) — accessible from devtools by exposing the worker temporarily.

## 12. Failure Modes

| Symptom | Likely cause |
|---|---|
| All payloads structured-cloned | Not cross-origin isolated → COOP/COEP missing on host (embed users hit this) |
| `stalePayloadRefs` ticking up | Main thread can't keep up with producer; tighten subscriptions or skip frames |
| `IDX_DROPPED` ticking up | Single message > 4 MiB slot size; increase `slotSizeBytes` or split message |
| Frozen panel on seek | `_isFetching` blocked on a slow batch; check format-worker thread for stalls |
| Worker crash, blank UI | Caught in `WorkerSerializedSource.initialize()` race; check console for trace |
