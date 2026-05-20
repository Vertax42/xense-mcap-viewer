import { isRecord } from '../framework/types';
import { defaultAudioConfig, type AudioConfig } from './defaults';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function parseAudioConfig(input: unknown): AudioConfig {
  const base = defaultAudioConfig();
  if (!isRecord(input)) return base;
  const topic = typeof input.topic === 'string' ? input.topic : base.topic;
  const audioInfoTopic = typeof input.audioInfoTopic === 'string' ? input.audioInfoTopic : base.audioInfoTopic;
  const defaultSampleRate =
    typeof input.defaultSampleRate === 'number' && Number.isFinite(input.defaultSampleRate)
      ? clamp(Math.round(input.defaultSampleRate), 8000, 192_000)
      : base.defaultSampleRate;
  const defaultChannels =
    typeof input.defaultChannels === 'number' && Number.isFinite(input.defaultChannels)
      ? clamp(Math.round(input.defaultChannels), 1, 32)
      : base.defaultChannels;
  const defaultSampleFormat =
    typeof input.defaultSampleFormat === 'string' && input.defaultSampleFormat.length > 0
      ? input.defaultSampleFormat
      : base.defaultSampleFormat;
  const volume =
    typeof input.volume === 'number' && Number.isFinite(input.volume) ? clamp(input.volume, 0, 1) : base.volume;
  const mute = typeof input.mute === 'boolean' ? input.mute : base.mute;
  const waveformColor =
    typeof input.waveformColor === 'string' && input.waveformColor.length > 0
      ? input.waveformColor
      : typeof input.color === 'string' && input.color.length > 0
        ? input.color
        : base.waveformColor;
  const waveformWindowSec =
    typeof input.waveformWindowSec === 'number' && Number.isFinite(input.waveformWindowSec)
      ? clamp(input.waveformWindowSec, 0.5, 30)
      : typeof input.windowSizeSec === 'number' && Number.isFinite(input.windowSizeSec)
        ? clamp(input.windowSizeSec, 0.5, 30)
        : base.waveformWindowSec;
  return {
    topic,
    audioInfoTopic,
    defaultSampleRate,
    defaultChannels,
    defaultSampleFormat,
    volume,
    mute,
    waveformColor,
    waveformWindowSec,
  };
}
