import { isRecord } from '../framework/types';
import { defaultTopicGraphConfig, type TopicGraphConfig } from './defaults';

export function parseTopicGraphConfig(input: unknown): TopicGraphConfig {
  const base = defaultTopicGraphConfig();
  if (!isRecord(input)) return base;
  return {
    rankDir: input.rankDir === 'TB' ? 'TB' : 'LR',
    showControls: typeof input.showControls === 'boolean' ? input.showControls : base.showControls,
  };
}
