# Xense MCAP Viewer Internal Architecture

> Runtime-internals view. For the project's design spec see `docs/ARCHITECTURE.md`.
> This document describes what the code actually does, with file:line citations.

---

## 1. System Shape

Xense MCAP Viewer is a **browser-native robotics data runtime**: a multi-threaded pipeline that turns recorded ROS / MCAP / HDF5 / BVH bytes into visualized frames at 30+ FPS on the main thread, without server-side processing.

Three concentric layers:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Main thread (React 19)                                              │
│                                                                       │
│   IterablePlayer ────┬──> MessageBus (seq-counter fan-out)           │
│   (state machine,    │      ├── per-topic listeners                  │
│    RAF tick @30fps)  │      └── per-subscriber listeners             │
│         │            │                                                │
│         │            └──> Zustand store (metadata: topics/datatypes/ │
│         │                  presence/progress/subscriptions)          │
│         │                                                             │
│         │            ┌─── HighFrequencyConsumer lane (video/pcd)     │
│         ↓            ↓                                                │
│   Panels ── DockView ── R3F Canvas / uPlot / cytoscape / HTML        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
              ▲ Comlink RPC      ▲ SharedArrayBuffer ring (zero-copy)
              │                  │ + Transferable fallback
┌─────────────┴──────────────────┴─────────────────────────────────────┐
│  Format Worker (one per loaded dataset)                              │
│                                                                       │
│   WorkerSerializedSourceWorker                                       │
│         │                                                             │
│         ├── IIterableSource impl                                     │
│         │     • McapIndexedIterableSource  (chunk index reverse-read) │
│         │     • BagIterableSource          (lz4 decompress)          │
│         │     • RosDb3IterableSource       (SQLite WASM)             │
│         │     • Hdf5IterableSource         (WASM, synthetic timeline)│
│         │     • BvhIterableSource          (text parser)             │
│         │                                                             │
│         ├── parseChannel (ros1 / cdr / protobuf / flatbuffer / json) │
│         ├── decompressHandlers (lz4js / fzstd)                       │
│         └── MessageCursor (6 ms / 256 msg / 128 MiB queue)           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
              ▲ HTTP Range / Blob slice
              │
┌─────────────┴───────────────────────────────────────────────────────┐
│  Byte-source layer (still in worker)                                 │
│                                                                       │
│   • BlobReadable     — File / Blob                                   │
│   • CachedFilelike   — 50 MiB LRU blocks                             │
│   • BrowserHttpReader — Range probe, 8 MiB parallel, 429/5xx retry  │
│   • HttpFileReader   — wraps fetch with AbortController              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Layers in Detail

### 2.1 Byte source

`src/infra/services/`. Provides a `Readable { size(); read(offset,len): Promise<Uint8Array> }` abstraction.

- **`BlobReadable`** — `Blob.slice().arrayBuffer()` for local files.
- **`BrowserHttpReader`** — probes file size with `Range: bytes=0-0` (handles presigned S3), reads in 8 MiB parallel chunks via `Promise.all`, retries 429/5xx with exponential backoff (300 ms → 4 s).
- **`CachedFilelike`** — `CACHE_BLOCK_SIZE = 50 MiB` (`CachedFilelike.ts:20`). Adaptive LRU block count (`ceil(cacheSize / 50MiB) + 2`). Coalesces overlapping requests, single in-flight connection (read priority > prefetch).

### 2.2 Format source

`src/infra/sources/`. Implements `IIterableSource`:

```ts
interface IIterableSource {
  initialize(): Promise<Initialization>;            // topics, datatypes, time bounds, problems
  messageIterator(args): AsyncIterableIterator<MessageEvent>;
  getBackfillMessages(args): Promise<MessageEvent[]>; // last msg ≤ T per topic
  getAdjacentMessage?(args): Promise<MessageEvent | null>;
  getMessagesInTimeRange?(args): Promise<MessageEvent[]>;
}
```

Indexing strategies differ per format — see `RUNTIME_PIPELINE.md` §6 and `DATAFLOW.md`.

### 2.3 Channel decoding

`parseChannel.ts` is the polymorphic encoding switch:

| Encoding | Schema | Library | Mode |
|---|---|---|---|
| `json` | none | built-in TextDecoder + JSON.parse | full copy |
| `ros1` | `ros1msg` | `@foxglove/rosmsg` + `rosmsg-serialization` | per-channel `MessageReader` reused |
| `cdr` (ROS2) | `ros2msg` / `ros2idl` / `omgidl` | `rosmsg2-serialization` / `omgidl-serialization` | per-channel reader |
| `protobuf` | `FileDescriptorSet` | `protobufjs` | `Root.decode().toObject()` |
| `flatbuffer` | flexbuffers binary (NOT .fbs text) | flatbuffers/flexbuffers | `flexbuffersToObject()` |

Decompression handlers (`decompressHandlers.ts`): **synchronous** lz4 (`lz4js.decompressBlock`) and zstd (`fzstd.decompress`). Output is a pre-allocated `Uint8Array`.

### 2.4 Worker glue

`src/infra/workers/`:

- **`WorkerSerializedSource`** — main-side wrapper over a Comlink-proxied worker; resolves `SharedPayloadRef`s from the SAB ring, hands `MessageEvent[]` to the player.
- **`MessageCursor`** — worker-side pump that drives `source.messageIterator()` into a bounded queue. `nextBatch(durationMs)` drains until 6 ms wall, 256 msgs, or `durationMs` time-window exceeded.
- **Three transports** — `Sab` (preferred, requires `crossOriginIsolated`), `Transfer` (Transferable arraybuffers), `Comlink` (last resort, structured clone). Selected at startup by `detectTransport.ts`.
- **`sharedPayloadRing.ts`** — 64-slot × 4 MiB ring, `Atomics.store/notify` on a single seq counter; liveness check is `current_seq - ref.seq <= slotCount`.

### 2.5 Player

`src/core/players/IterablePlayer.ts` — single state machine:

```
preinit ──initialize──> initializing ──> ready ──┬── play ──> RAF tick loop
                                                 ├── pause
                                                 ├── seek ─> abort cursor + backfill
                                                 └── close ─> terminate worker
```

Key behaviors:

- Tick at `DEFAULT_SAMPLING_FPS = 30` Hz (clamped 1–45), accumulator-based; catch-up capped at `MAX_TICK_CATCHUP_STEPS = 2`.
- Speed factor: linear in [0.1, 8] or 64× when `PLAYBACK_SPEED_MAX = -1`.
- Two dispatch lanes per tick: high-frequency consumers (resolved first, may skip deserialization) and normal subscribers.
- Stale-topic refresh every 500 ms (1 s threshold) re-backfills latched topics.
- Empty-batch recovery rebuilds cursor (streak 1) and falls back to full backfill (streak ≥ 4 + 1 s).

See `RUNTIME_PIPELINE.md` for full state-machine semantics.

### 2.6 MessagePipeline

`src/core/pipeline/`. **Two-store split:**

- **Zustand store** (`store.ts`) — slow-changing: `playerState`, `sortedTopics`, `datatypes`, `subscriptions`, `publishersByTopic`. Pushed at most every `PIPELINE_EMIT_INTERVAL_MS = 200 ms`.
- **MessageBus** (`messageBus.ts`) — per-tick: holds `lastMessageByTopic` and `messagesBySubscriberId`. Notifies via per-topic and per-subscriber listener sets, with monotonic `seq` counters. Panels consume via `useSyncExternalStore` keyed on the seq.

This split is **the** central perf decision: Zustand selectors don't fire when only message bytes change; only the affected subscribers tick.

### 2.7 Panel framework

`src/features/panels/framework/`:

- **`panelConfigStore.ts`** — plain `Map<panelId, config>` with listener sets (NOT Zustand). `usePanelConfig(panelId)` via `useSyncExternalStore`.
- **`PanelRuntimeShell.tsx`** — instantiates a panel: seeds config, registers tab actions + settings renderers, wraps in `PanelErrorBoundary`, wraps in `PanelSuspense` for lazy load.
- **`registry/`** — static `getPanelDefinitions()` returning the catalog. Each panel has a `foxgloveAdapter.ts` for layout round-trip.

Panel-contract spec: `src/features/panels/PANEL_CONTRACT.md`.

### 2.8 DockView layout

`src/features/layout/DockviewLayout.tsx` binds each `PanelType` to a factory that returns `PanelRuntimeShell`. Layout state is import/export to **Foxglove-compatible `LayoutData`** via `exportDockviewLayout` / `importDockviewLayout`. Tab-group metadata is preserved in `LayoutData.__xense.tabGroups`.

### 2.9 Extensions

`src/core/extensions/`. Third parties register `McapViewerExtension { sidebarTabs?, playbackOverlays?, attach?, detach? }` via `McapViewer` prop. `buildContext()` synthesizes `McapViewerExtensionContext` (player snapshot proxy + playbackControls + timeline helpers + optional messageAccess). Hosts:

- `features/extensions/SidebarExtensionHost.tsx`
- `features/extensions/PlaybackOverlayHost.tsx`

## 3. Boot Sequence (per dataset)

```
McapViewer mounts
  └── reads URL / file / sample manifest
       └── selectWorker(extension) → new Worker(...) (mcap/bag/db3/hdf5/bvh)
            └── detectTransport() → SAB | Transfer | Comlink
                 └── new WorkerSerializedSource(worker)
                      └── new IterablePlayer(source)
                           ├── player.initialize() → topics, datatypes, time bounds
                           ├── auto-layout builds initial DockView grid from topics
                           ├── if autoDataQualityScan → startDataQualityScan()
                           └── play() — kicks off RAF tick loop
```

Switching files terminates the old worker and constructs a new one — no worker pool.

## 4. Two Delivery Forms

- **SPA** (`vite.config.ts`) — `index.html` → `entrypoints/main.tsx` → `entrypoints/App.tsx`. Reads `?url=` query (`file://`, `folder://`, `sample://`, or http). `manualChunks` for dockview / three / uplot / mcap / rosbag / hdf5.
- **Library** (`vite.lib.config.ts`) — entry `entrypoints/index.ts`. ESM bundle + single rollup'd `xense-mcap-viewer.d.ts` (via `vite-plugin-dts`, `rollupTypes: true`). React, three, @react-three/* externalized. CSS extracted to `xense-mcap-viewer.css`.

The library build defines `VITE_SAMPLE_DATASETS_MANIFEST_URL = 'off'` so an embed never hits the upstream sample CDN.

## 5. Cross-cutting concerns

- **Time representation**: `Time = { sec: number; nsec: number }` (`core/types/ros.ts`). Internal comparisons go through `toNano(time): bigint`. All cursors/sources operate on bigint nanoseconds.
- **`MessageEvent`** — canonical wire type across worker/main: `{ topic, receiveTime, logTime, schemaName, message, sizeInBytes, payloadKind? }`. `payloadKind` enum: `inline | hybrid-transfer | hybrid-sab`.
- **i18n** — `react-intl` with `en | zh-CN | ja-JP`. Out-of-provider intl via `createMcapViewerIntl`.
- **Preferences** — schema-versioned (`schemaVersion: 1`), localStorage keys defined in `core/preferences/storageKeys.ts`.

See `DATAFLOW.md` for end-to-end sequence diagrams.
