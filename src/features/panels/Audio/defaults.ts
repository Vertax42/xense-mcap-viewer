export interface AudioConfig {
  topic: string;
  /** Optional ROS topic publishing `audio_common_msgs/AudioInfo`. */
  audioInfoTopic: string;
  defaultSampleRate: number;
  defaultChannels: number;
  defaultSampleFormat: string;
  volume: number;
  mute: boolean;
  /** Waveform color (hex or CSS color). */
  waveformColor: string;
  /** Rolling window for waveform envelope (seconds). */
  waveformWindowSec: number;
}

export const defaultAudioConfig = (): AudioConfig => ({
  topic: '',
  audioInfoTopic: '',
  defaultSampleRate: 48_000,
  defaultChannels: 1,
  defaultSampleFormat: 'S16LE',
  volume: 0.85,
  mute: false,
  waveformColor: '#22c55e',
  waveformWindowSec: 3,
});
