import { toNano } from '@/shared/utils/time';
import type { DataQualityExplainPayload, DataQualityIssueRange } from './types';

function rangeStartNs(range: DataQualityIssueRange): bigint {
  return toNano(range.start);
}

function rangeEndNs(range: DataQualityIssueRange): bigint {
  return toNano(range.end);
}

export function adaptiveMergeWindowNs(range: DataQualityIssueRange): bigint {
  const baseline = range.summaryStats?.baselineIntervalNs;
  const b = baseline != undefined && baseline !== '' ? BigInt(baseline) : 33_333_333n;
  const raw = b * 50n;
  const minW = 500_000_000n;
  const maxW = 2_000_000_000n;
  if (raw < minW) return minW;
  if (raw > maxW) return maxW;
  return raw;
}

function mergeKey(range: DataQualityIssueRange): string {
  return `${range.type}|${range.topicNames[0] ?? ''}`;
}

function cloneEvidenceWindow(
  window: DataQualityIssueRange['evidenceWindow'],
): DataQualityIssueRange['evidenceWindow'] {
  return {
    beforeNormal: [...window.beforeNormal],
    anomaly: [...window.anomaly],
    afterNormal: [...window.afterNormal],
  };
}

function cloneTopicEvidence(
  map?: Record<string, DataQualityIssueRange['evidenceWindow']>,
): Record<string, DataQualityIssueRange['evidenceWindow']> | undefined {
  if (!map) return undefined;
  const cloned: Record<string, DataQualityIssueRange['evidenceWindow']> = {};
  for (const [topic, window] of Object.entries(map)) {
    cloned[topic] = cloneEvidenceWindow(window);
  }
  return cloned;
}

function pointSortKey(point: { index: number; logTimeNs?: string; timeNs: string }): bigint {
  return point.logTimeNs != undefined ? BigInt(point.logTimeNs) : BigInt(point.timeNs);
}

function mergeClockPoints<T extends { index: number; logTimeNs?: string; timeNs: string }>(a: T[], b: T[]): T[] {
  return [...a, ...b].sort((left, right) => {
    const leftNs = pointSortKey(left);
    const rightNs = pointSortKey(right);
    if (leftNs < rightNs) return -1;
    if (leftNs > rightNs) return 1;
    return left.index - right.index;
  });
}

function mergeEvidenceWindow(
  target: DataQualityIssueRange['evidenceWindow'],
  source: DataQualityIssueRange['evidenceWindow'],
): DataQualityIssueRange['evidenceWindow'] {
  return {
    beforeNormal: mergeClockPoints(target.beforeNormal, source.beforeNormal),
    anomaly: mergeClockPoints(target.anomaly, source.anomaly),
    afterNormal: mergeClockPoints(target.afterNormal, source.afterNormal),
  };
}

function titlePayload(range: DataQualityIssueRange): DataQualityExplainPayload {
  if (range.type === 'timestamp_rollback') {
    return {
      key: 'quality.incident.title.timestamp_rollback',
      values: { topic: range.topicNames[0] ?? 'Topic' },
    };
  }
  return {
    key: 'quality.incident.title.topic_frame_drop',
    values: { topic: range.topicNames[0] ?? 'Topic' },
  };
}

function impactPayload(range: DataQualityIssueRange): DataQualityExplainPayload {
  const count = range.summaryStats?.rawAnomalyCount ?? range.count;
  const ms = range.maxMagnitudeMs != undefined ? range.maxMagnitudeMs.toFixed(1) : '--';
  if (range.type === 'timestamp_rollback') {
    return { key: 'quality.incident.impact.timestamp_rollback', values: { count, ms } };
  }
  return { key: 'quality.incident.impact.topic_frame_drop', values: { count, ms } };
}

function recommendationPayload(range: DataQualityIssueRange): DataQualityExplainPayload {
  if (range.type === 'timestamp_rollback') {
    return { key: 'quality.incident.recommendation.timestamp_rollback', values: {} };
  }
  return { key: 'quality.incident.recommendation.frame_drop', values: {} };
}

function normalizeIncident(range: DataQualityIssueRange): DataQualityIssueRange {
  const durationNs = rangeEndNs(range) - rangeStartNs(range);
  const out: DataQualityIssueRange = {
    ...range,
    scope: 'topic',
    severity: 'error',
    titlePayload: range.titlePayload ?? titlePayload(range),
    impactPayload: range.impactPayload ?? impactPayload(range),
    recommendationPayload: range.recommendationPayload ?? recommendationPayload(range),
    summaryStats: {
      ...range.summaryStats,
      rawAnomalyCount: range.summaryStats?.rawAnomalyCount ?? range.count,
      incidentDurationNs: durationNs.toString(),
      mergedSourceCount: range.summaryStats?.mergedSourceCount ?? 1,
    },
  };
  return out;
}

function mergeCluster(cluster: DataQualityIssueRange[]): DataQualityIssueRange {
  const sorted = [...cluster].sort((a, b) => Number(rangeStartNs(a) - rangeStartNs(b)));
  const first = sorted[0];
  const latest = sorted.reduce((a, b) => (rangeEndNs(a) >= rangeEndNs(b) ? a : b));
  const merged: DataQualityIssueRange = {
    ...first,
    id: '',
    scope: 'topic',
    severity: 'error',
    topicNames: [...first.topicNames],
    count: 0,
    maxMagnitudeMs: undefined,
    evidenceWindow: cloneEvidenceWindow(first.evidenceWindow),
    topicEvidence: cloneTopicEvidence(first.topicEvidence),
    summaryStats: { ...first.summaryStats },
  };

  for (const range of sorted) {
    merged.count += range.count;
    merged.maxMagnitudeMs = Math.max(merged.maxMagnitudeMs ?? 0, range.maxMagnitudeMs ?? 0);
    if (rangeStartNs(range) < rangeStartNs(merged)) merged.start = range.start;
    if (rangeEndNs(range) > rangeEndNs(merged)) merged.end = range.end;
    if (range !== first) {
      merged.evidenceWindow = mergeEvidenceWindow(merged.evidenceWindow, range.evidenceWindow);
      const topicEvidence = range.topicEvidence ?? {};
      merged.topicEvidence = merged.topicEvidence ?? {};
      for (const [topic, window] of Object.entries(topicEvidence)) {
        const existing = merged.topicEvidence[topic];
        merged.topicEvidence[topic] = existing ? mergeEvidenceWindow(existing, window) : cloneEvidenceWindow(window);
      }
    }
  }

  const windowMax = sorted.map(adaptiveMergeWindowNs).reduce((a, b) => (a > b ? a : b));
  merged.evidenceWindow.afterNormal = [...latest.evidenceWindow.afterNormal];
  merged.summaryStats = {
    ...merged.summaryStats,
    rawAnomalyCount: sorted.reduce((sum, range) => sum + (range.summaryStats?.rawAnomalyCount ?? range.count), 0),
    mergeWindowNs: windowMax.toString(),
    mergedSourceCount: sorted.length,
    incidentDurationNs: (rangeEndNs(merged) - rangeStartNs(merged)).toString(),
    afterAvgDeltaNs: latest.summaryStats?.afterAvgDeltaNs ?? merged.summaryStats?.afterAvgDeltaNs,
    evidenceComplete: latest.summaryStats?.evidenceComplete,
  };

  merged.titlePayload = titlePayload(merged);
  merged.impactPayload = impactPayload(merged);
  merged.recommendationPayload = recommendationPayload(merged);
  return merged;
}

function clusterRuns(ranges: DataQualityIssueRange[]): DataQualityIssueRange[][] {
  const sorted = [...ranges].sort((a, b) => Number(rangeStartNs(a) - rangeStartNs(b)));
  const clusters: DataQualityIssueRange[][] = [];
  let current: DataQualityIssueRange[] = [];
  let currentEnd = 0n;

  for (const range of sorted) {
    if (current.length === 0) {
      current = [range];
      currentEnd = rangeEndNs(range);
      continue;
    }
    const windowNs = current.map(adaptiveMergeWindowNs).reduce((a, b) => (a > b ? a : b));
    const gap = rangeStartNs(range) - currentEnd;
    if (gap <= windowNs) {
      current.push(range);
      if (rangeEndNs(range) > currentEnd) currentEnd = rangeEndNs(range);
    } else {
      clusters.push(current);
      current = [range];
      currentEnd = rangeEndNs(range);
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

export function mergeTemporalClusters(ranges: DataQualityIssueRange[]): DataQualityIssueRange[] {
  const byKey = new Map<string, DataQualityIssueRange[]>();
  for (const range of ranges) {
    const key = mergeKey(range);
    const group = byKey.get(key) ?? [];
    group.push(range);
    byKey.set(key, group);
  }

  const out: DataQualityIssueRange[] = [];
  for (const group of byKey.values()) {
    for (const cluster of clusterRuns(group)) {
      out.push(cluster.length === 1 ? normalizeIncident(cluster[0]) : mergeCluster(cluster));
    }
  }

  return out
    .sort((a, b) => Number(rangeStartNs(a) - rangeStartNs(b)))
    .map((range, index) => ({ ...range, id: `${range.type}:${index + 1}` }));
}

export function buildQualityIncidents(ranges: DataQualityIssueRange[]): DataQualityIssueRange[] {
  return mergeTemporalClusters(ranges);
}
