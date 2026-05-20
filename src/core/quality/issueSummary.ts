import type { DataQualityIssueRange } from './types';

/** Non-i18n fallback for logs or consumers without Intl (ASCII). */
export function issueSummaryFallback(range: DataQualityIssueRange): string {
  const ms = range.maxMagnitudeMs != undefined ? `${range.maxMagnitudeMs.toFixed(1)}ms` : '';
  return `${range.scope} ${range.type}${ms ? ` (${ms})` : ''} · count ${range.count}`;
}
