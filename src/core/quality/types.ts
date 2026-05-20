import type { Time, TimeRange } from '@/core/types/ros';

export type DataQualityIssueType =
  | 'timestamp_rollback'
  | 'topic_frame_drop';

export type DataQualityClockSource = 'header' | 'log';
export type DataQualitySeverity = 'warn' | 'error';
export type DataQualityScope = 'topic' | 'group' | 'global';
export type DataQualityStatus = 'idle' | 'scanning' | 'ready';

export interface QualityScanCoverage {
  scannedRanges: TimeRange[];
  activeRange?: TimeRange;
  mode: 'visible' | 'background' | 'complete';
}

export interface ClockPoint {
  index: number;
  timeNs: string;
  logTimeNs?: string;
  deltaNs?: string;
  isDroppedEstimate?: boolean;
  isRollback?: boolean;
  isAnomaly?: boolean;
}

export interface ClockEvidenceWindow {
  beforeNormal: ClockPoint[];
  anomaly: ClockPoint[];
  afterNormal: ClockPoint[];
}

/** Message id + ICU values; UI merges `clock` with `quality.clock.*` if needed. */
export interface DataQualityExplainPayload {
  key: string;
  values: Record<string, string | number>;
}

export interface DataQualitySummaryStats {
  baselineIntervalNs?: string;
  beforeAvgDeltaNs?: string;
  anomalyAvgDeltaNs?: string;
  afterAvgDeltaNs?: string;
  maxDeviationRatio?: number;
  estimatedDropCount?: number;
  rollbackDepthNs?: string;
  impactedTopicCount?: number;
  impactedGroupCount?: number;
  /** Adaptive merge window used when folding nearby issues (ns string). */
  mergeWindowNs?: string;
  /** How many separate issue ranges were merged into this one (≥1). */
  mergedSourceCount?: number;
  /** Target length for after-normal evidence (matches before cap). */
  evidenceTargetCount?: number;
  /** True when after-normal segment reached the target length. */
  evidenceComplete?: boolean;
  /** Number of raw anomaly points represented by the user-facing incident. */
  rawAnomalyCount?: number;
  /** Duration covered by the incident, including clustered nearby anomalies. */
  incidentDurationNs?: string;
}

export interface DataQualityIssueRange {
  id: string;
  type: DataQualityIssueType;
  clockSource: DataQualityClockSource;
  scope: DataQualityScope;
  severity: DataQualitySeverity;
  topicNames: string[];
  topicGroup?: string;
  start: Time;
  end: Time;
  count: number;
  maxMagnitudeMs?: number;
  evidenceWindow: ClockEvidenceWindow;
  /** Per-topic evidence for drill-down raw table; key is topic name. */
  topicEvidence?: Record<string, ClockEvidenceWindow>;
  summaryStats?: DataQualitySummaryStats;
  explainPayload?: DataQualityExplainPayload;
  titlePayload?: DataQualityExplainPayload;
  impactPayload?: DataQualityExplainPayload;
  recommendationPayload?: DataQualityExplainPayload;
}

export type QualityIncident = DataQualityIssueRange;

export interface DataQualityIssue {
  id: string;
  type: DataQualityIssueType;
  clockSource: DataQualityClockSource;
  scope: DataQualityScope;
  severity: DataQualitySeverity;
  topicNames: string[];
  topicGroup?: string;
  startTime: Time;
  endTime: Time;
  count: number;
  maxMagnitudeMs?: number;
  summary: string;
  explainPayload?: DataQualityExplainPayload;
}

export type DataQualityIssueCounts = Record<DataQualityIssueType, number>;

export interface DataQualityReport {
  status: DataQualityStatus;
  scannedMessages: number;
  totalMessages?: number;
  updatedAt: number;
  issueCounts: DataQualityIssueCounts;
  scanCoverage?: QualityScanCoverage;
  noticePayload?: DataQualityExplainPayload;
  ranges: DataQualityIssueRange[];
  /** User-facing, clustered quality events. Mirrors `ranges` during the transition. */
  incidents?: QualityIncident[];
  issues: DataQualityIssue[];
}

export interface QualityRawSample {
  topic: string;
  logTimeNs: bigint;
  headerTimeNs?: bigint;
}
