import { afterEach, describe, expect, it, vi } from 'vitest';
import { IterablePlayer } from './IterablePlayer';
import { messageBus } from '@/core/pipeline/messageBus';
import type { Initialization, MessageEvent } from '@/core/types/ros';
import type { PlayerState } from '@/core/types/player';
import type { WorkerSerializedSource } from '@/infra/workers/WorkerSerializedSource';

const TOPIC = '/camera/front/image/compressed';

function makeInitialization(): Initialization {
  return {
    topics: [{ name: TOPIC, type: 'sensor_msgs/CompressedImage' }],
    datatypes: {},
    start: { sec: 0, nsec: 0 },
    end: { sec: 10, nsec: 0 },
    publishersByTopic: {},
    topicStats: {},
    problems: [],
  };
}

function makeInitializationWithTopicStats(): Initialization {
  return {
    topics: [{ name: TOPIC, type: 'sensor_msgs/CompressedImage' }],
    datatypes: {},
    start: { sec: 0, nsec: 0 },
    end: { sec: 10, nsec: 0 },
    publishersByTopic: {},
    topicStats: {
      [TOPIC]: {
        messageCount: 120,
        frequency: 30,
        durationSec: 4,
      },
    },
    problems: [],
  };
}

function makeImageMessage(): MessageEvent {
  return {
    topic: TOPIC,
    schemaName: 'sensor_msgs/CompressedImage',
    receiveTime: { sec: 1, nsec: 0 },
    publishTime: { sec: 1, nsec: 0 },
    message: {
      format: 'jpeg',
      data: new Uint8Array([1, 2, 3, 4]),
    },
  };
}

function makeSource(messages: MessageEvent[]): WorkerSerializedSource {
  return {
    initialize: vi.fn(async () => makeInitialization()),
    getTransportDiagnostics: vi.fn(async () => ({
      mode: 'transfer',
      crossOriginIsolated: false,
      binaryPayloadThresholdBytes: 64 * 1024,
      droppedPayloads: 0,
      stalePayloadRefs: 0,
    })),
    getLoadProgress: vi.fn(async () => ({
      percent: 100,
      totalBytes: 0,
      downloadedByteRanges: [],
      parsedMessageRanges: [],
    })),
    getBackfillMessages: vi.fn(async () => messages),
    getMessageCursor: vi.fn(),
    getAdjacentMessage: vi.fn(),
    resolveMessageBatch: vi.fn((batch: MessageEvent[]) => batch),
    resolveMessageForHighFrequencyLane: vi.fn((message: MessageEvent) => message),
    terminate: vi.fn(),
    getTransportMode: vi.fn(() => 'transfer'),
    getTransportFallbackReason: vi.fn(() => undefined),
  } as unknown as WorkerSerializedSource;
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  messageBus.reset();
});

describe('IterablePlayer high-frequency lane', () => {
  it('routes video-only topics outside the generic message bus', async () => {
    const source = makeSource([makeImageMessage()]);
    const player = new IterablePlayer(source);
    const onLatestMessage = vi.fn();

    await player.initialize({});
    player.registerHighFrequencyConsumer('image-panel', {
      topic: TOPIC,
      lane: 'video',
      onLatestMessage,
    });
    await flushAsyncWork();

    expect(onLatestMessage).toHaveBeenCalledTimes(1);
    expect(source.resolveMessageForHighFrequencyLane).toHaveBeenCalledWith(
      expect.objectContaining({ topic: TOPIC }),
      { preferSharedView: true, copyPayload: false },
    );
    expect(messageBus.getLastMessage(TOPIC)).toBeNull();
    expect(source.getBackfillMessages).toHaveBeenCalledWith({
      time: { sec: 0, nsec: 0 },
      topics: [TOPIC],
    });

    player.close();
  });

  it('keeps shared topics on the generic lane when a normal subscriber exists', async () => {
    const source = makeSource([makeImageMessage()]);
    const player = new IterablePlayer(source);
    const onLatestMessage = vi.fn();

    await player.initialize({});
    player.registerSubscriptions('raw-panel', [{ topic: TOPIC, subscriberId: 'raw-panel' }]);
    await flushAsyncWork();
    player.registerHighFrequencyConsumer('image-panel', {
      topic: TOPIC,
      lane: 'video',
      onLatestMessage,
    });
    await flushAsyncWork();

    expect(onLatestMessage).toHaveBeenCalled();
    expect(source.resolveMessageForHighFrequencyLane).toHaveBeenCalledWith(
      expect.objectContaining({ topic: TOPIC }),
      { preferSharedView: false, copyPayload: true },
    );
    expect(messageBus.getLastMessage(TOPIC)).not.toBeNull();
    expect(messageBus.getSubscriberMessages('raw-panel')).toHaveLength(1);

    player.close();
  });

  it('isolates payloads when multiple video consumers share one topic', async () => {
    const source = makeSource([makeImageMessage()]);
    const player = new IterablePlayer(source);
    const firstConsumer = vi.fn();
    const secondConsumer = vi.fn();

    await player.initialize({});
    player.registerHighFrequencyConsumer('image-panel-a', {
      topic: TOPIC,
      lane: 'video',
      onLatestMessage: firstConsumer,
    });
    player.registerHighFrequencyConsumer('image-panel-b', {
      topic: TOPIC,
      lane: 'video',
      onLatestMessage: secondConsumer,
    });
    await flushAsyncWork();

    expect(firstConsumer).toHaveBeenCalled();
    expect(secondConsumer).toHaveBeenCalled();
    expect(source.resolveMessageForHighFrequencyLane).toHaveBeenLastCalledWith(
      expect.objectContaining({ topic: TOPIC }),
      { preferSharedView: false, copyPayload: true },
    );

    player.close();
  });

  it('delivers ordered high-frequency batches without marking the topic latest-only', async () => {
    const oldRequestAnimationFrame = globalThis.requestAnimationFrame;
    const oldCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      setTimeout(() => cb(performance.now()), 0);
      return 1;
    };
    globalThis.cancelAnimationFrame = vi.fn() as typeof cancelAnimationFrame;
    const first = makeImageMessage();
    const second = {
      ...makeImageMessage(),
      receiveTime: { sec: 2, nsec: 0 },
    };
    const source = makeSource([first]);
    const cursor = {
      nextBatch: vi.fn(async () => [first, second]),
      end: vi.fn(),
    };
    vi.mocked(source.getMessageCursor).mockResolvedValue(cursor as never);
    const player = new IterablePlayer(source);
    const onMessageBatch = vi.fn();

    try {
      await player.initialize({});
      player.registerHighFrequencyConsumer('image-panel', {
        topic: TOPIC,
        lane: 'video',
        mode: 'all',
        onMessageBatch,
      });
      await flushAsyncWork();
      player.play();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await flushAsyncWork();

      expect(source.getMessageCursor).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: [TOPIC],
          latestOnlyTopics: [],
        }),
      );
      expect(onMessageBatch).toHaveBeenCalledWith([
        expect.objectContaining({ topic: TOPIC }),
        expect.objectContaining({ receiveTime: { sec: 2, nsec: 0 } }),
      ]);
    } finally {
      player.close();
      globalThis.requestAnimationFrame = oldRequestAnimationFrame;
      globalThis.cancelAnimationFrame = oldCancelAnimationFrame;
    }
  });
});

describe('IterablePlayer topic metadata', () => {
  it('merges duration and count from topic stats into active topics', async () => {
    const source = {
      initialize: vi.fn(async () => makeInitializationWithTopicStats()),
      getTransportDiagnostics: vi.fn(async () => ({
        mode: 'transfer',
        crossOriginIsolated: false,
        binaryPayloadThresholdBytes: 64 * 1024,
        droppedPayloads: 0,
        stalePayloadRefs: 0,
      })),
      getLoadProgress: vi.fn(async () => ({
        percent: 100,
        totalBytes: 0,
        downloadedByteRanges: [],
        parsedMessageRanges: [],
      })),
      getBackfillMessages: vi.fn(async () => []),
      getMessageCursor: vi.fn(),
      getAdjacentMessage: vi.fn(),
      resolveMessageBatch: vi.fn((batch: MessageEvent[]) => batch),
      resolveMessageForHighFrequencyLane: vi.fn((message: MessageEvent) => message),
      terminate: vi.fn(),
      getTransportMode: vi.fn(() => 'transfer'),
      getTransportFallbackReason: vi.fn(() => undefined),
    } as unknown as WorkerSerializedSource;

    const player = new IterablePlayer(source);
    let latestState: PlayerState | undefined;
    player.setListener((state) => {
      latestState = state;
    });

    await player.initialize({});

    expect(latestState).toBeDefined();
    expect(latestState!.activeData?.topics).toEqual([
      expect.objectContaining({
        name: TOPIC,
        messageCount: 120,
        frequency: 30,
        durationSec: 4,
      }),
    ]);

    player.close();
  });
});
