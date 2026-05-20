import type { TimeRange } from '@/core/types/ros';
import { fromNano, toNano } from '@/shared/utils/time';

export interface CompactTimeRangesOptions {
  /** Merge gaps no larger than this threshold during the first pass. */
  maxGapNs?: bigint;
  /**
   * Soft cap for the resulting range count. When exceeded, the smallest gaps
   * are merged until the budget is met or the next gap is too large.
   */
  maxRanges?: number;
  /** Upper bound for the budget-driven merge pass. */
  maxBudgetMergeGapNs?: bigint;
}

const MIN_GAP_NS = 10_000_000n; // 10ms
const MAX_STRUCTURAL_GAP_NS = 750_000_000n; // 750ms
const MAX_BUDGET_GAP_NS = 5_000_000_000n; // 5s

export function compactTimeRanges(
  ranges: readonly TimeRange[],
  options: CompactTimeRangesOptions = {},
): TimeRange[] {
  const normalized = normalizeTimeRanges(ranges);
  if (normalized.length <= 1) {
    return normalized;
  }

  const merged = mergeSortedTimeRanges(normalized, options.maxGapNs ?? 0n);
  const maxRanges = options.maxRanges;
  if (maxRanges == undefined || maxRanges < 1 || merged.length <= maxRanges) {
    return merged;
  }

  const maxBudgetMergeGapNs = options.maxBudgetMergeGapNs ?? options.maxGapNs ?? 0n;
  return mergeSmallestGapsToBudget(merged, maxRanges, maxBudgetMergeGapNs);
}

export function inferProgressTimeRangeCompaction(
  ranges: readonly TimeRange[],
  timeline?: TimeRange,
): Required<CompactTimeRangesOptions> {
  const normalized = normalizeTimeRanges(ranges);
  if (normalized.length <= 1) {
    return {
      maxGapNs: 0n,
      maxRanges: 1,
      maxBudgetMergeGapNs: 0n,
    };
  }

  const durations = normalized
    .map((range) => toNano(range.end) - toNano(range.start))
    .filter((duration) => duration > 0n)
    .sort(compareBigInt);
  const gaps = collectPositiveGaps(normalized).sort(compareBigInt);

  const inferredStart = timeline?.start ?? normalized[0].start;
  const inferredEnd = timeline?.end ?? normalized[normalized.length - 1].end;
  const totalSpanNs = positiveOrZero(toNano(inferredEnd) - toNano(inferredStart));

  const medianDurationNs = percentileBigInt(durations, 0.5) ?? 0n;
  const p75GapNs = percentileBigInt(gaps, 0.75) ?? 0n;

  const maxGapNs = clampBigInt(
    maxBigInt(totalSpanNs / 5000n, medianDurationNs / 4n, p75GapNs * 3n),
    MIN_GAP_NS,
    MAX_STRUCTURAL_GAP_NS,
  );

  const maxBudgetMergeGapNs = clampBigInt(
    maxBigInt(maxGapNs, totalSpanNs / 400n),
    maxGapNs,
    MAX_BUDGET_GAP_NS,
  );

  return {
    maxGapNs,
    maxRanges: 48,
    maxBudgetMergeGapNs,
  };
}

function normalizeTimeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  return ranges
    .map((range) => {
      const startNs = toNano(range.start);
      const endNs = toNano(range.end);
      if (endNs <= startNs) {
        return undefined;
      }
      return {
        start: fromNano(startNs),
        end: fromNano(endNs),
      };
    })
    .filter((range): range is TimeRange => range != undefined)
    .sort((a, b) => compareBigInt(toNano(a.start), toNano(b.start)));
}

function mergeSortedTimeRanges(ranges: readonly TimeRange[], maxGapNs: bigint): TimeRange[] {
  const merged: TimeRange[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(cloneRange(range));
      continue;
    }

    const previousEndNs = toNano(previous.end);
    const nextStartNs = toNano(range.start);
    const gapNs = nextStartNs - previousEndNs;
    if (gapNs <= maxGapNs) {
      const nextEndNs = toNano(range.end);
      if (nextEndNs > previousEndNs) {
        previous.end = fromNano(nextEndNs);
      }
      continue;
    }

    merged.push(cloneRange(range));
  }
  return merged;
}

function mergeSmallestGapsToBudget(
  ranges: TimeRange[],
  maxRanges: number,
  maxBudgetMergeGapNs: bigint,
): TimeRange[] {
  const compacted = ranges.map(cloneRange);
  while (compacted.length > maxRanges) {
    let bestGapNs: bigint | undefined;
    let bestIndex = -1;

    for (let index = 0; index < compacted.length - 1; index++) {
      const current = compacted[index];
      const next = compacted[index + 1];
      const gapNs = toNano(next.start) - toNano(current.end);
      if (gapNs < 0n) {
        bestGapNs = 0n;
        bestIndex = index;
        break;
      }
      if (bestGapNs == undefined || gapNs < bestGapNs) {
        bestGapNs = gapNs;
        bestIndex = index;
      }
    }

    if (bestGapNs == undefined || bestIndex < 0 || bestGapNs > maxBudgetMergeGapNs) {
      break;
    }

    compacted[bestIndex] = {
      start: compacted[bestIndex].start,
      end: compacted[bestIndex + 1].end,
    };
    compacted.splice(bestIndex + 1, 1);
  }

  return compacted;
}

function collectPositiveGaps(ranges: readonly TimeRange[]): bigint[] {
  const gaps: bigint[] = [];
  for (let index = 0; index < ranges.length - 1; index++) {
    const gapNs = toNano(ranges[index + 1].start) - toNano(ranges[index].end);
    if (gapNs > 0n) {
      gaps.push(gapNs);
    }
  }
  return gaps;
}

function percentileBigInt(values: readonly bigint[], percentile: number): bigint | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const clamped = Math.max(0, Math.min(1, percentile));
  const index = Math.min(values.length - 1, Math.floor((values.length - 1) * clamped));
  return values[index];
}

function cloneRange(range: TimeRange): TimeRange {
  return {
    start: { ...range.start },
    end: { ...range.end },
  };
}

function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function maxBigInt(...values: bigint[]): bigint {
  let current = values[0] ?? 0n;
  for (const value of values) {
    if (value > current) {
      current = value;
    }
  }
  return current;
}

function positiveOrZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

function compareBigInt(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
