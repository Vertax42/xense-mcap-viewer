import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import type { PanelSettingsContext } from '../framework/types';
import {
  SettingsField,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from '../framework/settings';
import type { TopicGraphConfig } from './defaults';

export function TopicGraphPanelSettings({
  config,
  setConfig,
}: PanelSettingsContext<TopicGraphConfig>): React.ReactNode {
  const { formatMessage } = useIntl();
  const rankOptions = useMemo(
    () => [
      {
        value: 'LR' as const,
        label: formatMessage({ id: 'panels.topicGraph.settings.enum.rankDir.lr' }),
      },
      {
        value: 'TB' as const,
        label: formatMessage({ id: 'panels.topicGraph.settings.enum.rankDir.tb' }),
      },
    ],
    [formatMessage],
  );
  return (
    <div className="space-y-2">
      <SettingsSection title={formatMessage({ id: 'panels.topicGraph.settings.section.layout' })}>
        <SettingsField label={formatMessage({ id: 'panels.topicGraph.settings.field.orientation' })}>
          <SettingsSelect<'LR' | 'TB'>
            value={config.rankDir}
            options={rankOptions}
            onChange={(rankDir) => setConfig({ ...config, rankDir: rankDir === 'TB' ? 'TB' : 'LR' })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage({ id: 'panels.topicGraph.settings.field.showInlineControls' })}
          orientation="row"
        >
          <SettingsSwitch
            checked={config.showControls}
            onChange={(showControls) => setConfig({ ...config, showControls })}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
