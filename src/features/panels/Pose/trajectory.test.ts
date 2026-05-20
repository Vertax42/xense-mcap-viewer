import { describe, expect, it } from 'vitest';
import { buildTrajectoryLineBands } from './trajectory';

describe('buildTrajectoryLineBands', () => {
  it('returns empty when there are fewer than 2 points', () => {
    expect(buildTrajectoryLineBands([], 1, 3)).toEqual([]);
    expect(buildTrajectoryLineBands([[0, 0, 0]], 1, 3)).toEqual([]);
  });

  it('builds increasing line widths from old to new', () => {
    const points: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
      [4, 0, 0],
    ];
    const bands = buildTrajectoryLineBands(points, 1, 5, 4);
    expect(bands.length).toBeGreaterThan(0);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i].width).toBeGreaterThanOrEqual(bands[i - 1].width);
    }
    expect(bands[0].width).toBeGreaterThanOrEqual(1);
    expect(bands[bands.length - 1].width).toBeLessThanOrEqual(5);
  });
});
