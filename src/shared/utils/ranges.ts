import { complement, intersect, isBefore, isDuring } from "intervals-fn";

export type Range = {
  /** inclusive */
  start: number;
  /** exclusive */
  end: number;
};

export function isRangeCoveredByRanges(
  queryRange: Range,
  nonOverlappingMergedAndSortedRanges: Range[],
): boolean {
  for (const range of nonOverlappingMergedAndSortedRanges) {
    if (isBefore(queryRange, range)) {
      return false;
    }
    if (isDuring(queryRange, range)) {
      return true;
    }
  }
  return false;
}

// Get the ranges in `bounds` that are NOT covered by `ranges`.
export function missingRanges(bounds: Range, ranges: readonly Range[]): Range[] {
  return complement(bounds, intersect([bounds], ranges));
}
