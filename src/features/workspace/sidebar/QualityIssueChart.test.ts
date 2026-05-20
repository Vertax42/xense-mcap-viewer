import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'react-intl';
import type { DataQualityIssueRange, DataQualityIssueType } from '@/core/types/ros';
import { getMcapViewerMessages } from '@/shared/intl/loadMcapViewerMessages';
import { QualityIssueChart } from './QualityIssueChart';

const enMessages = getMcapViewerMessages('en');

function makeRange(
  evidence: DataQualityIssueRange['evidenceWindow'],
  stats?: DataQualityIssueRange['summaryStats'],
  type: DataQualityIssueType = 'topic_frame_drop',
) {
  const base: DataQualityIssueRange = {
    id: `${type}:1`,
    type,
    clockSource: 'header',
    scope: 'topic',
    severity: 'warn',
    topicNames: ['/t'],
    start: { sec: 0, nsec: 0 },
    end: { sec: 0, nsec: 0 },
    count: 1,
    evidenceWindow: evidence,
    explainPayload: { key: 'quality.summary.topic_frame_drop', values: { ms: '12.0' } },
    summaryStats: stats,
  };
  return base;
}

describe('QualityIssueChart', () => {
  it('uses signed interval deviation for rollback evidence', () => {
    const range = makeRange(
      {
        beforeNormal: [
          { index: 1, timeNs: '1000000000', logTimeNs: '1000000000', deltaNs: '40000000' },
          { index: 2, timeNs: '1040000000', logTimeNs: '1040000000', deltaNs: '40000000' },
        ],
        anomaly: [
          {
            index: 3,
            timeNs: '990000000',
            logTimeNs: '1080000000',
            deltaNs: '-50000000',
            isRollback: true,
            isAnomaly: true,
          },
        ],
        afterNormal: [{ index: 4, timeNs: '1030000000', logTimeNs: '1120000000', deltaNs: '40000000' }],
      },
      { evidenceTargetCount: 2, evidenceComplete: true, baselineIntervalNs: '40000000' },
      'timestamp_rollback',
    );
    const html = renderToStaticMarkup(
      React.createElement(
        IntlProvider,
        { locale: 'en', messages: enMessages },
        React.createElement(QualityIssueChart, { range, timelineStart: undefined }),
      ),
    );

    expect(html).toContain('Frame interval deviation');
    expect(html).toContain('hsl(var(--destructive))');
  });

  it('uses positive interval deviation for gap and jitter evidence', () => {
    const range = makeRange(
      {
        beforeNormal: [
          { index: 1, timeNs: '1000000000', logTimeNs: '1000000000', deltaNs: '40000000' },
          { index: 2, timeNs: '1040000000', logTimeNs: '1040000000', deltaNs: '40000000' },
        ],
        anomaly: [{ index: 3, timeNs: '1240000000', logTimeNs: '1240000000', deltaNs: '200000000', isAnomaly: true }],
        afterNormal: [{ index: 4, timeNs: '1280000000', logTimeNs: '1280000000', deltaNs: '40000000' }],
      },
      { evidenceTargetCount: 2, evidenceComplete: true, baselineIntervalNs: '40000000' },
      'topic_frame_drop',
    );
    const html = renderToStaticMarkup(
      React.createElement(
        IntlProvider,
        { locale: 'en', messages: enMessages },
        React.createElement(QualityIssueChart, { range, timelineStart: undefined }),
      ),
    );

    expect(html).toContain('Frame interval deviation');
    expect(html).toContain('#f59e0b');
    expect(html).toContain('stroke-primary/50');
  });

  it('shows symmetric B/A/N counts when before and after match target', () => {
    const range = makeRange(
      {
        beforeNormal: [
          { index: 1, timeNs: '1000', deltaNs: '40' },
          { index: 2, timeNs: '1040', deltaNs: '40' },
        ],
        anomaly: [{ index: 3, timeNs: '2000', deltaNs: '500', isAnomaly: true }],
        afterNormal: [
          { index: 4, timeNs: '2500', deltaNs: '40' },
          { index: 5, timeNs: '2540', deltaNs: '40' },
        ],
      },
      { evidenceTargetCount: 2, evidenceComplete: true },
    );
    const html = renderToStaticMarkup(
      React.createElement(
        IntlProvider,
        { locale: 'en', messages: enMessages },
        React.createElement(QualityIssueChart, { range, timelineStart: undefined }),
      ),
    );
    expect(html).toContain('B2 · A1 · N2');
    expect(html).not.toContain('deltaNs');
  });

  it('shows actual before/after counts in the legend', () => {
    const range = makeRange(
      {
        beforeNormal: [1, 2, 3, 4].map((i) => ({
          index: i,
          timeNs: String(i * 1000),
          deltaNs: '40',
        })),
        anomaly: [{ index: 10, timeNs: '50000', deltaNs: '500', isAnomaly: true }],
        afterNormal: [11, 12, 13, 14].map((i) => ({
          index: i,
          timeNs: String(i * 1000),
          deltaNs: '40',
        })),
      },
      { evidenceTargetCount: 4, evidenceComplete: true },
    );
    const html = renderToStaticMarkup(
      React.createElement(
        IntlProvider,
        { locale: 'en', messages: enMessages },
        React.createElement(QualityIssueChart, { range, timelineStart: undefined }),
      ),
    );
    expect(html).toContain('B4 · A1 · N4');
  });

  it('shows asymmetric actual counts (e.g. many before, few after)', () => {
    const range = makeRange(
      {
        beforeNormal: Array.from({ length: 14 }, (_, i) => ({
          index: i,
          timeNs: String((i + 1) * 1000),
          deltaNs: '40',
        })),
        anomaly: [{ index: 20, timeNs: '50000', deltaNs: '500', isAnomaly: true }],
        afterNormal: [
          { index: 21, timeNs: '60000', deltaNs: '40' },
          { index: 22, timeNs: '64000', deltaNs: '40' },
        ],
      },
      { evidenceTargetCount: 14, evidenceComplete: false },
    );
    const html = renderToStaticMarkup(
      React.createElement(
        IntlProvider,
        { locale: 'en', messages: enMessages },
        React.createElement(QualityIssueChart, { range, timelineStart: undefined }),
      ),
    );
    expect(html).toContain('B14 · A1 · N2');
  });
});
