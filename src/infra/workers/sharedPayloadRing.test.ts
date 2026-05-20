import { describe, expect, it } from 'vitest';
import { createSharedPayloadRingConfig, SharedPayloadRing } from './sharedPayloadRing';

describe('SharedPayloadRing', () => {
  it('returns a stable copy after later writes reuse the slot', () => {
    const config = createSharedPayloadRingConfig(8, 4);
    const ring = new SharedPayloadRing(config);

    const first = new Uint8Array([1, 2, 3, 4]);
    const second = new Uint8Array([9, 8, 7, 6]);

    const firstRef = ring.write(first);
    expect(firstRef).not.toBeNull();

    const firstRead = ring.read(firstRef!);
    expect(firstRead).not.toBeNull();
    expect(Array.from(firstRead!)).toEqual([1, 2, 3, 4]);

    const secondRef = ring.write(second);
    expect(secondRef).not.toBeNull();

    expect(Array.from(firstRead!)).toEqual([1, 2, 3, 4]);
    expect(Array.from(ring.read(secondRef!)!)).toEqual([9, 8, 7, 6]);
  });

  it('returns a live view for fresh refs and expires overwritten refs', () => {
    const config = createSharedPayloadRingConfig(8, 4);
    const ring = new SharedPayloadRing(config);

    const firstRef = ring.write(new Uint8Array([1, 2, 3, 4]));
    expect(firstRef).not.toBeNull();

    const firstView = ring.view(firstRef!);
    expect(firstView).not.toBeNull();
    expect(Array.from(firstView!)).toEqual([1, 2, 3, 4]);

    for (let i = 1; i <= config.slotCount; i++) {
      ring.write(new Uint8Array([i, i, i, i]));
    }

    expect(ring.isRefLive(firstRef!)).toBe(false);
    expect(ring.view(firstRef!)).toBeNull();
    expect(ring.read(firstRef!)).toBeNull();
    expect(Array.from(firstView!)).toEqual([
      config.slotCount,
      config.slotCount,
      config.slotCount,
      config.slotCount,
    ]);
  });

  it('uses ref length to hide stale bytes after shorter writes reuse a slot', () => {
    const config = createSharedPayloadRingConfig(8, 4);
    const ring = new SharedPayloadRing(config);

    ring.write(new Uint8Array([1, 2, 3, 4]));
    for (let i = 1; i < config.slotCount; i++) {
      ring.write(new Uint8Array([0]));
    }
    const shortRef = ring.write(new Uint8Array([9]));

    expect(shortRef).not.toBeNull();
    expect(Array.from(ring.view(shortRef!)!)).toEqual([9]);
    expect(Array.from(ring.read(shortRef!)!)).toEqual([9]);
  });
});
