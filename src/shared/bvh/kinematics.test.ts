import { describe, expect, it } from 'vitest';
import { buildBvhLayout, parseBvhFile, sampleBvhFrame } from './index';
import { transformBvhPointToScene } from './coordinates';

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
Frames: 1
Frame Time: 0.033333
100 200 300 0 0 0  0 0 0
`;

describe('bvh kinematics', () => {
  it('computes world joint positions in BVH coordinates', () => {
    const parsed = parseBvhFile(BVH);
    const layout = buildBvhLayout(parsed);
    const joints = sampleBvhFrame(layout, 0);
    expect(joints[0]?.position).toEqual([100, 200, 300]);
    expect(joints[1]?.position).toEqual([100, 190, 300]);
  });

  it('converts Y-up centimeters to Z-up meters', () => {
    const transformed = transformBvhPointToScene([100, 200, 300], {
      scale: 0.01,
      yUpToZUp: true,
      flipY: true,
    });
    expect(transformed).toEqual([1, 3, 2]);
  });
});
