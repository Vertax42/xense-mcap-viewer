import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import type { TopicInfo } from '@/core/types/ros';
import type { PanelSettingsContext } from '../framework/types';
import {
  SettingsField,
  SettingsNumber,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
  SettingsText,
} from '../framework/settings';
import {
  type PoseConfig,
  type PoseFrameMode,
} from './defaults';
import { isPoseStampedSchema, ROS_MSG_POSE_STAMPED } from '@/shared/ros/rosMessageTypes';

const DEFAULT_TOPIC_COLORS = [
  '#38bdf8',
  '#f97316',
  '#22c55e',
  '#e879f9',
  '#f43f5e',
  '#facc15',
] as const;

function pickPoseStampedTopics(topics: ReadonlyArray<TopicInfo>): TopicInfo[] {
  return topics.filter((topic) => isPoseStampedSchema(topic.type));
}

export function PosePanelSettings({
  config,
  setConfig,
  topics,
}: PanelSettingsContext<PoseConfig>): React.ReactNode {
  const { formatMessage } = useIntl();
  const frameModeOptions = useMemo(
    () =>
      [
        {
          value: 'raw' as const,
          label: formatMessage({ id: 'panels.pose.settings.enum.frameMode.raw' }),
        },
        {
          value: 'tfAligned' as const,
          label: formatMessage({ id: 'panels.pose.settings.enum.frameMode.tfAligned' }),
        },
      ] satisfies ReadonlyArray<{ value: PoseFrameMode; label: string }>,
    [formatMessage],
  );

  const schemaTopics = pickPoseStampedTopics(topics);
  const configByTopic = new Map(config.topics.map((entry) => [entry.topic, entry]));
  const mergedTopics = schemaTopics.map((topic, index) => {
    const existing = configByTopic.get(topic.name);
    return {
      topic: topic.name,
      color: existing?.color ?? DEFAULT_TOPIC_COLORS[index % DEFAULT_TOPIC_COLORS.length],
      enabled: existing?.enabled ?? true,
    };
  });
  const allEnabled = mergedTopics.length > 0 && mergedTopics.every((entry) => entry.enabled);
  const anyEnabled = mergedTopics.some((entry) => entry.enabled);

  return (
    <div className="space-y-2">
      <SettingsSection title={formatMessage({ id: 'panels.pose.settings.section.source' })}>
        <SettingsField
          label={formatMessage({ id: 'panels.pose.settings.field.schemaAuto.label' })}
          help={formatMessage({ id: 'panels.pose.settings.field.schemaAuto.help' })}
        >
          <div className="rounded border border-border/50 bg-muted/30 p-2 text-[10px] font-mono text-muted-foreground">
            {ROS_MSG_POSE_STAMPED}
          </div>
        </SettingsField>
        <SettingsField
          label={formatMessage({ id: 'panels.pose.settings.field.topics.label' })}
          help={formatMessage({ id: 'panels.pose.settings.field.topics.help' })}
        >
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-input bg-background px-2 py-1 text-[10px] hover:bg-accent"
                onClick={() =>
                  setConfig({
                    ...config,
                    topics: mergedTopics.map((entry) => ({ ...entry, enabled: true })),
                  })
                }
                disabled={mergedTopics.length === 0 || allEnabled}
              >
                {formatMessage({ id: 'panels.pose.settings.button.selectAll' })}
              </button>
              <button
                type="button"
                className="rounded border border-input bg-background px-2 py-1 text-[10px] hover:bg-accent"
                onClick={() =>
                  setConfig({
                    ...config,
                    topics: mergedTopics.map((entry) => ({ ...entry, enabled: false })),
                  })
                }
                disabled={!anyEnabled}
              >
                {formatMessage({ id: 'panels.pose.settings.button.clearAll' })}
              </button>
            </div>
            {mergedTopics.length === 0 ? (
              <div className="rounded border border-border/50 bg-muted/30 p-2 text-[10px] text-muted-foreground">
                {formatMessage({ id: 'panels.pose.settings.empty.noPoseStamped' })}
              </div>
            ) : (
              <div className="space-y-2">
                {mergedTopics.map((entry) => (
                  <div key={entry.topic} className="rounded border border-border/50 bg-muted/20 p-2">
                    <SettingsField label={entry.topic} orientation="row">
                      <SettingsSwitch
                        checked={entry.enabled}
                        onChange={(enabled) =>
                          setConfig({
                            ...config,
                            topics: mergedTopics.map((topicEntry) =>
                              topicEntry.topic === entry.topic ? { ...topicEntry, enabled } : topicEntry,
                            ),
                          })
                        }
                      />
                    </SettingsField>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <SettingsField label={formatMessage({ id: 'panels.pose.settings.field.color' })}>
                        <input
                          type="color"
                          value={entry.color}
                          onChange={(event) =>
                            setConfig({
                              ...config,
                              topics: mergedTopics.map((topicEntry) =>
                                topicEntry.topic === entry.topic
                                  ? { ...topicEntry, color: event.target.value }
                                  : topicEntry,
                              ),
                            })
                          }
                          className="h-8 w-full rounded border border-input bg-background"
                        />
                      </SettingsField>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={formatMessage({ id: 'panels.pose.settings.section.trajectory' })}>
        <SettingsField
          label={formatMessage(
            { id: 'panels.pose.settings.field.historyWindow' },
            { sec: config.historySec.toFixed(0) },
          )}
        >
          <SettingsNumber
            value={config.historySec}
            min={1}
            max={3600}
            step={1}
            onChange={(historySec) => setConfig({ ...config, historySec })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage(
            { id: 'panels.pose.settings.field.minLineWidth' },
            { px: config.minLineWidth.toFixed(1) },
          )}
        >
          <SettingsNumber
            value={config.minLineWidth}
            min={0.5}
            max={20}
            step={0.1}
            onChange={(minLineWidth) => setConfig({ ...config, minLineWidth })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage(
            { id: 'panels.pose.settings.field.maxLineWidth' },
            { px: config.maxLineWidth.toFixed(1) },
          )}
        >
          <SettingsNumber
            value={config.maxLineWidth}
            min={0.5}
            max={30}
            step={0.1}
            onChange={(maxLineWidth) => setConfig({ ...config, maxLineWidth })}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={formatMessage({ id: 'panels.pose.settings.section.pose' })}>
        <SettingsField
          label={formatMessage({ id: 'panels.pose.settings.field.showOrientation' })}
          orientation="row"
        >
          <SettingsSwitch
            checked={config.showOrientation}
            onChange={(showOrientation) =>
              setConfig({
                ...config,
                showOrientation,
              })
            }
          />
        </SettingsField>
        <SettingsField
          label={formatMessage(
            { id: 'panels.pose.settings.field.orientationScale' },
            { scale: config.orientationScale.toFixed(2) },
          )}
        >
          <SettingsNumber
            value={config.orientationScale}
            min={0.01}
            max={2}
            step={0.01}
            onChange={(orientationScale) => setConfig({ ...config, orientationScale })}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={formatMessage({ id: 'panels.pose.settings.section.frame' })}>
        <SettingsField label={formatMessage({ id: 'panels.pose.settings.field.frameMode' })}>
          <SettingsSelect<PoseFrameMode>
            value={config.frameMode}
            options={frameModeOptions}
            onChange={(frameMode) => setConfig({ ...config, frameMode })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage({ id: 'panels.pose.settings.field.targetFrame.label' })}
          help={formatMessage({ id: 'panels.pose.settings.field.targetFrame.help' })}
        >
          <SettingsText
            value={config.targetFrame}
            onChange={(targetFrame: string) => setConfig({ ...config, targetFrame })}
            placeholder={formatMessage({ id: 'panels.pose.settings.field.targetFrame.placeholder' })}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
