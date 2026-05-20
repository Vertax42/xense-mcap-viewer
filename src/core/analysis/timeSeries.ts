import type { MessageEvent, Time } from '@/core/types/ros';

export type TimestampMode = 'receiveTime' | 'headerStamp' | 'publishTime';
export type DownsampleMode = 'none' | 'minMaxLast';
export type TimestampFallbackReason =
  | 'missingHeaderStamp'
  | 'missingPublishTime'
  | 'missingCustomPath'
  | 'invalidCustomPath';

export interface NumericPoint {
  x: number;
  y: number | null;
}

export interface TimestampResolution {
  time: Time;
  source: TimestampMode | 'customField';
  fallbackReason?: TimestampFallbackReason;
}

/** Convert a ROS `Time` to fractional seconds. */
export function timeToSec(time: Time): number {
  return time.sec + time.nsec / 1e9;
}

/** Convert a ROS `Time` to nanoseconds as a bigint for lossless comparison. */
export function timeToNs(time: Time): bigint {
  return BigInt(time.sec) * 1_000_000_000n + BigInt(time.nsec);
}

/** Extract `header.stamp` from a message, returning undefined if absent. */
export function readHeaderStamp(message: unknown): Time | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const header = (message as Record<string, unknown>).header;
  if (!header || typeof header !== 'object') return undefined;
  const stamp = (header as Record<string, unknown>).stamp;
  if (!stamp || typeof stamp !== 'object') return undefined;
  const sec = (stamp as Record<string, unknown>).sec;
  const nsec = (stamp as Record<string, unknown>).nsec ?? (stamp as Record<string, unknown>).nanosec;
  if (typeof sec === 'number' && typeof nsec === 'number') {
    return { sec, nsec };
  }
  return undefined;
}

export function getEventTimestamp(event: MessageEvent, mode: TimestampMode): Time {
  if (mode === 'publishTime') {
    return event.publishTime ?? event.receiveTime;
  }
  if (mode === 'headerStamp') {
    return readHeaderStamp(event.message) ?? event.receiveTime;
  }
  return event.receiveTime;
}

function readPathValue(input: unknown, path: string): unknown {
  if (!input || typeof input !== 'object' || !path) return undefined;
  let current: unknown = input;
  for (const segment of path.split('.')) {
    if (!segment) continue;
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function readCustomTimestamp(message: unknown, path: string): Time | undefined {
  if (!path) return undefined;
  const value = readPathValue(message, path);
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const sec = record.sec;
  const nsec = record.nsec ?? record.nanosec;
  return typeof sec === 'number' && typeof nsec === 'number' ? { sec, nsec } : undefined;
}

/**
 * Resolve the effective timestamp for a message event, following the priority:
 * custom field path → requested mode → receiveTime fallback.
 * Sets `fallbackReason` when the preferred source was unavailable.
 */
export function resolveEventTimestamp(
  event: MessageEvent,
  mode: TimestampMode,
  customFieldPath?: string,
): TimestampResolution {
  if (customFieldPath && customFieldPath.length > 0) {
    const custom = readCustomTimestamp(event.message, customFieldPath);
    if (custom) {
      return { time: custom, source: 'customField' };
    }
    return { time: event.receiveTime, source: 'receiveTime', fallbackReason: 'missingCustomPath' };
  }
  if (mode === 'headerStamp') {
    const headerStamp = readHeaderStamp(event.message);
    if (headerStamp) {
      return { time: headerStamp, source: 'headerStamp' };
    }
    return { time: event.receiveTime, source: 'receiveTime', fallbackReason: 'missingHeaderStamp' };
  }
  if (mode === 'publishTime') {
    if (event.publishTime) {
      return { time: event.publishTime, source: 'publishTime' };
    }
    return { time: event.receiveTime, source: 'receiveTime', fallbackReason: 'missingPublishTime' };
  }
  return { time: event.receiveTime, source: 'receiveTime' };
}

/**
 * Downsample `points` to at most `maxPoints` using a min/max/last strategy:
 * each bucket contributes up to three representative points (minimum, maximum,
 * and the last value) so the envelope shape of the series is preserved.
 *
 * When the result still exceeds `maxPoints`, the oldest points are dropped to
 * retain the most recent data (optimised for live streaming dashboards).
 */
export function downsampleMinMaxLast(points: NumericPoint[], maxPoints: number): NumericPoint[] {
  if (maxPoints <= 0 || points.length <= maxPoints) return points;
  const bucketCount = Math.max(1, Math.floor(maxPoints / 3));
  const bucketSize = Math.ceil(points.length / bucketCount);
  const out: NumericPoint[] = [];
  for (let start = 0; start < points.length; start += bucketSize) {
    const bucket = points.slice(start, start + bucketSize).filter((point) => point.y != null);
    if (bucket.length === 0) continue;
    let min = bucket[0];
    let max = bucket[0];
    for (const point of bucket) {
      if ((point.y ?? 0) < (min.y ?? 0)) min = point;
      if ((point.y ?? 0) > (max.y ?? 0)) max = point;
    }
    const last = bucket[bucket.length - 1];
    for (const point of [min, max, last].sort((a, b) => a.x - b.x)) {
      const previous = out[out.length - 1];
      if (!previous || previous.x !== point.x || previous.y !== point.y) {
        out.push(point);
      }
    }
  }
  // Retain the most recent points when the downsampled result still overshoots.
  return out.length > maxPoints ? out.slice(out.length - maxPoints) : out;
}
