import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import { type TopicGraphConfig } from './defaults';
import { parseTopicGraphConfig } from './schema';

const KNOWN_KEYS = ['rankDir', 'showControls'] as const;

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<TopicGraphConfig> {
  const title = typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
    ? (config[FOXGLOVE_PANEL_TITLE_KEY])
    : undefined;
  return {
    config: parseTopicGraphConfig(config),
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<TopicGraphConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {
    rankDir: state.config.rankDir,
    showControls: state.config.showControls,
  };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const topicGraphFoxgloveAdapter: PanelFoxgloveAdapter<TopicGraphConfig> = {
  internalType: 'TopicGraph',
  foxgloveTypes: ['TopicGraph'],
  defaultFoxgloveType: 'TopicGraph',
  fromConfig,
  toConfig,
};
