import { lazy } from 'react';
import type { PanelDefinition } from '../framework/types';
import { PanelSuspense } from '../framework/panelSuspense';
import { defaultPoseConfig, type PoseConfig } from './defaults';
import { parsePoseConfig } from './schema';
import { ROS_MSG_POSE_STAMPED } from '@/shared/ros/rosMessageTypes';
import { PosePanelSettings } from './PosePanelSettings';

const PosePanel = lazy(async () => {
  const m = await import('./PosePanel');
  return { default: m.PosePanel };
});

export const posePanelDefinition: PanelDefinition<PoseConfig> = {
  type: 'Pose',
  defaultTitle: 'Pose',
  schemaSupport: {
    supportedSchemas: [ROS_MSG_POSE_STAMPED],
  },
  createDefaultConfig: defaultPoseConfig,
  configSchema: { version: 1, parse: parsePoseConfig },
  render: ({ player, panelId, config }) => (
    <PanelSuspense>
      <PosePanel player={player} panelId={panelId} config={config} />
    </PanelSuspense>
  ),
  renderSettings: (ctx) => <PosePanelSettings {...ctx} />,
};
