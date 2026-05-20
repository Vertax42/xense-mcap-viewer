import { describe, expect, it } from 'vitest';
import { toNano } from '@/shared/utils/time';
import { BvhIterableSource } from './BvhIterableSource';

const BVH = `HIERARCHY
ROOT Hips
{
  OFFSET 0 0 0
  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation
  JOINT Knee
  {
    OFFSET 0 -10 0
    CHANNELS 3 Zrotation Yrotation Xrotation
  }
}
MOTION
Frames: 3
Frame Time: 0.1
0 0 0 0 0 0  0 0 0
10 0 0 0 0 0  0 0 0
20 0 0 0 0 0  0 0 0
`;

describe('BvhIterableSource', () => {
  const readEventMessage = (result: unknown): unknown => {
    if (!result || typeof result !== 'object') return undefined;
    const value = (result as { value?: unknown }).value;
    if (!value || typeof value !== 'object') return undefined;
    return (value as { message?: unknown }).message;
  };

  const frameIndexOf = (message: unknown): number => {
    if (!message || typeof message !== 'object') return -1;
    const frameIndex = (message as { frame_index?: unknown }).frame_index;
    return typeof frameIndex === 'number' ? frameIndex : -1;
  };

  it('initializes timeline and emits frame messages', async () => {
    const source = new BvhIterableSource(BVH, 'test');
    const init = await source.initialize();
    expect(init.topics[0]?.name).toBe('/bvh/skeleton');
    expect(init.topics[0]?.messageCount).toBe(3);
    expect(toNano(init.end)).toBe(200000000n);

    const iterator = source.messageIterator({
      startTime: { sec: 0, nsec: 0 },
      topics: ['/bvh/skeleton'],
    });
    const first = await iterator.next();
    const second = await iterator.next();
    const firstMessage = readEventMessage(first);
    expect(frameIndexOf(firstMessage)).toBe(0);
    expect(frameIndexOf(readEventMessage(second))).toBe(1);
  });

  it('returns nearest frame for backfill', async () => {
    const source = new BvhIterableSource(BVH, 'test');
    await source.initialize();
    const backfill = await source.getBackfillMessages({
      time: { sec: 0, nsec: 150_000_000 },
      topics: ['/bvh/skeleton'],
    });
    expect(frameIndexOf(backfill[0]?.message)).toBe(1);
  });
});
