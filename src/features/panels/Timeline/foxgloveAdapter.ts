import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import { type TimelineConfig } from './defaults';
import { parseTimelineConfig } from './schema';

const KNOWN_KEYS = ['showDrops'] as const;

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<TimelineConfig> {
  const title = typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
    ? (config[FOXGLOVE_PANEL_TITLE_KEY])
    : undefined;
  return {
    config: parseTimelineConfig(config),
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<TimelineConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {
    showDrops: state.config.showDrops,
  };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const timelineFoxgloveAdapter: PanelFoxgloveAdapter<TimelineConfig> = {
  internalType: 'Timeline',
  foxgloveTypes: ['Timeline'],
  defaultFoxgloveType: 'Timeline',
  fromConfig,
  toConfig,
};
