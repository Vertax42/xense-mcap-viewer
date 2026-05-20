import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import { type RawMessagesConfig } from './defaults';
import { parseRawMessagesConfig } from './schema';

const KNOWN_KEYS = [
  'topic',
  'topicPath',
  'uiRefreshHz',
  'pauseUpdates',
  'latestOnly',
  'maxExpandedDepth',
  'maxRows',
  'maxBinaryPreviewBytes',
  'binaryPreviewBytes',
  'binaryCopyFormat',
] as const;

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<RawMessagesConfig> {
  const merged: FoxgloveConfig = { ...config };
  if (typeof merged.topicPath === 'string' && typeof merged.topic !== 'string') {
    merged.topic = merged.topicPath;
  }
  const title = typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
    ? (config[FOXGLOVE_PANEL_TITLE_KEY])
    : undefined;
  return {
    config: parseRawMessagesConfig(merged),
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<RawMessagesConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {
    topic: state.config.topic,
    uiRefreshHz: state.config.uiRefreshHz,
    pauseUpdates: state.config.pauseUpdates,
    latestOnly: state.config.latestOnly,
    maxExpandedDepth: state.config.maxExpandedDepth,
    maxRows: state.config.maxRows,
    maxBinaryPreviewBytes: state.config.maxBinaryPreviewBytes,
    binaryPreviewBytes: state.config.maxBinaryPreviewBytes,
    binaryCopyFormat: state.config.binaryCopyFormat,
  };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const rawMessagesFoxgloveAdapter: PanelFoxgloveAdapter<RawMessagesConfig> = {
  internalType: 'RawMessages',
  foxgloveTypes: ['RawMessages'],
  defaultFoxgloveType: 'RawMessages',
  fromConfig,
  toConfig,
};
