export type TrajectoryLineBand = {
  key: string;
  width: number;
  points: Array<[number, number, number]>;
};

export function buildTrajectoryLineBands(
  points: Array<[number, number, number]>,
  minWidth: number,
  maxWidth: number,
  bandCount = 6,
): TrajectoryLineBand[] {
  if (points.length < 2) return [];
  const segmentCount = points.length - 1;
  const normalizedMin = Math.max(0.5, Math.min(minWidth, maxWidth));
  const normalizedMax = Math.max(normalizedMin, maxWidth);
  const bands: TrajectoryLineBand[] = [];
  for (let index = 0; index < bandCount; index += 1) {
    const startSegment = Math.floor((index / bandCount) * segmentCount);
    const endSegment = Math.floor(((index + 1) / bandCount) * segmentCount);
    const startPoint = Math.max(0, Math.min(points.length - 2, startSegment));
    const endPoint = Math.max(startPoint + 1, Math.min(points.length - 1, endSegment + 1));
    const slice = points.slice(startPoint, endPoint + 1);
    if (slice.length < 2) continue;
    const ratio = (index + 1) / bandCount;
    bands.push({
      key: `${index}:${startPoint}:${endPoint}`,
      width: normalizedMin + (normalizedMax - normalizedMin) * ratio,
      points: slice,
    });
  }
  return bands;
}
