# Important Files — Annotated Map

The 30 files you'll touch most often during deep work, with one-line purpose + key contents.

---

## Tier 1 — Read before any runtime change

| # | File | Lines | Why |
|---|---|---:|---|
| 1 | `src/core/players/IterablePlayer.ts` | ~1150 | Master state machine. Tick loop, dispatch, backfill, stale refresh, capability flags |
| 2 | `src/core/pipeline/messageBus.ts` | 114 | Seq-counter fan-out. THE key perf decision |
| 3 | `src/core/pipeline/store.ts` | ~60 | Zustand metadata state (slow-changing) |
| 4 | `src/core/pipeline/useMessagePipeline.ts` + `useMessageBus.ts` | ~80 | Hooks panels use to subscribe |
| 5 | `src/infra/workers/MessageCursor.ts` | 327 | Worker pump: 6 ms / 256 / 2048 / 128 MiB |
| 6 | `src/infra/workers/sharedPayloadRing.ts` | 95 | SAB ring layout + Atomics liveness |
| 7 | `src/infra/workers/WorkerSerializedSource.ts` | 293 | Main-side worker wrapper, payload resolution |

## Tier 2 — Touched when adding sources / formats

| # | File | Lines | Why |
|---|---|---:|---|
| 8 | `src/infra/sources/IIterableSource.ts` | 12 | The interface |
| 9 | `src/infra/sources/McapIndexedIterableSource.ts` | 274 | Reference impl. Chunk-indexed reverse-read |
| 10 | `src/infra/sources/BagIterableSource.ts` | 288 | ROS1; lz4 only |
| 11 | `src/infra/sources/RosDb3IterableSource.ts` | 223 | SQLite via WASM; O(N) backfill gotcha |
| 12 | `src/infra/sources/parseChannel.ts` | 200 | encoding → deserializer dispatch |
| 13 | `src/infra/sources/decompressHandlers.ts` | 30 | lz4js + fzstd (sync) |
| 14 | `src/infra/sources/hdf5/Hdf5IterableSource.ts` | ~700 | Synthetic 10 Hz timeline; WASM mount |
| 15 | `src/infra/sources/bvh/BvhIterableSource.ts` | ~200 | Text parser, synthetic timeline |
| 16 | `src/infra/services/CachedFilelike.ts` | ~300 | 50 MiB LRU blocks, range coalescing |
| 17 | `src/infra/services/BrowserHttpReader.ts` + `HttpFileReader.ts` | ~250 | Range probe, parallel chunks, retry |

## Tier 3 — Worker entries (one per format)

| # | File | Lines | Why |
|---|---|---:|---|
| 18 | `src/infra/workers/mcap.worker.ts` | 376 | Largest worker; auto-quality-scan logic too |
| 19 | `src/infra/workers/bag.worker.ts` | small | ROS1 entry |
| 20 | `src/infra/workers/db3.worker.ts` | 124 | sql.js bootstrap |
| 21 | `src/infra/workers/hdf5.worker.ts` | 140 | @ioai/hdf5 WASM init |
| 22 | `src/infra/workers/bvh.worker.ts` | small | BVH entry |

## Tier 4 — Transport selection / shared types

| # | File | Lines | Why |
|---|---|---:|---|
| 23 | `src/infra/workers/transports/createWorkerTransport.ts` | 17 | Factory dispatch |
| 24 | `src/infra/workers/transports/SabTransport.ts` | 47 | SAB tier |
| 25 | `src/infra/workers/transports/TransferTransport.ts` | 37 | Transferable tier |
| 26 | `src/infra/workers/transports/ComlinkTransport.ts` | 26 | Last-resort tier |
| 27 | `src/infra/workers/detectTransport.ts` | 43 | Platform probe |
| 28 | `src/infra/workers/types.ts` | 67 | Wire types (IMessageCursor, transport configs) |
| 29 | `src/infra/workers/transferables.ts` | 38 | Recursive ArrayBuffer extractor |
| 30 | `src/core/types/player.ts` | ~150 | PlayerState, Subscription, HighFrequencyConsumer |
| 31 | `src/core/types/ros.ts` | ~100 | MessageEvent, Time, TopicInfo |

## Tier 5 — Viewer composition / layout

| # | File | Why |
|---|---|---|
| 32 | `src/features/viewer/McapViewer.tsx` | Public component shell |
| 33 | `src/features/viewer/McapViewerImpl.tsx` | Dataset/worker lifecycle; ~1500 lines, the orchestrator |
| 34 | `src/features/viewer/McapViewerProvider.tsx` | Theme + intl context |
| 35 | `src/features/viewer/McapViewerContent.tsx` | Layout assembly inside the provider |
| 36 | `src/app/AppShell.tsx` | Navbar + content |
| 37 | `src/features/layout/DockviewLayout.tsx` | DockView wrapper, component map, layout import |
| 38 | `src/features/layout/dockviewController.ts` | Public `openDockviewPanel`, `import/exportDockviewLayout` |

## Tier 6 — Panel framework / contract

| # | File | Why |
|---|---|---|
| 39 | `src/features/panels/PANEL_CONTRACT.md` | Spec — read before creating a panel |
| 40 | `src/features/panels/framework/types.ts` | `PanelDefinition`, `PanelRenderProps`, `PanelSettingsContext` |
| 41 | `src/features/panels/framework/PanelRuntimeShell.tsx` | Panel mount lifecycle |
| 42 | `src/features/panels/framework/panelConfigStore.ts` | Plain Map + listener store (not Zustand) |
| 43 | `src/features/panels/registry/index.ts` | `getPanelDefinitions()` catalog |

## Tier 7 — Representative panels

| # | File | Why |
|---|---|---|
| 44 | `src/features/panels/ThreeD/ThreeDPanel.tsx` | R3F + TF ring + scheduleFrame coalescer |
| 45 | `src/features/panels/Image/Component.tsx` + `image-core/ImageRender.worker.ts` + `h264.ts` | OffscreenCanvas + WebCodecs |
| 46 | `src/features/panels/JointStatePlot/Component.tsx` | uPlot accumulator + downsampling + gap insertion |
| 47 | `src/features/panels/TopicGraph/` | cytoscape integration |
| 48 | `src/features/panels/RawMessages/` | Virtualized JSON tree |

## Tier 8 — Extensions / preferences / intl

| # | File | Why |
|---|---|---|
| 49 | `src/core/extensions/buildContext.ts` + `types.ts` | Extension context shape |
| 50 | `src/features/extensions/{Sidebar,PlaybackOverlay}ExtensionHost.tsx` | Hosts that mount contributions |
| 51 | `src/core/preferences/storageKeys.ts` | `xense.mcap.prefs`, `xense.mcap.layout` |
| 52 | `src/core/preferences/readWritePreferences.ts` | Schema-versioned read/write |
| 53 | `src/core/preferences/foxgloveLayout.ts` | Bidirectional Foxglove `LayoutData` interop |
| 54 | `src/core/preferences/layoutStorage.ts` | LocalStorage wiring |
| 55 | `src/shared/intl/createMcapViewerIntl.ts` + `en.json/zh.json/ja.json` | react-intl wrap |

## Tier 9 — Quality scan

| # | File | Why |
|---|---|---|
| 56 | `src/core/quality/clockProfile.ts` | Per-topic baseline windows |
| 57 | `src/core/quality/dropAttribution.ts` | Cluster merging |
| 58 | `src/core/quality/issueSummary.ts` | i18n payloads |
| 59 | `src/infra/quality/scanRunner.ts` | Iterates source, emits report partials |
| 60 | `src/infra/workers/dataQualityScanController.ts` | Worker-side controller |

## Tier 10 — Tests & fixtures

| # | File | Why |
|---|---|---|
| 61 | `src/infra/workers/MessageCursor.test.ts` | Unit; batching invariants |
| 62 | `src/infra/workers/sharedPayloadRing.test.ts` | Atomics + liveness |
| 63 | `src/infra/sources/McapIndexedIterableSource.test.ts` | Source iteration |
| 64 | `src/core/players/IterablePlayer.test.ts` | State machine |
| 65 | `tests/*.spec.ts` (Playwright) | End-to-end UI |
| 66 | `scripts/gen-test-mcap.mjs` | Synthesizes MCAP fixtures for tests |

## Build & env

| # | File | Why |
|---|---|---|
| 67 | `vite.config.ts` | SPA build; manualChunks; COOP/COEP dev headers |
| 68 | `vite.lib.config.ts` | Library build; `dist-lib`, single `rosview.d.ts` rollup |
| 69 | `src/entrypoints/index.ts` | Public npm API surface (semver-stable exports) |
| 70 | `src/entrypoints/{App,main}.tsx` | SPA boot |

## Quick file-to-question lookup

- "How does seek work?" → `IterablePlayer.ts:448-469`, `RUNTIME_PIPELINE.md §5`
- "Why isn't my panel re-rendering?" → `messageBus.ts`, `useMessageBus.ts`, `EXTENSION_GUIDE.md §2.3`
- "Where do batches come from?" → `MessageCursor.ts:68-100`
- "How is large data moved?" → `sharedPayloadRing.ts` + `THREADING_MODEL.md §3`
- "How do I add a panel?" → `EXTENSION_GUIDE.md §2`
- "Why is db3 slow on backfill?" → `RosDb3IterableSource.ts:142-172`
- "What does autoLayout do?" → `features/layout/autoLayout/*` (TBD — investigate per task)
- "What's the public API?" → `src/entrypoints/index.ts`
- "Where do panels persist config?" → `panelConfigStore.ts` + `layoutStorage.ts`
- "How do I write a Foxglove-compatible panel?" → `<Panel>/foxgloveAdapter.ts` + `foxgloveLayout.ts`

---

> **Note**: Line counts are approximate as of the architecture audit. Update this table if a file grows past 1.5× its listed size — that's usually a sign of accumulated drift that warrants a structural look.
