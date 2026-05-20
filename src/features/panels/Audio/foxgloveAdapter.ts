import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import type { AudioConfig } from './defaults';
import { parseAudioConfig } from './schema';

const KNOWN_KEYS = [
  'topic',
  'topicPath',
  'audioInfoTopic',
  'defaultSampleRate',
  'defaultChannels',
  'defaultSampleFormat',
  'volume',
  'mute',
  'waveformColor',
  'color',
  'waveformWindowSec',
  'windowSizeSec',
] as const;

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<AudioConfig> {
  const merged: FoxgloveConfig = { ...config };
  const topicPath = typeof merged.topicPath === 'string' ? merged.topicPath : '';
  const topic = typeof merged.topic === 'string' ? merged.topic : '';
  if (!topic && topicPath) {
    merged.topic = topicPath;
  }
  const title =
    typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string' ? config[FOXGLOVE_PANEL_TITLE_KEY] : undefined;
  return {
    config: parseAudioConfig(merged),
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<AudioConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {
    topic: state.config.topic,
    topicPath: state.config.topic,
    audioInfoTopic: state.config.audioInfoTopic,
    defaultSampleRate: state.config.defaultSampleRate,
    defaultChannels: state.config.defaultChannels,
    defaultSampleFormat: state.config.defaultSampleFormat,
    volume: state.config.volume,
    mute: state.config.mute,
    color: state.config.waveformColor,
    windowSizeSec: state.config.waveformWindowSec,
  };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const audioFoxgloveAdapter: PanelFoxgloveAdapter<AudioConfig> = {
  internalType: 'Audio',
  foxgloveTypes: ['Audio'],
  defaultFoxgloveType: 'Audio',
  fromConfig,
  toConfig,
};
