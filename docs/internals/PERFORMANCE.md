# Performance — Hot Paths, Knobs, and Bottlenecks

Treat this as the perf playbook. Most of the system is fast because of a small number of deliberate decisions. Don't undo them without understanding what they buy.

---

## 1. Performance Targets (claimed in docs/ARCHITECTURE.md)

- First frame of a 1 GB MCAP in **< 2 s** (local). Realistic in current code: ~1 s local, ~1.5 s remote.
- Main thread at **60 fps** without UI jank from data parsing.
- Memory bounded via LRU cache.

In practice the player tick runs at 30 Hz (`DEFAULT_SAMPLING_FPS`); the **60 fps target applies to the React/WebGL render thread**, not message dispatch.

## 2. The five design pillars

| # | Pillar | What it buys | Where |
|---|---|---|---|
| 1 | **All parsing in workers** | Main thread never sees raw bytes / deserialize cost | `infra/workers/*` |
| 2 | **SAB zero-copy for large payloads** | Image / point cloud frames don't pay structured-clone | `sharedPayloadRing.ts` + `MessageCursor.ts:248-284` |
| 3 | **MessageBus seq counters, not Zustand for messages** | Only affected panels re-render per tick | `messageBus.ts`, `useMessageBus.ts` |
| 4 | **High-frequency lane resolved BEFORE normal batch** | Video / 3D get latest frame even when batch is large | `IterablePlayer.ts:622-626` |
| 5 | **Ref-based currentTime channel** | Playback bar / 3D time cursor update DOM without React render | `subscribeCurrentTime` |

Don't undermine any of these.

## 3. Tuning knobs (constants you may want to change)

### 3.1 Sampling rate / tick cadence

`IterablePlayer.ts:18`: `DEFAULT_SAMPLING_FPS = 30`. Setter `setSamplingFps(fps)` clamps to [1, 45].

- Lower (e.g., 15) → fewer ticks/sec, larger batches per tick, lower CPU.
- Higher → smoother point cloud / video updates at the cost of more main-thread work.
- 45 is the hard ceiling; pushing above starves R3F's RAF time slice.

### 3.2 Batch window

`MessageCursor.ts:26-29`:
```
DEFAULT_MAX_BATCH_MESSAGES = 256
DEFAULT_MAX_BATCH_WALL_MS  = 6
DEFAULT_MAX_BUFFER_MESSAGES = 2048
DEFAULT_MAX_BUFFER_BYTES    = 128 MiB
```

- `MAX_BATCH_WALL_MS = 6 ms` — keep low. Raising it can starve panels of paint time when one batch dominates the tick.
- `MAX_BATCH_MESSAGES = 256` — cap on per-tick fan-out. If panels handle thousands of small messages and CPU is idle, increase. If you see frame drops, decrease.
- `MAX_BUFFER_*` — backpressure thresholds. Smaller → tighter memory budget but more pump stalls. Larger → smoother but unbounded peak memory.

### 3.3 SAB ring sizing

`sharedPayloadRing.ts` defaults: `slotCount: 64`, `slotSizeBytes: 4 MiB` → 256 MiB total.

- If `IDX_DROPPED` rises in workerPerf, you have a message larger than `slotSize`. Raise `slotSizeBytes` (and total ring size grows proportionally).
- If `stalePayloadRefs` rises, main thread can't drain fast enough. Either raise `slotCount` (more producer headroom) or fix the main-thread bottleneck.

### 3.4 HTTP block size

`CachedFilelike.ts:20`: `CACHE_BLOCK_SIZE = 50 MiB`.

- Lower (10 MiB) → faster first-frame for tiny seeks but more Range requests overall.
- Higher (200 MiB) → fewer requests but more wasted bytes on random scrubbing.

For sequential playback, 50 MiB is well-tuned. For analytical scrub-heavy workflows, consider 10–20 MiB.

### 3.5 Pipeline emit throttle

`IterablePlayer.ts:17`: `PIPELINE_EMIT_INTERVAL_MS = 200`. This is how often Zustand metadata state is pushed.

- 5 Hz is the floor for "responsive" presence/progress UI.
- Lowering to 50 ms increases Zustand subscriber re-renders ~4× — usually a regression.

### 3.6 Stale topic refresh

`IterablePlayer.ts:24`: `BACKFILL_STALE_THRESHOLD_NS = 1_000_000_000n` (1 s). Refresh tick every 500 ms.

- Latched/static topics (URDF, TF_static, robot_description) rely on this.
- Lowering the threshold to 200 ms increases backfill RPCs and re-deliveries; with the stale-message-receiveTime filter in place, it's mostly idle work.

### 3.7 Range query cache

`rangeQueryCache.ts`: 24 entries, 1.5 MB total. Bump these if your analysis panels do many overlapping queries.

### 3.8 Auto data-quality scan limit

`QUALITY_AUTO_SCAN_MAX_MESSAGES = 10_000`. Files above this skip auto-scan; users can trigger manually. Raise if your fleet captures medium-size files but wants drop detection on by default.

## 4. Hot paths (frame budget breakdown)

For a typical playback frame at 30 Hz (33 ms budget):

```
Worker (per nextBatch):
  cursor.iterator.next         ~ 2-10 ms   (deserialize-dominated)
  cursor.sharedRing.write      < 1 ms
  cursor.nextBatch.total       ~ 3-12 ms   (capped at 6 ms wall, but resolve of pending msg can overrun)

Main thread (per tick):
  Comlink RPC roundtrip        ~ 1-2 ms
  _distributeMessages          < 1 ms      (256 msgs to ~10 subscribers)
  messageBus.update + listeners < 1 ms
  Panel React re-renders       3-8 ms      (depends on panel mix)
  R3F frame (point cloud)      4-10 ms     (GPU upload)
  Browser paint                2-5 ms
─────────────────────────────────────────
Total                          ~ 15-25 ms  (room to spare)
```

Spikes typically come from:

- A single huge message (e.g., 100 MB point cloud) blocking decompression for 30+ ms.
- React re-rendering the full panel tree (forgotten memoization).
- DockView layout reflow on file switch.

## 5. Where memory grows

| Holder | Steady | Peak |
|---|---|---|
| `CachedFilelike` blocks | 200 MiB (Bag) / unbounded (MCAP default) | Same; bounded by config |
| SAB ring | 256 MiB always | 256 MiB |
| Format-worker per-message JS heap | ~ batch size × avg message | Spikes for large frames |
| `messageBus.lastMessageByTopic` | sum of one msg per topic | Held forever per topic |
| Panel-local buffers (uPlot rows, R3F geometry) | scales with subscribed topics × messages retained | Largest leak risk |
| Image VideoFrames | each ~few MB | Must `.close()` after blit |

Common leaks (verify before reporting work done):

1. Forgetting to `dispose()` THREE geometries on cleanup → R3F GC won't free GPU memory.
2. Pushing every message into a panel-local array without cap → unbounded growth on long playback.
3. Holding `MessageEvent.message` references across multiple ticks when the underlying SAB ring may have wrapped → silent corruption (caught by liveness check on next read, but stale data may have already been consumed).

## 6. Render boundaries

The React render tree is intentionally **flat at the panel level**: each `PanelRuntimeShell` is an isolation boundary. Things to keep flat:

- `usePanelConfig(panelId)` is per-panel via `useSyncExternalStore` on `panelConfigStore`.
- `useSubscriberSeq(panelId)` is per-panel.
- `useTopicSeq(topic)` is per-topic, used by panels watching specific topics directly.

Avoid `useContext` for high-frequency data — any context bump re-renders all consumers.

## 7. Coupling hotspots (modules to refactor with caution)

- **IterablePlayer** — knows about subscriptions, high-frequency consumers, source, cursor, messageBus, time-subscribers, presence emit. Changes here ripple everywhere.
- **WorkerSerializedSource** — couples transport selection, SAB resolution, and IIterableSource API. Splitting these is a future project.
- **DockviewLayout + auto-layout** — panel registry, foxglove adapters, restore semantics, tab groups; subtle interactions when adding panel types.
- **parseChannel.ts** — every new encoding adds a branch; consider a registry pattern when adding a 6th encoding.

## 8. Good extension points

These boundaries are stable and well-isolated:

- **Add a new panel** — drop a directory under `src/features/panels/` per `PANEL_CONTRACT.md`, register in `registry/index.ts`. Zero changes to player/pipeline.
- **Add a new format source** — implement `IIterableSource`, add a worker entry. Reuse `MessageCursor`, transports, ring.
- **Add a new extension** — register `McapViewerExtension` via `<McapViewer extensions={[...]} />`.
- **Add a new lane** — extend `HighFrequencyConsumer.lane` union (currently `'video' | 'pointcloud'`).

## 9. Designs to preserve (do not refactor away)

- **Two-store split** (Zustand for metadata, MessageBus for messages). Merging would tank perf.
- **Ref-based time subscription** (`player.subscribeCurrentTime`). Replacing with Zustand selector or context will cause 30 Hz React renders.
- **SAB ring fall-through to Transfer fall-through to Comlink.** Don't simplify to "always Comlink for portability".
- **`payloadKind` tagging on MessageEvent.** Lets consumers know whether `data` is a stable copy or a live SAB view — critical for retention safety.
- **`_isFetching` simple lock.** Not pretty but the cursor model genuinely is single-flight; introducing a queue/scheduler usually hurts more than it helps.

## 10. Profiling recipe

1. Open devtools, Performance tab.
2. Start recording.
3. Load a representative MCAP, scrub to a busy region, play 5 seconds.
4. Stop recording. Look for:
   - **Worker stalls** > 16 ms — usually decompression or a giant deserialize. Use `workerPerf` to bucket by topic.
   - **Long tasks on main** > 50 ms — almost always a React re-render storm. Check which panel.
   - **GC pauses** — usually retention in panel state or messageBus.

Direct evidence:
- `workerPerf.getReport()` (expose temporarily) shows per-operation and per-topic timing.
- `messageBus.getSubscriberSeq(id)` tells you how often a panel is being notified.
- `stalePayloadRefs` and `IDX_DROPPED` on the ring report missed payloads.

## 11. Known performance landmines

- **ROS2 db3 backfill**: O(N) forward scan — large files take seconds to seek. **Fix**: convert to MCAP.
- **Bag format with no chunk compression**: zero-copy of huge chunks; usually fine but watch CachedFilelike LRU.
- **HDF5 file mount via `FS.createLazyFile`**: uses **synchronous XHR** in the worker (allowed, but blocks the worker thread). Big remote HDF5 files will stall the cursor until reads complete.
- **DockView re-layout on file switch**: when topics change radically, auto-layout rebuilds the grid; can take 50–100 ms.
- **uPlot setData on every batch**: if a Plot panel naively updates per tick, frame drops will appear. JointStatePlot batches via the Accumulator pattern — copy that approach.

## 12. Future perf work (low-hanging)

- **Real `BufferedIterableSource`** with worker-side read-ahead window (currently a stub). Would smooth out long-tail deserialize spikes.
- **Schema-aware decoder cache** in `parseChannel.ts` — avoid re-resolving FileDescriptorSet types per channel.
- **OffscreenCanvas for 3D** — currently main-thread. Would unlock 60 fps R3F while CPU is saturated by other panels.
- **Worker pool** for parallel decode of independent topic streams (one cursor per topic per worker). Trades memory for throughput.
- **Streaming decompression** — fzstd / lz4js currently decode the whole chunk in one shot. Streaming would reduce peak memory by ~3×.
