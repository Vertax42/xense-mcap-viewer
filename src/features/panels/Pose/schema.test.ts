import { describe, expect, it } from 'vitest';
import { parsePoseConfig } from './schema';

describe('parsePoseConfig', () => {
  it('returns defaults for invalid input', () => {
    const parsed = parsePoseConfig(undefined);
    expect(parsed.historySec).toBe(30);
    expect(parsed.frameMode).toBe('raw');
  });

  it('sanitizes numeric fields and keeps valid topics', () => {
    const parsed = parsePoseConfig({
      historySec: 9999,
      minLineWidth: -1,
      maxLineWidth: 999,
      orientationScale: 999,
      frameMode: 'tfAligned',
      targetFrame: 'base_link',
      topics: [
        { topic: '/io/pose/Left_Gripper', color: '#38bdf8', enabled: true },
        { topic: '', enabled: true },
      ],
    });
    expect(parsed.historySec).toBe(3600);
    expect(parsed.minLineWidth).toBe(0.5);
    expect(parsed.maxLineWidth).toBe(30);
    expect(parsed.orientationScale).toBe(2);
    expect(parsed.frameMode).toBe('tfAligned');
    expect(parsed.targetFrame).toBe('base_link');
    expect(parsed.topics).toHaveLength(1);
    expect(parsed.topics[0]?.topic).toBe('/io/pose/Left_Gripper');
  });
});
