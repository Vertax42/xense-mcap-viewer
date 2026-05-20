import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import { defaultUnavailableConfig, type UnavailableConfig } from './defaults';

/**
 * Catch-all adapter used when we cannot map an id's Foxglove type to any of
 * our panels. The panel degrades to `Unavailable`, but the entire original
 * config is retained in `extras` so a round-trip export still produces a
 * Foxglove-valid panel config.
 */

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<UnavailableConfig> {
  const title = typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
    ? (config[FOXGLOVE_PANEL_TITLE_KEY])
    : undefined;
  return {
    config: defaultUnavailableConfig(),
    extras: collectExtras(config, []),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<UnavailableConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {};
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const unavailableFoxgloveAdapter: PanelFoxgloveAdapter<UnavailableConfig> = {
  internalType: 'Unavailable',
  foxgloveTypes: [],
  defaultFoxgloveType: 'Unknown',
  fromConfig,
  toConfig,
};
