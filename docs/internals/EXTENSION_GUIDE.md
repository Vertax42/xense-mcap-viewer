# Extension Guide

How to extend rosview without touching the player core. Four common extension paths, in increasing order of depth.

---

## 1. Embed the viewer (no source changes)

```tsx
import { McapViewer, type McapViewerExtension } from 'xense-mcap-viewer'
import 'xense-mcap-viewer/style.css'

const myExt: McapViewerExtension = {
  id: 'mylab.foo',
  sidebarTabs: [{
    id: 'mylab.foo.sidebar',
    title: 'My Tab',
    icon: <FooIcon />,
    order: 100,
    render: (ctx) => <MyPanel ctx={ctx} />,
  }],
  playbackOverlays: [{
    id: 'mylab.foo.overlay',
    order: 100,
    height: 24,
    render: (ctx) => <MyOverlay ctx={ctx} />,
  }],
  attach(ctx)  { /* one-time setup */ },
  detach(ctx)  { /* cleanup */ },
}

<McapViewer url="..." extensions={[myExt]} hostContext={{ userId: 'abc' }} />
```

### What `ctx` (`McapViewerExtensionContext`) provides

| Property | Type | Notes |
|---|---|---|
| `dataset` | `{ id, name, url? }` | Current loaded dataset metadata |
| `topics` | `ReadonlyArray<TopicInfo>` | Live topic list |
| `playback` | `PlaybackControlsApi` | `seek`, `play`, `pause`, `setSpeed`, `setLooping`, `stepBy`, `stepMessage`, `playUntil` (promise), `subscribeCurrentTime`, `getSnapshot` |
| `timeline` | `TimelineApi` | `getTimeBounds`, `timeToPercent`, `percentToTime` |
| `messageAccess?` | `MessageAccessApi` | Optional `getMessagesInTimeRange()` for range queries |
| `host` | opaque `hostContext` prop | Whatever you passed in |
| `locale`, `theme` | strings | Reactive — use to mirror parent app's chrome |

Two pre-built host wrappers render extension contributions:

- `features/extensions/SidebarExtensionHost.tsx` — error-bounded sidebar tabs.
- `features/extensions/PlaybackOverlayHost.tsx` — error-bounded timeline overlay lanes.

Both already handle ordering, error boundaries, and context propagation.

## 2. Add a new panel type

The most common extension. Follow `src/features/panels/PANEL_CONTRACT.md` exactly.

### 2.1 Skeleton

```
src/features/panels/MyPanel/
  index.ts              # export definition + config type
  defaults.ts           # MyPanelConfig type + defaultMyPanelConfig()
  schema.ts             # parseMyPanelConfig(input: unknown) — tolerant
  definition.tsx        # PanelDefinition: type, defaultTitle, render, renderSettings?
  foxgloveAdapter.ts    # toFoxglove(config) / fromFoxglove(extras)
  Component.tsx         # the actual React component
```

### 2.2 Definition shape

```ts
export const MyPanelDefinition: PanelDefinition<MyPanelConfig> = {
  type: 'MyPanel',                    // unique; encoded into panelId as `MyPanel!hash`
  defaultTitle: 'My Panel',
  createDefaultConfig: defaultMyPanelConfig,
  configSchema: { version: 1, parse: parseMyPanelConfig },
  render: ({ player, panelId, panelTitle, config, setConfig, resetPanel }) => (
    <MyComponent {...} />
  ),
  renderSettings: (ctx) => <MySettings ctx={ctx} />,   // optional
}
```

### 2.3 Subscribe to messages

```ts
import { messageBus } from '@/core/pipeline/messageBus'
import { useSubscriberSeq } from '@/core/pipeline/useMessageBus'

function MyComponent({ player, panelId, config }) {
  // Register topic subscription with the player
  useEffect(() => {
    player.registerSubscriptions(panelId, [{ topic: config.topic, preloadType: 'full' }])
    return () => player.registerSubscriptions(panelId, [])
  }, [player, panelId, config.topic])

  // Re-render only when this panel has new messages
  const seq = useSubscriberSeq(panelId)
  const lastSeen = useRef(0)
  useEffect(() => {
    if (seq === lastSeen.current) return
    lastSeen.current = seq
    const msgs = messageBus.getSubscriberMessages(panelId)
    // Process msgs imperatively — DO NOT put them in React state
    handleMessages(msgs)
  }, [seq])

  return <canvas ref={canvasRef} />
}
```

**Do NOT** put `messageEvents` in `useState`. The `useSubscriberSeq` hook is the only React-visible state change. Read events through `messageBus.getSubscriberMessages(panelId)` imperatively.

### 2.4 High-frequency lane (for video / point cloud panels)

If the panel re-renders > 10 Hz with payloads ≥ 100 KiB, use the high-frequency lane instead of normal subscriptions:

```ts
useEffect(() => {
  const consumerId = `myPanel-stream!${panelId}`
  player.registerHighFrequencyConsumer(consumerId, {
    topic: config.topic,
    lane: 'video',                    // or 'pointcloud'
    mode: 'latest',                    // get the freshest frame only
    onLatestMessage: (msg) => {
      // Direct DOM/WebGL update — no React state
      renderFrameToCanvas(canvasRef.current, msg.message.data)
    },
  })
  return () => player.unregisterHighFrequencyConsumer(consumerId)
}, [player, panelId, config.topic])
```

This bypasses `messageBus`, gets the message before normal subscribers each tick, and (in SAB mode) uses a zero-copy `view()` into the ring.

### 2.5 Settings UI

Use the form kit from `src/features/panels/framework/settings/`:

```tsx
import { SettingsSection, SettingsField, TopicAutocomplete } from '@/features/panels/framework/settings'

export function MySettings({ ctx }: { ctx: PanelSettingsContext<MyPanelConfig> }) {
  return (
    <SettingsSection title="Source">
      <SettingsField label="Topic">
        <TopicAutocomplete
          topics={ctx.topics}
          value={ctx.config.topic}
          onChange={(topic) => ctx.setConfig((c) => ({ ...c, topic }))}
        />
      </SettingsField>
    </SettingsSection>
  )
}
```

### 2.6 Register

In `src/features/panels/registry/index.ts`:

```ts
import { MyPanelDefinition } from '../MyPanel'

export function getPanelDefinitions(): PanelDefinition[] {
  return [
    // ...existing
    MyPanelDefinition,
  ]
}
```

### 2.7 Foxglove round-trip

Implement `foxgloveAdapter.ts` so layouts exported with your panel can be re-imported (and so users can import Foxglove-Studio layouts that include the equivalent panel):

```ts
export const myPanelFoxgloveAdapter: FoxgloveAdapter<MyPanelConfig> = {
  foxgloveType: 'studio-panel-id',
  toFoxglove(config) { return { ...config, foxgloveSpecific: ... } },
  fromFoxglove(extras) { return parseMyPanelConfig(extras) },
}
```

Register in the foxgloveAdapters registry (see existing panels for the exact import).

## 3. Add a new file format

Implement `IIterableSource` (interface in `src/infra/sources/IIterableSource.ts`), then add a worker entry.

### 3.1 Implement the source

```ts
export class MyFormatIterableSource implements IIterableSource {
  constructor(opts: { readable: Readable }) { ... }

  async initialize(): Promise<Initialization> {
    // Parse header, build topic list, time bounds, datatypes
    return { topics, datatypes, start, end, publishersByTopic, topicStats, problems: [] }
  }

  async *messageIterator(args: MessageIteratorArgs): AsyncIterableIterator<MessageEvent> {
    for (const raw of this._readRawInRange(args.startTime, args.endTime, args.topics)) {
      const decoded = this._channels.get(raw.channelId)!.deserialize(raw.data)
      yield { topic: ..., receiveTime: ..., message: decoded, schemaName: ... }
    }
  }

  async getBackfillMessages({ time, topics }: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    // Per topic: return most-recent ≤ time
  }

  async getAdjacentMessage(args): Promise<MessageEvent | null> { ... }
  async getMessagesInTimeRange?(args): Promise<MessageEvent[]> { ... }
}
```

### 3.2 Worker entry

Create `src/infra/workers/myformat.worker.ts`:

```ts
import * as Comlink from 'comlink'
import { MyFormatIterableSource } from '@/infra/sources/MyFormatIterableSource'
import { MessageCursor } from '@/infra/workers/MessageCursor'
import { BlobReadable } from '@/infra/services/BlobReadable'
import { CachedFilelike } from '@/infra/services/CachedFilelike'
import { HttpFileReader } from '@/infra/services/HttpFileReader'

class MyFormatWorker {
  private source!: IIterableSource
  async initialize(args: { url?: string; file?: File }) {
    const readable = args.url
      ? new CachedFilelike({ reader: new HttpFileReader(args.url), cacheSizeInBytes: ... })
      : new BlobReadable(args.file!)
    this.source = new MyFormatIterableSource({ readable })
    return await this.source.initialize()
  }
  async getMessageCursor(args) { return Comlink.proxy(new MessageCursor({ source: this.source, ...args })) }
  async getBackfillMessages(args) { return this.source.getBackfillMessages(args) }
  async terminate() { /* abort, cleanup */ }
}
Comlink.expose(new MyFormatWorker())
```

### 3.3 Wire into McapViewerImpl

Add an extension dispatch case in `McapViewerImpl.tsx`'s worker-selection logic so `.myfmt` files instantiate your worker. Reuse `WorkerSerializedSource` — no changes needed there.

## 4. Add a new high-frequency lane

Currently `'video' | 'pointcloud'`. Add 'audio' for an audio-stream renderer:

1. In `src/core/types/player.ts`, extend `HighFrequencyConsumer.lane`.
2. In `IterablePlayer.ts:254-259`, ensure `_rebuildHighFrequencyConsumerIndex` includes the new lane.
3. In `_distributeMessages` (lines 622–626), keep the FIRST-resolve invariant — your lane will be batched alongside existing ones.

No other changes needed; the lane is just a label until you register a consumer with it.

## 5. Add a new transport

Implement `BaseWorkerTransport` (`src/infra/workers/transports/BaseWorkerTransport.ts`):

```ts
export class MyTransport extends BaseWorkerTransport {
  async configure(remote: Comlink.Remote<...>): Promise<TransportConfig> {
    // Tell the worker how to send back payloads (e.g., via your custom postMessage protocol)
    return { mode: 'my-transport', binaryPayloadThresholdBytes: 64 * 1024 }
  }
  resolveMessageBatch(messages: MessageEvent[]): MessageEvent[] { /* custom resolve */ return messages }
  resolveMessageForHighFrequencyLane(msg, viewOrCopy): MessageEvent { /* custom resolve */ return msg }
}
```

Add to `createWorkerTransport.ts` dispatch. Update `detectTransport.ts` if your transport requires platform probing.

## 6. Persist custom preferences

For host apps that need to put preferences in a custom store (not localStorage):

```tsx
import type { PreferencePersistence } from 'xense-mcap-viewer'

const myPersistence: PreferencePersistence = {
  async read() { return await myDb.get('rosview-prefs') },
  async write(prefs) { await myDb.put('rosview-prefs', prefs) },
}

<McapViewer preferencePersistence={myPersistence} ... />
```

Or use the helpers directly: `readPreferences()`, `writePreferences()`, `readSavedDockviewLayout()`, `saveDockviewLayoutToStorage()`, `clearSavedDockviewLayout()`.

## 7. What you should NOT do

- **Don't put `MessageEvent[]` in Zustand or React state.** The pipeline is designed to never hold message bytes in React. You will tank perf and possibly corrupt state if SAB refs are retained past their cycle.
- **Don't add a `useContext` for high-frequency data.** Every consumer re-renders on every context update. Use `useSubscriberSeq` + `useTopicSeq` instead.
- **Don't bypass `PanelRuntimeShell`.** It registers tab actions and error boundaries; rolling your own breaks the toolbar UX.
- **Don't add a side-effect to a panel `render()` that calls `setConfig` synchronously.** `panelConfigStore` is shared; you'll loop.
- **Don't fork `IterablePlayer`.** If you need a live source, implement the `Player` interface in parallel; the pipeline will accept any `Player`-shaped object.

## 8. Checklist for a new feature

- [ ] Did you read `docs/internals/RUNTIME_PIPELINE.md` and understand which lane you're on?
- [ ] Do new buffers / objects you keep have a defined lifetime?
- [ ] Have you respected `payloadKind`? (`hybrid-sab` views must be consumed in the same tick.)
- [ ] Tests under `src/**/__tests__/*` or root-level `*.test.ts` for unit logic; `tests/*.spec.ts` for Playwright.
- [ ] No `console.log` left in committed code.
- [ ] If you touched the public API surface (`src/entrypoints/index.ts`), document the change in `docs/API.md`.
