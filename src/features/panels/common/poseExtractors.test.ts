import { describe, expect, it } from 'vitest';
import {
  extractPathPoints2,
  extractPathPoints3,
  readPoseStampedFrameId,
  readPoseStampedOrientation,
  readPoseStampedPosition2,
  readPoseStampedPosition3,
} from './poseExtractors';

describe('poseExtractors', () => {
  const poseStamped = {
    header: { frame_id: 'left_gripper' },
    pose: {
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
    },
  };

  it('reads position and orientation from PoseStamped', () => {
    expect(readPoseStampedPosition3(poseStamped)).toEqual([1, 2, 3]);
    expect(readPoseStampedPosition2(poseStamped)).toEqual({ x: 1, y: 2 });
    expect(readPoseStampedOrientation(poseStamped)).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(readPoseStampedFrameId(poseStamped)).toBe('left_gripper');
  });

  it('handles nested pose.pose structure', () => {
    const nested = {
      pose: {
        pose: {
          position: { x: 4, y: 5, z: 6 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      },
    };
    expect(readPoseStampedPosition3(nested)).toEqual([4, 5, 6]);
    expect(readPoseStampedOrientation(nested)).toEqual([0, 0, 0, 1]);
  });

  it('extracts path points from poses array', () => {
    const path = {
      poses: [{ pose: { position: { x: 1, y: 2, z: 3 } } }, { pose: { position: { x: 4, y: 5, z: 6 } } }],
    };
    expect(extractPathPoints3(path)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(extractPathPoints2(path)).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 5 },
    ]);
  });

  it('returns empty results for invalid shapes', () => {
    expect(readPoseStampedPosition3({})).toBeUndefined();
    expect(readPoseStampedOrientation({ pose: { orientation: { x: 1, y: 2, z: 3 } } })).toBeUndefined();
    expect(extractPathPoints3({ poses: [null, {}] })).toEqual([]);
  });
});
