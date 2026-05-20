import React from 'react';
import { useIntl } from 'react-intl';
import type { PanelSettingsContext } from '../framework/types';
import { SettingsField, SettingsSection, SettingsSwitch } from '../framework/settings';
import type { TimelineConfig } from './defaults';

export function TimelinePanelSettings({
  config,
  setConfig,
}: PanelSettingsContext<TimelineConfig>): React.ReactNode {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-2">
      <SettingsSection title={formatMessage({ id: 'panels.timeline.settings.section.display' })}>
        <SettingsField
          label={formatMessage({ id: 'panels.timeline.settings.field.showFrameDrops' })}
          orientation="row"
        >
          <SettingsSwitch
            checked={config.showDrops}
            onChange={(showDrops) => setConfig({ ...config, showDrops })}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
