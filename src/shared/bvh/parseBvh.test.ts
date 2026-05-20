import { describe, expect, it } from 'vitest';
import { parseBvhFile } from './parseBvh';

const SIMPLE_BVH = `HIERARCHY
ROOT Hips
{
  OFFSET 0 0 0
  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation
  JOINT Knee
  {
    OFFSET 0 -10 0
    CHANNELS 3 Zrotation Yrotation Xrotation
    End Site
    {
      OFFSET 0 -5 0
    }
  }
}
MOTION
Frames: 2
Frame Time: 0.033333
0 0 0 0 0 0  0 0 0
1 2 3 10 20 30  40 50 60
`;

const ALL_JOINTS_WITH_TRANSLATION = `HIERARCHY
ROOT Root
{
  OFFSET 0 100 0
  CHANNELS 6 Xposition Yposition Zposition Yrotation Xrotation Zrotation
  JOINT Child
  {
    OFFSET 0 -50 0
    CHANNELS 6 Xposition Yposition Zposition Yrotation Xrotation Zrotation
  }
}
MOTION
Frames: 1
Frame Time: 0.01
0 100 0 0 0 0  0 -50 0 0 0 0
`;

describe('parseBvhFile', () => {
  it('parses hierarchy, channels and frames', () => {
    const parsed = parseBvhFile(SIMPLE_BVH);
    expect(parsed.root.name).toBe('Hips');
    expect(parsed.root.children[0]?.name).toBe('Knee');
    expect(parsed.channelCount).toBe(9);
    expect(parsed.frameCount).toBe(2);
    expect(parsed.frameTimeSec).toBeCloseTo(0.033333, 6);
    expect(parsed.frames[1]?.slice(0, 6)).toEqual([1, 2, 3, 10, 20, 30]);
  });

  it('supports non-standard child 6-channel files', () => {
    const parsed = parseBvhFile(ALL_JOINTS_WITH_TRANSLATION);
    expect(parsed.channelCount).toBe(12);
    expect(parsed.frameCount).toBe(1);
    expect(parsed.warnings.length).toBe(0);
  });
});
