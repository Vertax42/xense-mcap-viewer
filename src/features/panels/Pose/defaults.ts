export const DEFAULT_POSE_SCHEMA_NAME = 'geometry_msgs/msg/PoseStamped';

export type PoseFrameMode = 'raw' | 'tfAligned';

export interface PoseTopicSetting {
  topic: string;
  color: string;
  enabled: boolean;
}

export interface PoseConfig {
  topics: PoseTopicSetting[];
  historySec: number;
  minLineWidth: number;
  maxLineWidth: number;
  showOrientation: boolean;
  orientationScale: number;
  frameMode: PoseFrameMode;
  targetFrame: string;
}

export const defaultPoseConfig = (): PoseConfig => ({
  topics: [],
  historySec: 30,
  minLineWidth: 1.5,
  maxLineWidth: 6,
  showOrientation: true,
  orientationScale: 0.12,
  frameMode: 'raw',
  targetFrame: 'map',
});
