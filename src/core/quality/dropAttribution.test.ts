import { describe, expect, it } from 'vitest';
import { fromNano } from '@/shared/utils/time';
import type { DataQualityIssueRange } from './types';
import { buildQualityIncidents, mergeTemporalClusters } from './dropAttribution';

function makeRange(
  topic: string,
  startNs: bigint,
  type: DataQualityIssueRange['type'] = 'topic_frame_drop',
): DataQualityIssueRange {
  return {
    id: '',
    type,
    clockSource: 'header',
    scope: 'topic',
    severity: 'error',
    topicNames: [topic],
    topicGroup: topic.split('/').filter(Boolean)[0] ?? 'topic',
    start: fromNano(startNs),
    end: fromNano(startNs + 40_000_000n),
    count: 1,
    maxMagnitudeMs: type === 'timestamp_rollback' ? 10 : 120,
    explainPayload: {
      key: type === 'timestamp_rollback' ? 'quality.summary.timestamp_rollback' : 'quality.summary.topic_frame_drop',
      values: { ms: type === 'timestamp_rollback' ? '10.0' : '120.0' },
    },
    evidenceWindow: {
      beforeNormal: [],
      anomaly: [{
        index: 10,
        timeNs: startNs.toString(),
        deltaNs: type === 'timestamp_rollback' ? '-10000000' : '160000000',
        isRollback: type === 'timestamp_rollback',
        isDroppedEstimate: type === 'topic_frame_drop',
        isAnomaly: true,
      }],
      afterNormal: [],
    },
    summaryStats: {
      baselineIntervalNs: '40000000',
      anomalyAvgDeltaNs: type === 'timestamp_rollback' ? '-10000000' : '160000000',
      estimatedDropCount: type === 'topic_frame_drop' ? 3 : undefined,
    },
  };
}

describe('mergeTemporalClusters', () => {
  it('merges same-topic issues within adaptive window', () => {
    const merged = mergeTemporalClusters([
      makeRange('/camera/a', 1_000_000_000n, 'timestamp_rollback'),
      makeRange('/camera/a', 1_200_000_000n, 'timestamp_rollback'),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('timestamp_rollback');
    expect(merged[0].scope).toBe('topic');
    expect(merged[0].count).toBe(2);
    expect(merged[0].summaryStats?.mergedSourceCount).toBe(2);
    expect(merged[0].summaryStats?.rawAnomalyCount).toBe(2);
  });

  it('keeps different topics as separate incidents', () => {
    const merged = mergeTemporalClusters([
      makeRange('/camera/a', 1_000_000_000n),
      makeRange('/camera/b', 1_010_000_000n),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((range) => range.topicNames[0]).sort()).toEqual(['/camera/a', '/camera/b']);
  });

  it('does not merge issues separated beyond merge window', () => {
    const merged = mergeTemporalClusters([
      makeRange('/camera/a', 1_000_000_000n),
      makeRange('/camera/a', 4_000_000_000n),
    ]);

    expect(merged).toHaveLength(2);
  });
});

describe('buildQualityIncidents', () => {
  it('adds user-facing payloads without promoting group or global incidents', () => {
    const incidents = buildQualityIncidents([
      makeRange('/camera/left/image', 16_770_000_000n),
      makeRange('/camera/right/image', 16_780_000_000n),
    ]);

    expect(incidents).toHaveLength(2);
    expect(incidents.every((incident) => incident.scope === 'topic')).toBe(true);
    expect(incidents[0].titlePayload).toEqual({
      key: 'quality.incident.title.topic_frame_drop',
      values: { topic: '/camera/left/image' },
    });
    expect(incidents[0].impactPayload?.key).toBe('quality.incident.impact.topic_frame_drop');
  });
});
