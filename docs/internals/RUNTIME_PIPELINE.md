# Runtime Pipeline — Playback Loop in Detail

> File: `src/core/players/IterablePlayer.ts` (1100+ lines, this doc cites it heavily)

The IterablePlayer is the heartbeat. Every frame of every panel is driven by its tick. This document specifies the exact semantics so future modifications don't accidentally break timing, ordering, or fairness invariants.

---

## 1. State Machine

`presence: 'NOT_PRESENT' | 'INITIALIZING' | 'PRESENT' | 'RECONNECTING' | 'ERROR'`

```
preinit ──initialize()──> INITIALIZING ──source.initialize() ok──> PRESENT
                                       └──error──> ERROR
PRESENT ─┬─ play()       → arms RAF tickLoop, _isPlaying = true
         ├─ pause()      → cancels RAF, _isPlaying = false
         ├─ seek(t)      → async: abort cursor, clamp t, clear topicLastMessageNs,
         │                  backfill, distribute, notify time subscribers
         ├─ setSpeed(s)  → clamp [0.1, 8] or PLAYBACK_SPEED_MAX (-1) sentinel
         ├─ setLooping(b)
         └─ close()      → terminate worker, clear state
```

Lifecycle (`IterablePlayer.ts:334–548`):

- `initialize()` builds the `activeData` from `source.initialize()`: topics, datatypes, publishersByTopic, start/end times, problems. If the source advertises `preferredSamplingFps` (e.g., HDF5 = 10 Hz), it's adopted.
- `close()` aborts in-flight cursors, terminates the worker (via `source.terminate?.()`), clears all maps. Idempotent.

## 2. Tick Loop

Entry: `_tickLoop = () => void this._tickAsync()` armed via `requestAnimationFrame`.

```
async _tickAsync()
  if (!_isPlaying || _isFetching) return
  _isFetching = true
  try:
    accumulator += (now - lastTick)
    elapsedPlaybackTickMs = min(accumulator, tickDurationMs * MAX_TICK_CATCHUP_STEPS)
    accumulator -= elapsedPlaybackTickMs
    speedFactor = (_speed === PLAYBACK_SPEED_MAX) ? 64 : _speed
    advanceMs = max(1, elapsedPlaybackTickMs * speedFactor)
    _currentTime += advanceMs
    if (!_cursor) _cursor = await source.getMessageCursor({ startTime, topics, latestOnlyTopics })
    messages = await _cursor.nextBatch(advanceMs)
    if (messages.length === 0) _handleEmptyBatch()
    else { _emptyBatchStreak = 0; _distributeMessages(messages, _currentTime) }
    if (_currentTime >= end) handleEndOfData()
    _maybeRefreshStaleTopics()
    _maybeEmitPipelineState()
  finally:
    _isFetching = false
    if (_isPlaying) requestAnimationFrame(_tickLoop)
```

Constants (`IterablePlayer.ts:17–27`):

| Constant | Value | Purpose |
|---|---|---|
| `DEFAULT_SAMPLING_FPS` | 30 | tickDurationMs = 1000/fps ≈ 33 ms |
| `MAX_TICK_CATCHUP_STEPS` | 2 | accumulator cap = 2 × tickDurationMs (prevents huge jumps on tab refocus) |
| `PIPELINE_EMIT_INTERVAL_MS` | 200 | Zustand state emit throttle |
| `BACKFILL_STALE_THRESHOLD_NS` | 1_000_000_000n | topic-stale threshold (1 s) |
| `PLAYBACK_SPEED_MAX` | -1 | sentinel → 64× speedFactor |

`_isFetching` is the **only** concurrency guard. If the cursor `nextBatch` takes longer than one frame, subsequent RAFs no-op until the in-flight fetch resolves.

## 3. Cursor Lifecycle

Per dataset, only one cursor exists at a time.

Constructed (`IterablePlayer.ts:763–771`):
```ts
this._cursor = await this._source.getMessageCursor({
  startTime: this._currentTime,
  topics,                            // subscribed + high-frequency, deduped
  latestOnlyTopics,                   // topics with ONLY 'latest'-mode HF consumers
});
```

Terminated (`await this._cursor.end()`) on:

- seek (line 456)
- subscription change (line 226)
- high-frequency consumer change (line 309)
- loop end (line 806)
- close (line 543)

The cursor lives in the worker as a `Comlink.proxy(new MessageCursor(...))`. `end()` flips a pump flag; the worker stops reading from `source.messageIterator()` and frees its queue.

## 4. Subscription Model

Two registration channels:

### 4.1 Normal subscriptions

`registerSubscriptions(panelId: string, subscriptions: Subscription[])` (line 176).

- Subscription = `{ topic, schemaConverters?, preloadType: 'full' | 'partial' }` (current code uses `full`).
- All panel subscriptions merged into `_subscriptions`.
- Indexed into `_subscriberIdsByTopic: Map<topic, panelId[]>`.

Per-tick dispatch (`_distributeMessages` lines 593–672):
- Group messages by topic. For each subscribed topic, push to each subscriber's bucket.
- After batch, call `messageBus.update(batchBySubscriber, lastByTopic)` ONCE.

### 4.2 High-frequency consumers

`registerHighFrequencyConsumer(consumerId, consumer)` (line 186):

```ts
interface HighFrequencyConsumer {
  topic: string;
  lane: 'video' | 'pointcloud';
  mode?: 'latest' | 'all';            // default 'latest'
  onLatestMessage?: (msg: MessageEvent) => void;
  onMessageBatch?: (msgs: MessageEvent[]) => void;
}
```

Dispatched **before** normal subscribers (lines 622–626) so heavy renderers (R3F, video) get the freshest frame even if the rest of the batch is large.

- `latest` mode: only the newest message in this tick is delivered; older drops. Topic added to `latestOnlyTopics` → worker cursor may skip frames.
- `all` mode: full batch.

**Payload sharing rule** (line 684 vs 689): if a topic has BOTH normal subscribers and HF consumers, payloads are copied (each consumer gets its own); otherwise SAB-backed views are reused zero-copy.

### 4.3 Subscription rebuild semantics

Any change triggers `_rebuildSubscriptions()` which:

1. Recomputes `_subscriptions`, `_subscriberIdsByTopic`, `_topicsForCursor`, `_latestOnlyHighFrequencyTopics()`.
2. Aborts current cursor (`await _cursor.end()`).
3. Lets the next tick rebuild the cursor with the new topic set.

This is why subscription churn during playback causes a 1-tick gap.

## 5. Seek

`seek(time: Time): void` (line 448) is sync API, async impl (`_seekAsync`, line 452):

```ts
this._currentTime = clamp(time, start, end);
this._topicLastMessageNs.clear();          // reset stale tracking
if (this._cursor) await this._cursor.end();
this._cursor = undefined;
if (topics.length > 0) {
  const msgs = await this._source.getBackfillMessages({ time, topics });
  this._distributeMessages(msgs, this._currentTime);
}
this._notifyTimeSubscribers(this._currentTime);
this._lastPipelineEmitMs = 0;             // force next emit
this._emitState();
```

**Backfill** returns the most-recent message ≤ time **per topic**. Sources implement this differently:

- MCAP / Bag: reverse-read from T, take first yielded per topic.
- ROS2 db3 / HDF5 / BVH: forward scan from start (no reverse index).

If no message exists before T, fall forward to first-after-T (MCAP, BVH) or empty (Bag, db3 — gotcha).

## 6. Empty-batch recovery

`_handleEmptyBatch` (lines 936–992):

```
_emptyBatchStreak++
if (_emptyBatchStreak === 1) {
  await _cursor.end(); _cursor = undefined;          // worker may have hit iterator end
}
if (_emptyBatchStreak >= 4 && (now - _lastFallbackBackfillMs) > 1000) {
  msgs = await source.getBackfillMessages({ time, topics })
  _distributeMessages(msgs, _currentTime)
  _lastFallbackBackfillMs = now
}
```

Why: if the worker iterator returns nothing for several ticks (e.g., long topic gaps), we fall back to a per-topic backfill so panels don't go blank.

## 7. Stale-topic refresh

`_maybeRefreshStaleTopics` (lines 1009–1051):

- Runs at most every 500 ms.
- For each subscribed topic, check `_topicLastMessageNs.get(topic)`. If `currentTimeNs - last > BACKFILL_STALE_THRESHOLD_NS (= 1 s)`, mark stale.
- Backfill the stale topics; dispatch via `_distributeMessages`.

**Stale-message filter** (`_distributeMessages` lines 1114–1126): if a backfill/stale message has the **same** `receiveTime` as the last delivered one on that topic, skip it. Prevents URDF / TF_static from re-rendering every refresh tick.

This is what keeps `robot_description`, TF_static, and 1 Hz latched topics visible during long pauses or low-traffic regions.

## 8. End-of-data handling

When `_currentTime >= end`:

- If `_loop` is true: seek to start, continue.
- Else: pause, set `_isPlaying = false`, emit final state.

`loop` is a single boolean; no loop-region (range loop) feature yet.

## 9. MessageBus fan-out

`src/core/pipeline/messageBus.ts` (114 lines, read it):

```ts
class MessageBus {
  #lastMessageByTopic: Map<string, MessageEvent>     // topic → latest msg
  #messagesBySubscriber: Map<string, MessageEvent[]> // subId → this-tick batch
  #topicSeq: Map<string, number>                     // monotonic per topic
  #subscriberSeq: Map<string, number>                // monotonic per subId
  #topicListeners: Map<string, Set<() => void>>
  #subscriberListeners: Map<string, Set<() => void>>

  update(batchBySubscriber: Map<...>, lastByTopic: Map<...>) {
    for (const [id, events] of batchBySubscriber) {
      this.#messagesBySubscriber.set(id, events)
      this.#subscriberSeq.set(id, (this.#subscriberSeq.get(id) ?? 0) + 1)
    }
    for (const [topic, evt] of lastByTopic) {
      this.#lastMessageByTopic.set(topic, evt)
      this.#topicSeq.set(topic, (this.#topicSeq.get(topic) ?? 0) + 1)
    }
    // Notify ONLY changed keys
    for (const topic of lastByTopic.keys())
      this.#topicListeners.get(topic)?.forEach(fn => fn())
    for (const id of batchBySubscriber.keys())
      this.#subscriberListeners.get(id)?.forEach(fn => fn())
  }
}
```

Panels consume via `useMessageBus` hooks (`src/core/pipeline/useMessageBus.ts`):

```ts
useSubscriberSeq(panelId): number  // useSyncExternalStore on subscriberSeq
useTopicSeq(topic): number
```

The hook re-renders the panel whenever the seq increments. The panel then **imperatively** calls `messageBus.getSubscriberMessages(panelId)` or `messageBus.getLastMessage(topic)` to read the actual events. **No event payload ever enters React state.**

## 10. Pipeline emit cadence

Zustand metadata (presence, progress, topics, datatypes, capabilities, currentTime) is pushed by `_emitState()` and throttled (line 577):

```ts
if (now - this._lastPipelineEmitMs < PIPELINE_EMIT_INTERVAL_MS) return;
```

Result: the React tree sees state changes at most 5 Hz, even though the tick loop runs at 30 Hz. The seek path bypasses the throttle.

`currentTime` for high-frequency consumers (playback bar, 3D scene time-cursor) goes through `_notifyTimeSubscribers` (line 599) — a separate ref-based channel that does NOT enter Zustand. Subscribers register via `player.subscribeCurrentTime(cb)` and update the DOM directly.

## 11. Capability flags

`PlayerState.capabilities: PlayerCapability[]` declares what the player supports. `IterablePlayer` always reports:

- `seekBackfill` (always seekable since it's a file player)
- `playbackControl` (play/pause/speed/loop)

It does NOT report:

- `advertise` / `callServices` / `setSpeed` over the wire (no live publishing).
- `setParameters` / `getParameters`.

When a live `Player` impl is added, it should report a different capability set; the pipeline checks capabilities before exposing publish/parameter UI.

## 12. Concurrency hazards

- **No AbortSignal.** Cursor abort goes through `cursor.end()` which sets a flag in the worker pump. Callers `await` the abort.
- `_isFetching` is the lock. There's no scheduling fairness — a slow `nextBatch` will completely stall the next RAF until it resolves.
- Seek during play: `_isFetching` may be true; `_seekAsync` does `_cursor.end()` which still has to await the in-flight fetch. UX impact: seek latency ≥ one slow batch.

## 13. Where to extend

| Want to … | Modify |
|---|---|
| Change tick cadence | `DEFAULT_SAMPLING_FPS` or `setSamplingFps()` |
| Add new lane (e.g., audio) | Extend `HighFrequencyConsumer.lane` union + `_rebuildHighFrequencyConsumerIndex` |
| Range loop (loop region) | Replace `_loop` boolean with start/end pair; check in tick loop |
| Per-subscription preload type | `Subscription.preloadType` already exists; currently treated as `full` |
| Live source | Implement `Player` interface (lines defining the public API) — no inheritance, parallel impl is fine |
| Multi-player time sync | Wrap `IterablePlayer` in a clock-sharing controller; `seek` + `subscribeCurrentTime` are the sync points |
