import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import { type AlignConfig } from './defaults';
import { parseAlignConfig } from './schema';

const KNOWN_KEYS = ['topics', 'timeMode', 'windowHalfMs', 'dotRadius', 'dotOpacity'] as const;

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<AlignConfig> {
  const title =
    typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
      ? (config[FOXGLOVE_PANEL_TITLE_KEY])
      : undefined;
  return {
    config: parseAlignConfig(config),
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<AlignConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {
    topics: state.config.topics,
    timeMode: state.config.timeMode,
    windowHalfMs: state.config.windowHalfMs,
    dotRadius: state.config.dotRadius,
    dotOpacity: state.config.dotOpacity,
  };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const alignFoxgloveAdapter: PanelFoxgloveAdapter<AlignConfig> = {
  internalType: 'Align',
  foxgloveTypes: ['Align'],
  defaultFoxgloveType: 'Align',
  fromConfig,
  toConfig,
};
