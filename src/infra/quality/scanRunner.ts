import { readHeaderStamp } from '@/core/analysis/timeSeries';
import type { DataQualityReport, Initialization } from '@/core/types/ros';
import { createInitialDataQualityReport, QualityScanSession } from '@/core/quality/scanSession';
import type { IIterableSource } from '@/infra/sources/IIterableSource';
import { toNano } from '@/shared/utils/time';

export const QUALITY_AUTO_SCAN_MAX_MESSAGES = 10_000;

export function totalMessagesFromInitialization(init?: Initialization): number | undefined {
  if (!init) return undefined;
  let total = 0;
  let hasCount = false;

  for (const stats of Object.values(init.topicStats ?? {})) {
    if (Number.isFinite(stats.messageCount)) {
      total += stats.messageCount;
      hasCount = true;
    }
  }
  if (hasCount) return total;

  for (const topic of init.topics) {
    const count = topic.messageCount;
    if (count != undefined && Number.isFinite(count)) {
      total += count;
      hasCount = true;
    }
  }
  return hasCount ? total : undefined;
}

export function shouldAutoScanDataQuality(totalMessages?: number): boolean {
  return totalMessages != undefined && totalMessages <= QUALITY_AUTO_SCAN_MAX_MESSAGES;
}

export function createIdleDataQualityReport(init?: Initialization): DataQualityReport {
  const totalMessages = totalMessagesFromInitialization(init);
  const report = createInitialDataQualityReport();
  return {
    ...report,
    totalMessages,
    noticePayload:
      totalMessages != undefined && totalMessages > QUALITY_AUTO_SCAN_MAX_MESSAGES
        ? {
            key: 'quality.scan.skippedLargeFile',
            values: { total: totalMessages, limit: QUALITY_AUTO_SCAN_MAX_MESSAGES },
          }
        : undefined,
  };
}

function readTransformHeaderStampNs(message: unknown): bigint | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const transforms = (message as Record<string, unknown>).transforms;
  if (!Array.isArray(transforms) || transforms.length === 0) return undefined;
  for (const transform of transforms) {
    const stamp = readHeaderStamp(transform);
    if (stamp) return toNano(stamp);
  }
  return undefined;
}

function headerStampNs(message: unknown): bigint | undefined {
  const header = readHeaderStamp(message);
  return header ? toNano(header) : readTransformHeaderStampNs(message);
}

export async function scanDataQualityFromSource(
  source: IIterableSource,
  init: Initialization,
  onUpdate?: (report: DataQualityReport) => void,
): Promise<DataQualityReport> {
  const totalMessages = totalMessagesFromInitialization(init);
  const session = new QualityScanSession(totalMessages);
  session.setCoverage({
    mode: 'complete',
    activeRange: { start: init.start, end: init.end },
    scannedRanges: [{ start: init.start, end: init.end }],
  });

  const emit = (status: 'scanning' | 'ready'): DataQualityReport => {
    const report = session.report(status);
    onUpdate?.(report);
    return report;
  };

  emit('scanning');
  let scannedMessages = 0;
  for await (const event of source.messageIterator({
    startTime: init.start,
    endTime: init.end,
    topics: init.topics.map((topic) => topic.name),
  })) {
    session.accept({
      topic: event.topic,
      logTimeNs: toNano(event.receiveTime),
      headerTimeNs: headerStampNs(event.message),
    });
    scannedMessages += 1;

    if (scannedMessages % 2000 === 0) {
      emit('scanning');
    }
    if (scannedMessages % 8000 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return emit('ready');
}
