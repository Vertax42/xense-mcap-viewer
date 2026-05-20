import type { TopicInfo } from '@/core/types/ros';

function formatCompactNumber(value: number): string {
  return value.toLocaleString();
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

/** Effective publish rate (Hz): use stats when present, else infer from span and message count. */
function deriveFrequencyHz(topic: TopicInfo): number | undefined {
  const f = topic.frequency;
  if (typeof f === 'number' && Number.isFinite(f) && f > 0) {
    return f;
  }
  const durationSec = topic.durationSec;
  const messageCount = topic.messageCount;
  if (
    typeof durationSec === 'number' &&
    Number.isFinite(durationSec) &&
    durationSec > 0 &&
    typeof messageCount === 'number' &&
    messageCount > 1
  ) {
    const hz = (messageCount - 1) / durationSec;
    return hz > 0 && Number.isFinite(hz) ? hz : undefined;
  }
  return undefined;
}

function formatHz(hz: number): string {
  const rounded = Math.round(hz);
  if (Math.abs(hz - rounded) < 1e-3) {
    return `${rounded}Hz`;
  }
  const digits = hz >= 100 ? 0 : hz >= 10 ? 1 : 2;
  return `${trimTrailingZeros(hz.toFixed(digits))}Hz`;
}

export function getTopicMetricLines(topic: TopicInfo): { primary?: string; secondary?: string } {
  const hz = deriveFrequencyHz(topic);
  const hasMessageCount = typeof topic.messageCount === 'number' && topic.messageCount > 0;

  const primary = hz != null ? formatHz(hz) : undefined;
  const secondary = hasMessageCount ? formatCompactNumber(topic.messageCount as number) : undefined;

  if (primary && secondary) {
    return { primary, secondary };
  }

  return { primary: primary ?? secondary };
}
