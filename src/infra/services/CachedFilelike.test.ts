import EventEmitter from 'eventemitter3';
import { describe, expect, it, vi } from 'vitest';

import CachedFilelike, { type FileStream, type FileStreamEvents } from './CachedFilelike';

class TestStream extends EventEmitter<FileStreamEvents> implements FileStream {
  public destroyed = false;
  public destroy = vi.fn(() => {
    this.destroyed = true;
  });

  public emitData(data: number[]): void {
    this.emit('data', new Uint8Array(data));
  }
}

class TestFileReader {
  public streams: Array<TestStream & { offset: number; length: number }> = [];

  public async open(): Promise<{ size: number }> {
    return { size: 32 };
  }

  public fetch(offset: number, length: number): FileStream {
    const stream = new TestStream() as TestStream & { offset: number; length: number };
    stream.offset = offset;
    stream.length = length;
    this.streams.push(stream);
    return stream;
  }
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CachedFilelike prefetch', () => {
  it('fills the cache without a foreground read request', async () => {
    const reader = new TestFileReader();
    const filelike = new CachedFilelike({ fileReader: reader, cacheSizeInBytes: 32, fetchBlockSizeInBytes: 4 });

    filelike.prefetch(8, 4);
    await flushAsyncWork();

    expect(reader.streams).toHaveLength(1);
    expect(reader.streams[0].offset).toBe(8);
    expect(reader.streams[0].length).toBe(4);

    reader.streams[0].emitData([1, 2, 3, 4]);
    const data = await filelike.read(8, 4);

    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });

  it('lets foreground reads interrupt an active prefetch', async () => {
    const reader = new TestFileReader();
    const filelike = new CachedFilelike({ fileReader: reader, cacheSizeInBytes: 32, fetchBlockSizeInBytes: 4 });

    filelike.prefetch(16, 4);
    await flushAsyncWork();
    expect(reader.streams).toHaveLength(1);

    const readPromise = filelike.read(0, 4);
    await flushAsyncWork();

    expect(reader.streams[0].destroyed).toBe(true);
    expect(reader.streams).toHaveLength(2);
    expect(reader.streams[1].offset).toBe(0);

    reader.streams[1].emitData([5, 6, 7, 8]);
    await expect(readPromise).resolves.toEqual(new Uint8Array([5, 6, 7, 8]));
  });

  it('extends a matching active prefetch instead of restarting it', async () => {
    const reader = new TestFileReader();
    const filelike = new CachedFilelike({ fileReader: reader, cacheSizeInBytes: 32, fetchBlockSizeInBytes: 4 });

    filelike.prefetch(0, 4, { replace: true });
    await flushAsyncWork();
    expect(reader.streams).toHaveLength(1);

    filelike.prefetch(0, 8, { replace: true });
    await flushAsyncWork();

    expect(reader.streams).toHaveLength(1);
    expect(reader.streams[0].destroyed).toBe(false);

    reader.streams[0].emitData([1, 2, 3, 4]);
    await flushAsyncWork();

    expect(reader.streams).toHaveLength(2);
    expect(reader.streams[1].offset).toBe(4);
    expect(reader.streams[1].length).toBe(4);
  });

  it('fetches aligned blocks for small foreground reads', async () => {
    const reader = new TestFileReader();
    const filelike = new CachedFilelike({ fileReader: reader, cacheSizeInBytes: 32, fetchBlockSizeInBytes: 8 });

    const firstRead = filelike.read(3, 1);
    await flushAsyncWork();

    expect(reader.streams).toHaveLength(1);
    expect(reader.streams[0].offset).toBe(0);
    expect(reader.streams[0].length).toBe(8);

    reader.streams[0].emitData([0, 1, 2, 3, 4, 5, 6, 7]);
    await expect(firstRead).resolves.toEqual(new Uint8Array([3]));

    const secondRead = await filelike.read(7, 1);
    expect(secondRead).toEqual(new Uint8Array([7]));
    expect(reader.streams).toHaveLength(1);
  });

  it('continues an overlapping prefetch when a foreground read needs the same block', async () => {
    const reader = new TestFileReader();
    const filelike = new CachedFilelike({ fileReader: reader, cacheSizeInBytes: 32, fetchBlockSizeInBytes: 8 });

    filelike.prefetch(2, 1);
    await flushAsyncWork();
    expect(reader.streams).toHaveLength(1);
    expect(reader.streams[0].offset).toBe(0);
    expect(reader.streams[0].length).toBe(8);

    const readPromise = filelike.read(3, 1);
    await flushAsyncWork();

    expect(reader.streams).toHaveLength(1);
    expect(reader.streams[0].destroyed).toBe(false);

    reader.streams[0].emitData([0, 1, 2, 3, 4, 5, 6, 7]);
    await expect(readPromise).resolves.toEqual(new Uint8Array([3]));
  });
});
