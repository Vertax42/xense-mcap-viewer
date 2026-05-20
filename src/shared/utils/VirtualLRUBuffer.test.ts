import { describe, expect, it } from 'vitest';
import VirtualLRUBuffer from './VirtualLRUBuffer';

describe('VirtualLRUBuffer', () => {
  it('slice returns a stable copy for a single-block range', () => {
    const buffer = new VirtualLRUBuffer({ size: 16, blockSize: 8 });
    buffer.copyFrom(new Uint8Array([1, 2, 3, 4]), 0);

    const copy = buffer.slice(0, 4);
    buffer.copyFrom(new Uint8Array([9, 9, 9, 9]), 0);

    expect(Array.from(copy)).toEqual([1, 2, 3, 4]);
  });

  it('viewOrSlice returns a live view for a single-block range', () => {
    const buffer = new VirtualLRUBuffer({ size: 16, blockSize: 8 });
    buffer.copyFrom(new Uint8Array([1, 2, 3, 4]), 0);

    const view = buffer.viewOrSlice(0, 4);
    buffer.copyFrom(new Uint8Array([9, 9, 9, 9]), 0);

    expect(Array.from(view)).toEqual([9, 9, 9, 9]);
  });

  it('viewOrSlice falls back to a stable copy for cross-block ranges', () => {
    const buffer = new VirtualLRUBuffer({ size: 16, blockSize: 4 });
    buffer.copyFrom(new Uint8Array([1, 2, 3, 4, 5, 6]), 2);

    const copy = buffer.viewOrSlice(2, 8);
    buffer.copyFrom(new Uint8Array([9, 9, 9, 9, 9, 9]), 2);

    expect(Array.from(copy)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('removes evicted blocks from readable ranges', () => {
    const buffer = new VirtualLRUBuffer({ size: 32, blockSize: 8, numberOfBlocks: 3 });
    buffer.copyFrom(new Uint8Array(24).fill(1), 0);

    // Accessing the first block again makes the middle block least recently used.
    buffer.slice(0, 1);
    buffer.copyFrom(new Uint8Array(8).fill(2), 24);

    expect(buffer.getRangesWithData()).toEqual([
      { start: 0, end: 8 },
      { start: 16, end: 32 },
    ]);
    expect(buffer.hasData(0, 32)).toBe(false);
    expect(buffer.hasData(16, 32)).toBe(true);
  });
});

