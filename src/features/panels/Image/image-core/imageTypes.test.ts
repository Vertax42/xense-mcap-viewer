import { describe, expect, it } from 'vitest';
import {
  getCompressedKind,
  isRawImageTopicSchema,
  normalizeCompressedMime,
  prepareImageWorkerBytes,
  snapshotBytes,
} from './imageTypes';

describe('snapshotBytes', () => {
  it('reuses a stable full-span Uint8Array', () => {
    const input = new Uint8Array([1, 2, 3]);
    expect(snapshotBytes(input)).toBe(input);
  });

  it('copies SharedArrayBuffer-backed views', () => {
    const shared = new SharedArrayBuffer(4);
    const input = new Uint8Array(shared);
    input.set([4, 5, 6, 7]);

    const snapshot = snapshotBytes(input);

    expect(snapshot).not.toBeNull();
    expect(snapshot).not.toBe(input);
    expect(Array.from(snapshot!)).toEqual([4, 5, 6, 7]);

    input[0] = 9;
    expect(Array.from(snapshot!)).toEqual([4, 5, 6, 7]);
  });

  it('copies sliced views to avoid retaining oversized buffers', () => {
    const input = new Uint8Array(new ArrayBuffer(8), 2, 3);
    input.set([7, 8, 9]);

    const snapshot = snapshotBytes(input);

    expect(snapshot).not.toBeNull();
    expect(snapshot).not.toBe(input);
    expect(Array.from(snapshot!)).toEqual([7, 8, 9]);
  });
});

describe('isRawImageTopicSchema', () => {
  it('accepts ROS 1/2 raw Image schemas', () => {
    expect(isRawImageTopicSchema('sensor_msgs/msg/Image')).toBe(true);
    expect(isRawImageTopicSchema('sensor_msgs/Image')).toBe(true);
  });

  it('rejects CompressedImage', () => {
    expect(isRawImageTopicSchema('sensor_msgs/msg/CompressedImage')).toBe(false);
    expect(isRawImageTopicSchema('sensor_msgs/CompressedImage')).toBe(false);
  });

  it('rejects unrelated types', () => {
    expect(isRawImageTopicSchema('')).toBe(false);
    expect(isRawImageTopicSchema('sensor_msgs/msg/CameraInfo')).toBe(false);
  });
});

describe('normalizeCompressedMime', () => {
  it('falls back to JPEG for raw-style format tokens on CompressedImage', () => {
    expect(getCompressedKind('bgr8')).toBeNull();
    expect(normalizeCompressedMime('bgr8')).toBe('image/jpeg');
    expect(normalizeCompressedMime('rgb8')).toBe('image/jpeg');
  });

  it('still recognizes explicit codec hints in compound format strings', () => {
    expect(normalizeCompressedMime('rgb8; jpeg compressed bgr8')).toBe('image/jpeg');
    expect(normalizeCompressedMime('image/png')).toBe('image/png');
  });
});

describe('prepareImageWorkerBytes', () => {
  it('copies SharedArrayBuffer-backed views before crossing into the render worker', () => {
    const shared = new SharedArrayBuffer(4);
    const input = new Uint8Array(shared);
    input.set([1, 2, 3, 4]);

    const prepared = prepareImageWorkerBytes(input);

    expect(prepared).not.toBeNull();
    expect(prepared!.data).not.toBe(input);
    expect(prepared!.data.buffer).not.toBe(shared);
    expect(prepared!.transfer).toEqual([prepared!.data.buffer]);
    expect(Array.from(prepared!.data)).toEqual([1, 2, 3, 4]);

    input[0] = 9;
    expect(prepared!.data[0]).toBe(1);
  });

  it('copies full ArrayBuffer-backed views so worker transfer cannot detach source messages', () => {
    const input = new Uint8Array([1, 2, 3]);

    const prepared = prepareImageWorkerBytes(input);

    expect(prepared).not.toBeNull();
    expect(prepared!.data).not.toBe(input);
    expect(prepared!.data.buffer).not.toBe(input.buffer);
    expect(prepared!.transfer).toEqual([prepared!.data.buffer]);
    expect(Array.from(prepared!.data)).toEqual([1, 2, 3]);
  });

  it('copies sliced ArrayBuffer-backed views into a compact transfer buffer', () => {
    const input = new Uint8Array(new ArrayBuffer(8), 2, 3);
    input.set([7, 8, 9]);

    const prepared = prepareImageWorkerBytes(input);

    expect(prepared).not.toBeNull();
    expect(prepared!.data).not.toBe(input);
    expect(prepared!.data.byteOffset).toBe(0);
    expect(prepared!.data.byteLength).toBe(3);
    expect(prepared!.transfer).toEqual([prepared!.data.buffer]);
    expect(Array.from(prepared!.data)).toEqual([7, 8, 9]);
  });
});
