import { describe, expect, it } from 'vitest';
import type { TimeRange } from '@/core/types/ros';
import { compactTimeRanges, inferProgressTimeRangeCompaction } from './timeRanges';

function range(startSec: number, endSec: number): TimeRange {
  return {
    start: { sec: startSec, nsec: 0 },
    end: { sec: endSec, nsec: 0 },
  };
}

describe('compactTimeRanges', () => {
  it('merges small temporal gaps when they fall under the threshold', () => {
    const result = compactTimeRanges([range(0, 10), range(10, 20), range(21, 30)], {
      maxGapNs: 1_000_000_000n,
    });

    expect(result).toEqual([range(0, 30)]);
  });

  it('preserves large holes between playable segments', () => {
    const result = compactTimeRanges([range(0, 10), range(14, 20)], {
      maxGapNs: 1_000_000_000n,
    });

    expect(result).toEqual([range(0, 10), range(14, 20)]);
  });

  it('merges the smallest gaps first when a range budget is enforced', () => {
    const result = compactTimeRanges([range(0, 10), range(11, 20), range(23, 30), range(31, 40)], {
      maxGapNs: 0n,
      maxRanges: 2,
      maxBudgetMergeGapNs: 3_000_000_000n,
    });

    expect(result).toEqual([range(0, 20), range(23, 40)]);
  });
});

describe('inferProgressTimeRangeCompaction', () => {
  it('returns a positive gap threshold and stable range budget for fragmented coverage', () => {
    const options = inferProgressTimeRangeCompaction(
      [range(0, 10), range(10, 20), range(21, 30), range(31, 40)],
      range(0, 100),
    );

    expect(options.maxGapNs).toBeGreaterThan(0n);
    expect(options.maxRanges).toBe(48);
    expect(options.maxBudgetMergeGapNs).toBeGreaterThanOrEqual(options.maxGapNs);
  });
});
