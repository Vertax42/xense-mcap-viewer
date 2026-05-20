import { isRecord } from '../framework/types';
import { defaultTimelineConfig, type TimelineConfig } from './defaults';

export function parseTimelineConfig(input: unknown): TimelineConfig {
  const base = defaultTimelineConfig();
  if (!isRecord(input)) return base;
  return {
    showDrops: typeof input.showDrops === 'boolean' ? input.showDrops : base.showDrops,
  };
}
