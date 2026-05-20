# Data Flow — Bytes to Pixels

End-to-end sequence of how a single message travels from a `.mcap` byte on disk (or a remote 50 MiB chunk over HTTP) to a pixel on screen. With concrete sizes and timings.

---

## 1. End-to-end pipeline (steady-state playback)

```
HTTP/Blob          Worker (per dataset)                           Main thread
────────  ──────────────────────────────────────────  ─────────────────────────────
                                                       IterablePlayer.tick (30 Hz)
                                                            │
                                                            │ nextBatch(advanceMs)
                                                            ▼
                                                      ┌───── Comlink RPC ─────┐
                                                      │                        │
                                              MessageCursor.nextBatch         │
                                              ├─ pump fills queue (BG)        │
                                              │   from source.messageIterator │
                                              │     ├─ source reads chunk     │
                                              │     │   (CachedFilelike LRU)  │
                                              │     ├─ decompress (lz4/zstd)  │
                                              │     ├─ parseChannel decode    │
                                              │     │   (ros1/cdr/protobuf…)  │
                                              │     └─ yield MessageEvent     │
                                              │                                │
                                              ├─ drain queue (6 ms / 256 msg) │
                                              │   for each msg:               │
                                              │     if data.byteLength ≥ 64K: │
                                              │       SharedPayloadRing.write │  ─SAB─►
                                              │       msg.data := ref          │
                                              │     else: keep inline          │
                                              └─ return MessageEvent[]         │
                                                                              │
                                                            ◄────────────────┘
                                                            │
                                              _distributeMessages
                                              ├─ resolve high-frequency lane FIRST
                                              │   ring.view(ref)  ── zero-copy
                                              │   → onLatestMessage(msg)       ──► R3F / Image worker
                                              ├─ group by topic
                                              ├─ resolve normal payloads
                                              │   ring.read(ref)  ── copies for retain
                                              │   bucket per subscriberId
                                              └─ messageBus.update(buckets, lastByTopic)
                                                            │
                                                            ▼
                                              per-subscriber listeners fire
                                              ├─ panel A useSubscriberSeq() bumps
                                              ├─ panel A re-renders (React)
                                              └─ panel imperatively pulls events
                                                            │
                                                            ▼
                                              WebGL draw call / DOM update / uPlot setData
                                                            │
                                                            ▼
                                              browser composites pixel
```

## 2. Boot sequence — first frame latency

For a 1 GB remote MCAP, the path from URL paste to first visible message:

```
T+0      User pastes URL
T+50ms   McapViewer detects extension, picks McapWorker
T+150ms  new Worker(...) constructed; ES module + WASM dependencies loaded
T+200ms  HttpFileReader probes GET (Range: bytes=0-0) → 206 with Content-Range
T+300ms  CachedFilelike sized; first Range request issued (last 50 MiB for footer)
T+800ms  Range response arrives; McapIndexedReader parses footer + chunk index
T+850ms  source.initialize() returns: topics[], datatypes, time bounds
T+900ms  IterablePlayer.initialize() completes; auto-layout builds DockView grid
T+950ms  Panels mount; register subscriptions; first cursor constructed
T+1000ms First nextBatch RPC sent
T+1100ms First chunk Range request issued (start of file region around playback start)
T+1500ms First batch returned (~50 ms decode + dispatch)
T+1550ms First frame visible
```

Local 1 GB file: skip the Range round-trips; first frame around T+600 ms.

The 100 ms `IterablePlayer` startup delay (after initialize, before play) gives panels time to call `registerSubscriptions` so the first cursor includes the right topics.

## 3. Per-format intake

### 3.1 MCAP (`McapIndexedIterableSource.ts`)

- `McapIndexedReader.Initialize({ readable })` reads footer → loads ALL chunk indexes eagerly.
- Per-channel stats from `reader.statistics.channelMessageCounts`.
- Iteration: `reader.readMessages({ startTime, endTime, topics })` yields raw chunk messages; source calls `parseChannel(...).deserialize(data)` per message.
- Backfill: `reader.readMessages({ ..., reverse: true })` — O(1) per topic via chunk index.

### 3.2 ROS1 Bag (`BagIterableSource.ts`)

- `@foxglove/rosbag` Bag opens via `BlobReader` or `RemoteBagReadable` (custom Range-backed wrapper).
- Connection records parsed once; `MessageReader` compiled per connection.
- Iteration: bag's iterator handles `startTime`; source filters `endTime` post-yield.
- Compression: lz4 only (`@foxglove/rosbag` is wired with `decompressHandlers.lz4`). bz2 intentionally not supported (browser-side payload too large).
- Backfill: reverse-read first match; **no forward fallback** → empty if seek before first message.

### 3.3 ROS2 db3 (`RosDb3IterableSource.ts`)

- `@foxglove/rosbag2-web` wraps `@foxglove/sql.js` (SQLite WASM).
- Time range fetched via `bag.timeRange()` — SQL `MIN/MAX(timestamp)`.
- Iteration: SQL `WHERE topic IN (...) AND timestamp BETWEEN ...`. Messages already deserialized by the library — source just unwraps.
- Backfill: forward scan from start, keep last ≤ T → O(N) on large bags. **Performance gotcha**: convert big db3 to MCAP for production.

### 3.4 HDF5 (`Hdf5IterableSource.ts` in `src/infra/sources/hdf5/`)

- `@ioai/hdf5` WASM mounts the file to Emscripten MEMFS (local) or uses `FS.createLazyFile` with sync XHR + Range (remote, only legal inside a worker).
- Walks the HDF5 tree to discover datasets; runs `planTopics()` heuristics to map datasets to virtual topics (`/joint_states`, `/camera/image/0`, `/pose`, …).
- **Timeline is synthetic** at the default `1/frameTimeSec = 10 Hz` (ALOHA convention). The dataset's `/tm` array is deliberately ignored — it contains warm-up offsets that would lie about real recording cadence.
- Iteration: binary search for first frame ≥ start; per-frame, slice the HDF5 dataset, copy out of WASM heap (`toOwnedTypedData`), build a ROS-style message.

### 3.5 BVH (`BvhIterableSource.ts` in `src/infra/sources/bvh/`)

- Plain text parse → joint hierarchy + frame motion array.
- One virtual topic `/bvh/skeleton`, synthetic timeline at file's declared frame time.
- Per frame: re-evaluate skeleton via `sampleBvhFrame`; emit `BvhSkeletonFrameMsg`.

## 4. Decoding micro-benchmarks (observed orders of magnitude)

(Approximate; varies by hardware and message size.)

| Step | Typical | Notes |
|---|---|---|
| MCAP chunk read (cached 50 MiB block) | < 1 ms | Range hit |
| MCAP chunk decompress (zstd, ~5 MiB → 30 MiB) | 5–15 ms | sync, blocks the pump |
| ROS1 msg deserialize (sensor_msgs/Image 1 MP) | 0.5–2 ms | dominated by Uint8 copy |
| CDR deserialize (PointCloud2 100k points) | 5–10 ms | per message |
| Protobuf decode (small object) | < 0.5 ms | |
| SAB ring write (1 MiB) | < 0.1 ms | memcpy |
| Comlink RPC roundtrip (proxy invocation) | 0.5–1 ms | structured-clone overhead for the args/result envelope (only — payloads ride SAB) |
| messageBus.update (256 messages, 10 subscribers) | < 1 ms | |
| React panel re-render | 1–5 ms | depends on panel type |
| WebGL frame (R3F) | 4–10 ms | dominated by GPU upload of new point cloud |

A single tick budget at 30 Hz is **33 ms**. Steady-state playback usually fits in 10–15 ms.

## 5. Memory ownership rules

| Holder | Buffer | Lifetime | Notes |
|---|---|---|---|
| Format worker | Raw chunk Uint8Arrays | Until next chunk read | LRU-evicted by `CachedFilelike` |
| Format worker | `SharedPayloadRing` slots | Until overwritten (cycle = 64 writes) | Stale refs detected on main via seq check |
| Format worker | Per-message JS object | Per nextBatch — sent to main | Transferred (Transfer mode) or referenced (SAB mode) |
| Main | `messageBus.lastMessageByTopic` | Until next message on that topic | Held forever for low-rate topics |
| Main | `messageBus.messagesBySubscriber[id]` | Until next tick (overwritten) | Single-frame retention |
| Main | Panel-internal state (uPlot rows, R3F geometry) | Until panel disposes | Largest source of leaks |
| Image worker | OffscreenCanvas + VideoFrames | VideoFrame.close() after blit | WebCodecs is strict — leak detection via dev tools |

## 6. Backfill flow (seek to t)

```
User drags playback slider
  → PlaybackBar.onChange(percent)
    → player.seek(percentToTime(percent))
      → IterablePlayer._seekAsync(t)
        ├─ clamp t to [start, end]
        ├─ _topicLastMessageNs.clear()
        ├─ await _cursor.end()      // wait for any in-flight batch
        ├─ _cursor = undefined
        ├─ msgs = await source.getBackfillMessages({ time: t, topics })
        │     (worker resolves per-topic last-before-t)
        ├─ _distributeMessages(msgs, t)
        │     → fires high-frequency lane (e.g., latest video frame for IDR seek-back)
        │     → fires normal subscribers
        ├─ _notifyTimeSubscribers(t)     // updates DOM time cursors directly
        └─ _emitState()                  // pushes Zustand state (presence stays PRESENT)

Next RAF tick:
  cursor undefined → create new cursor at t → nextBatch resumes
```

Image worker on seek-back: the H.264 decoder needs a key frame. The 10-key-chunk ring in `ImageRender.worker.ts` is searched for the most recent key chunk ≤ t; decoder reset; key frame fed; subsequent P-frames decoded.

## 7. High-frequency consumer flow (steady-state)

```
RobotComponent mounts (ThreeD panel)
  → player.registerHighFrequencyConsumer('threeD-tf!ab12', {
      topic: '/tf', lane: 'pointcloud', mode: 'all',
      onMessageBatch: (msgs) => tfHistory.push(...msgs)
    })

Per tick:
  source yields tf messages → cursor returns them in nextBatch
  IterablePlayer._distributeMessages:
    high-frequency lane FIRST:
      onMessageBatch(messages) — synchronous callback, no React involvement
    then normal subscribers

RobotComponent.scheduleFrame() coalesces TF updates per RAF
  invalidate() → R3F re-renders scene
```

## 8. Range query (plot scrubbing / analysis)

`getMessagesInTimeRange` (optional source method) — used by Align panel and `rangeQueryCache`:

```
RangeQueryCache.get({ start, end, topics, fields, downsampleMode })
  → cache hit? return
  → cache miss:
       msgs = await player.getMessagesInTimeRange({ start, end, topics, ... })
       → source.getMessagesInTimeRange (NOT through cursor — separate path)
       resolve fields, optionally downsampleMinMaxLast(maxPoints)
       store in LRU (max 24 entries / 1.5 MB)
       return
```

This is a **diagnostic / scrubber** path, NOT the playback path. Cache is small intentionally; queries should be infrequent.

## 9. Layout import/export flow

```
User triggers "Import layout":
  → file picker reads JSON
  → parseFoxgloveLayout(json) → ImportFoxgloveLayoutResult
       layout: MosaicNode<PanelId>
       configById: { [panelId]: PanelConfig }
       __xense.tabGroups (optional)
       restored / degraded / skipped counts
  → importDockviewLayout(api, result)
       for each panel:
         resolveFoxgloveAdapter(type) → adapter.fromFoxglove(configById[id])
         if unknown → Unavailable panel with extras = configById[id]
         api.addPanel(...)
       restoreTabGroups(api, tabGroups)
       seed panelConfigStore in bulk via replacePanelConfigs

Export:
  → exportDockviewLayout(api)
       walks DockView N-ary grid → binary Mosaic tree (row/column direction + splitPercentage)
       collect each panel's adapter.toFoxglove(config)
       wrap in { layout, configById, globalVariables, userNodes, __xense }
```

## 10. Where data flow lives in source

| Stage | File |
|---|---|
| HTTP/Blob byte read | `src/infra/services/{HttpFileReader,BlobReadable,BrowserHttpReader,CachedFilelike}.ts` |
| Format read + iterator | `src/infra/sources/*` |
| Decompression | `src/infra/sources/decompressHandlers.ts` |
| Channel decode | `src/infra/sources/parseChannel.ts` |
| Worker pump | `src/infra/workers/MessageCursor.ts` |
| SAB ring | `src/infra/workers/sharedPayloadRing.ts` |
| Worker entry | `src/infra/workers/{mcap,bag,db3,hdf5,bvh}.worker.ts` |
| Main-side wrapper | `src/infra/workers/WorkerSerializedSource.ts` |
| Player dispatch | `src/core/players/IterablePlayer.ts` |
| Fan-out | `src/core/pipeline/messageBus.ts` |
| Metadata state | `src/core/pipeline/store.ts` |
| Panel consume | `src/core/pipeline/useMessageBus.ts` + per-panel impl |
| Render | `src/features/panels/*` (R3F / uPlot / cytoscape / HTML) |
