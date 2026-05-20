import { isRecord } from '../framework/types';
import {
  defaultPoseConfig,
  type PoseConfig,
  type PoseFrameMode,
  type PoseTopicSetting,
} from './defaults';

const FRAME_MODES: readonly PoseFrameMode[] = ['raw', 'tfAligned'];

function parseTopics(input: unknown): PoseTopicSetting[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(isRecord)
    .map((entry): PoseTopicSetting | null => {
      const topic = typeof entry.topic === 'string' ? entry.topic.trim() : '';
      if (!topic) return null;
      return {
        topic,
        color:
          typeof entry.color === 'string' && entry.color.trim().length > 0
            ? entry.color.trim()
            : '#38bdf8',
        enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
      };
    })
    .filter((entry): entry is PoseTopicSetting => entry != null);
}

export function parsePoseConfig(input: unknown): PoseConfig {
  const base = defaultPoseConfig();
  if (!isRecord(input)) return base;
  return {
    topics: parseTopics(input.topics),
    historySec:
      typeof input.historySec === 'number' && Number.isFinite(input.historySec)
        ? Math.max(1, Math.min(3600, input.historySec))
        : base.historySec,
    minLineWidth:
      typeof input.minLineWidth === 'number' && Number.isFinite(input.minLineWidth)
        ? Math.max(0.5, Math.min(20, input.minLineWidth))
        : base.minLineWidth,
    maxLineWidth:
      typeof input.maxLineWidth === 'number' && Number.isFinite(input.maxLineWidth)
        ? Math.max(0.5, Math.min(30, input.maxLineWidth))
        : base.maxLineWidth,
    showOrientation:
      typeof input.showOrientation === 'boolean'
        ? input.showOrientation
        : base.showOrientation,
    orientationScale:
      typeof input.orientationScale === 'number' &&
      Number.isFinite(input.orientationScale)
        ? Math.max(0.01, Math.min(2, input.orientationScale))
        : base.orientationScale,
    frameMode: FRAME_MODES.includes(input.frameMode as PoseFrameMode)
      ? (input.frameMode as PoseFrameMode)
      : base.frameMode,
    targetFrame:
      typeof input.targetFrame === 'string' ? input.targetFrame : base.targetFrame,
  };
}
