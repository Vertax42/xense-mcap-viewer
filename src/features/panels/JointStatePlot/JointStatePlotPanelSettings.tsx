import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import type { PanelSettingsContext } from '../framework/types';
import {
  SettingsField,
  SettingsSection,
  SettingsSelect,
  SettingsNumber,
  TopicAutocomplete,
} from '../framework/settings';
import { isJointStateSchema } from '@/shared/ros/rosMessageTypes';
import { MIN_POINTS_PER_JOINT, MAX_POINTS_PER_JOINT, type JointStatePlotConfig } from './defaults';

export function JointStatePlotPanelSettings({
  config,
  setConfig,
  topics,
}: PanelSettingsContext<JointStatePlotConfig>): React.ReactNode {
  const { formatMessage } = useIntl();
  const tsOptions = useMemo(
    () => [
      {
        value: 'headerStamp' as const,
        label: formatMessage({ id: 'panels.jointStatePlot.settings.enum.timestamp.headerStamp' }),
      },
      {
        value: 'receiveTime' as const,
        label: formatMessage({ id: 'panels.jointStatePlot.settings.enum.timestamp.receiveTime' }),
      },
      {
        value: 'publishTime' as const,
        label: formatMessage({ id: 'panels.jointStatePlot.settings.enum.timestamp.publishTime' }),
      },
    ],
    [formatMessage],
  );
  return (
    <div className="space-y-2">
      <SettingsSection title={formatMessage({ id: 'panels.jointStatePlot.settings.section.source' })}>
        <SettingsField label={formatMessage({ id: 'panels.jointStatePlot.settings.field.topic' })}>
          <TopicAutocomplete
            value={config.topic}
            onChange={(topic) => setConfig({ ...config, topic, selectedJoints: [] })}
            topics={topics}
            topicTypeMatches={isJointStateSchema}
            placeholder="/joint_states"
          />
        </SettingsField>
      </SettingsSection>
      <SettingsSection title={formatMessage({ id: 'panels.jointStatePlot.settings.section.sampling' })}>
        <SettingsField label={formatMessage({ id: 'panels.jointStatePlot.settings.field.timestampSource' })}>
          <SettingsSelect<'headerStamp' | 'receiveTime' | 'publishTime'>
            value={config.timestampMode}
            onChange={(timestampMode) => setConfig({ ...config, timestampMode })}
            options={tsOptions}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage(
            { id: 'panels.jointStatePlot.settings.field.maxPointsPerJoint' },
            { n: config.maxPointsPerJoint },
          )}
        >
          <SettingsNumber
            value={config.maxPointsPerJoint}
            min={MIN_POINTS_PER_JOINT}
            max={MAX_POINTS_PER_JOINT}
            step={200}
            onChange={(maxPointsPerJoint) => setConfig({ ...config, maxPointsPerJoint })}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
