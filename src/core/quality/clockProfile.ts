import { fromNano } from '@/shared/utils/time';
import type {
  ClockEvidenceWindow,
  ClockPoint,
  DataQualityClockSource,
  DataQualityExplainPayload,
  DataQualityIssueRange,
  DataQualityIssueType,
  QualityRawSample,
} from './types';

const BASELINE_WINDOW = 24;
const EVIDENCE_WINDOW_FRAMES = 20;
const MIN_BASELINE_INTERVALS = 5;
const MIN_GAP_EXCESS_NS = 5_000_000n;

type ClockSample = {
  topic: string;
  clockSource: DataQualityClockSource;
  index: number;
  timeNs: bigint;
  logTimeNs: bigint;
  deltaNs?: bigint;
  isAnomaly: boolean;
  isRollback: boolean;
  isDroppedEstimate: boolean;
};

type ClockState = {
  topic: string;
  clockSource: DataQualityClockSource;
  index: number;
  lastTimeNs?: bigint;
  deltaHistory: bigint[];
  recentNormal: ClockSample[];
};

export type TopicIssueCandidate = {
  range: DataQualityIssueRange;
  sample: ClockSample;
};

function averageBigInt(values: bigint[]): bigint | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

function pushBaselineDelta(state: ClockState, deltaNs: bigint): void {
  if (deltaNs <= 0n) return;
  state.deltaHistory.push(deltaNs);
  if (state.deltaHistory.length > BASELINE_WINDOW) {
    state.deltaHistory.shift();
  }
}

function toClockPoint(sample: ClockSample): ClockPoint {
  return {
    index: sample.index,
    timeNs: sample.timeNs.toString(),
    logTimeNs: sample.logTimeNs.toString(),
    deltaNs: sample.deltaNs?.toString(),
    isDroppedEstimate: sample.isDroppedEstimate,
    isRollback: sample.isRollback,
    isAnomaly: sample.isAnomaly,
  };
}

function cloneEvidenceWindow(window: ClockEvidenceWindow): ClockEvidenceWindow {
  return {
    beforeNormal: [...window.beforeNormal],
    anomaly: [...window.anomaly],
    afterNormal: [...window.afterNormal],
  };
}

function explainPayloadForIssue(type: DataQualityIssueType, magnitudeMs: number): DataQualityExplainPayload {
  const ms = magnitudeMs.toFixed(1);
  switch (type) {
    case 'timestamp_rollback':
      return { key: 'quality.summary.timestamp_rollback', values: { ms } };
    case 'topic_frame_drop':
      return { key: 'quality.summary.topic_frame_drop', values: { ms } };
    default:
      return { key: 'quality.summary.generic', values: { ms } };
  }
}

function groupTopic(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes('camera') || lower.includes('image')) return 'camera';
  if (lower.includes('lidar') || lower.includes('points')) return 'lidar';
  if (lower.includes('imu')) return 'imu';
  return topic.split('/').filter(Boolean)[0] ?? 'other';
}

function shouldDetectTopicGap(topic: string): boolean {
  const lower = topic.toLowerCase();
  return !(
    lower === '/tf' ||
    lower === '/tf_static' ||
    lower === '/clock' ||
    lower === '/rosout' ||
    lower === '/parameter_events' ||
    lower.includes('/diagnostics') ||
    lower.includes('/statistics')
  );
}

export class QualityClockProfiler {
  private states = new Map<string, ClockState>();
  private pendingAfter = new Map<string, DataQualityIssueRange[]>();

  accept(sample: QualityRawSample): TopicIssueCandidate[] {
    if (sample.headerTimeNs != undefined) {
      return this.acceptClock(sample.topic, 'header', sample.headerTimeNs, sample.logTimeNs);
    }
    return [];
  }

  private getState(topic: string, clockSource: DataQualityClockSource): ClockState {
    const key = `${topic}|${clockSource}`;
    const existing = this.states.get(key);
    if (existing) return existing;
    const state: ClockState = {
      topic,
      clockSource,
      index: 0,
      deltaHistory: [],
      recentNormal: [],
    };
    this.states.set(key, state);
    return state;
  }

  private acceptClock(
    topic: string,
    clockSource: DataQualityClockSource,
    timeNs: bigint,
    logTimeNs: bigint,
  ): TopicIssueCandidate[] {
    const state = this.getState(topic, clockSource);
    const key = `${topic}|${clockSource}`;
    const index = state.index++;
    const prevTimeNs = state.lastTimeNs;
    if (prevTimeNs == undefined) {
      const first = this.createClockSample(state, index, timeNs, logTimeNs);
      state.lastTimeNs = timeNs;
      state.recentNormal.push(first);
      return [];
    }

    const deltaNs = timeNs - prevTimeNs;
    const baselineNs = averageBigInt(state.deltaHistory.filter((value) => value > 0n));
    let type: DataQualityIssueType | undefined;
    let magnitudeMs = 0;
    let deviationRatio: number | undefined;
    let estimatedDropCount: number | undefined;
    let rollbackDepthNs: bigint | undefined;
    let isRollback = false;
    let isDroppedEstimate = false;

    if (deltaNs < 0n && clockSource === 'header') {
      type = 'timestamp_rollback';
      rollbackDepthNs = -deltaNs;
      magnitudeMs = Number(rollbackDepthNs) / 1e6;
      isRollback = true;
    } else {
      if (baselineNs != undefined && baselineNs > 0n && state.deltaHistory.length >= MIN_BASELINE_INTERVALS) {
        deviationRatio = Number(deltaNs) / Number(baselineNs);
        const gapExcessNs = deltaNs - baselineNs;
        if (shouldDetectTopicGap(topic) && deltaNs > baselineNs * 2n && gapExcessNs >= MIN_GAP_EXCESS_NS) {
          type = 'topic_frame_drop';
          magnitudeMs = Number(gapExcessNs) / 1e6;
          estimatedDropCount = Math.max(0, Math.floor(deviationRatio) - 1);
          isDroppedEstimate = estimatedDropCount > 0;
        }
      }
      if (!type) {
        pushBaselineDelta(state, deltaNs);
      }
    }

    const clockSample = this.createClockSample(state, index, timeNs, logTimeNs, {
      deltaNs,
      isAnomaly: type != undefined,
      isRollback,
      isDroppedEstimate,
    });

    if (!type) {
      this.appendAfterNormal(key, clockSample);
      state.recentNormal.push(clockSample);
      if (state.recentNormal.length > EVIDENCE_WINDOW_FRAMES * 3) {
        state.recentNormal.shift();
      }
      state.lastTimeNs = timeNs;
      return [];
    }

    const beforeNormal = state.recentNormal.slice(-EVIDENCE_WINDOW_FRAMES).map(toClockPoint);
    const evidenceTargetCount = Math.min(beforeNormal.length, EVIDENCE_WINDOW_FRAMES);
    const evidenceWindow: ClockEvidenceWindow = {
      beforeNormal,
      anomaly: [toClockPoint(clockSample)],
      afterNormal: [],
    };
    const topicEvidence: Record<string, ClockEvidenceWindow> = {
      [topic]: cloneEvidenceWindow(evidenceWindow),
    };
    const range: DataQualityIssueRange = {
      id: '',
      type,
      clockSource,
      scope: 'topic',
      severity: 'error',
      topicNames: [topic],
      topicGroup: groupTopic(topic),
      start: fromNano(logTimeNs),
      end: fromNano(logTimeNs),
      count: 1,
      maxMagnitudeMs: magnitudeMs,
      evidenceWindow,
      topicEvidence,
      summaryStats: {
        baselineIntervalNs: baselineNs?.toString(),
        beforeAvgDeltaNs: averageBigInt(
          beforeNormal
            .map((point) => point.deltaNs)
            .filter((value): value is string => value != undefined)
            .map((value) => BigInt(value)),
        )?.toString(),
        anomalyAvgDeltaNs: deltaNs.toString(),
        maxDeviationRatio: deviationRatio,
        estimatedDropCount,
        rollbackDepthNs: rollbackDepthNs?.toString(),
        impactedTopicCount: 1,
        impactedGroupCount: 1,
        evidenceTargetCount,
        evidenceComplete: false,
        mergedSourceCount: 1,
      },
      explainPayload: explainPayloadForIssue(type, magnitudeMs),
    };
    const pending = this.pendingAfter.get(key) ?? [];
    pending.push(range);
    this.pendingAfter.set(key, pending);
    state.lastTimeNs = timeNs;
    return [{ range, sample: clockSample }];
  }

  /** Call when scan finishes so pending ranges get evidenceComplete / after stats. */
  finalizePendingEvidence(): void {
    for (const pending of this.pendingAfter.values()) {
      for (const range of pending) {
        this.finalizeRangeEvidence(range);
      }
    }
    this.pendingAfter.clear();
  }

  private targetAfterCount(range: DataQualityIssueRange): number {
    const fromStats = range.summaryStats?.evidenceTargetCount;
    if (fromStats != undefined && fromStats > 0) return fromStats;
    return Math.min(range.evidenceWindow.beforeNormal.length, EVIDENCE_WINDOW_FRAMES);
  }

  private finalizeRangeEvidence(range: DataQualityIssueRange): void {
    const target = this.targetAfterCount(range);
    const complete = range.evidenceWindow.afterNormal.length >= target;
    range.summaryStats = {
      ...range.summaryStats,
      evidenceTargetCount: target,
      evidenceComplete: complete,
      afterAvgDeltaNs:
        range.evidenceWindow.afterNormal.length > 0
          ? averageBigInt(
              range.evidenceWindow.afterNormal
                .map((point) => point.deltaNs)
                .filter((value): value is string => value != undefined)
                .map((value) => BigInt(value)),
            )?.toString()
          : range.summaryStats?.afterAvgDeltaNs,
    };
  }

  private appendAfterNormal(key: string, sample: ClockSample): void {
    const pending = this.pendingAfter.get(key);
    if (!pending) return;
    const keep: DataQualityIssueRange[] = [];
    for (const range of pending) {
      const targetAfter = this.targetAfterCount(range);
      const topicWindow = range.topicEvidence?.[sample.topic];
      if (range.evidenceWindow.afterNormal.length < targetAfter) {
        range.evidenceWindow.afterNormal.push(toClockPoint(sample));
      }
      if (topicWindow && topicWindow.afterNormal.length < targetAfter) {
        topicWindow.afterNormal.push(toClockPoint(sample));
      }
      if (range.evidenceWindow.afterNormal.length < targetAfter) {
        keep.push(range);
      } else {
        range.summaryStats = {
          ...range.summaryStats,
          evidenceComplete: true,
          afterAvgDeltaNs: averageBigInt(
            range.evidenceWindow.afterNormal
              .map((point) => point.deltaNs)
              .filter((value): value is string => value != undefined)
              .map((value) => BigInt(value)),
          )?.toString(),
        };
      }
    }
    if (keep.length > 0) {
      this.pendingAfter.set(key, keep);
    } else {
      this.pendingAfter.delete(key);
    }
  }

  private createClockSample(
    state: ClockState,
    index: number,
    timeNs: bigint,
    logTimeNs: bigint,
    overrides: Partial<ClockSample> = {},
  ): ClockSample {
    return {
      topic: state.topic,
      clockSource: state.clockSource,
      index,
      timeNs,
      logTimeNs,
      isAnomaly: false,
      isRollback: false,
      isDroppedEstimate: false,
      ...overrides,
    };
  }
}
