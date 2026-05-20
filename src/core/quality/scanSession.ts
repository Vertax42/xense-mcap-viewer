import type {
  DataQualityIssue,
  DataQualityIssueCounts,
  DataQualityIssueRange,
  DataQualityReport,
  DataQualityStatus,
  QualityRawSample,
  QualityScanCoverage,
} from './types';
import { QualityClockProfiler } from './clockProfile';
import { buildQualityIncidents } from './dropAttribution';
import { issueSummaryFallback } from './issueSummary';

export function createIssueCounts(): DataQualityIssueCounts {
  return {
    timestamp_rollback: 0,
    topic_frame_drop: 0,
  };
}

export function createInitialDataQualityReport(): DataQualityReport {
  return {
    status: 'idle',
    scannedMessages: 0,
    updatedAt: Date.now(),
    issueCounts: createIssueCounts(),
    ranges: [],
    incidents: [],
    issues: [],
  };
}

export class QualityScanSession {
  private profiler = new QualityClockProfiler();
  private ranges: DataQualityIssueRange[] = [];
  private scannedMessages = 0;
  private totalMessages: number | undefined;
  private coverage: QualityScanCoverage | undefined;

  constructor(totalMessages?: number) {
    this.totalMessages = totalMessages;
  }

  setCoverage(coverage: QualityScanCoverage): void {
    this.coverage = coverage;
  }

  accept(sample: QualityRawSample): void {
    this.scannedMessages += 1;
    for (const candidate of this.profiler.accept(sample)) {
      this.ranges.push(candidate.range);
    }
  }

  report(status: DataQualityStatus): DataQualityReport {
    if (status === 'ready') {
      this.profiler.finalizePendingEvidence();
    }
    const ranges = buildQualityIncidents(this.ranges);
    const issueCounts = createIssueCounts();
    for (const range of ranges) {
      issueCounts[range.type] += 1;
    }
    const issues: DataQualityIssue[] = ranges.map((range) => ({
      id: range.id,
      type: range.type,
      clockSource: range.clockSource,
      scope: range.scope,
      severity: range.severity,
      topicNames: range.topicNames,
      topicGroup: range.topicGroup,
      startTime: range.start,
      endTime: range.end,
      count: range.count,
      maxMagnitudeMs: range.maxMagnitudeMs,
      summary: issueSummaryFallback(range),
      explainPayload: range.explainPayload,
    }));
    return {
      status,
      scannedMessages: this.scannedMessages,
      totalMessages: this.totalMessages,
      updatedAt: Date.now(),
      issueCounts,
      scanCoverage: this.coverage,
      ranges,
      incidents: ranges,
      issues,
    };
  }
}
