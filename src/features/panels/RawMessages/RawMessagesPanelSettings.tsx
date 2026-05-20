import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import type { PanelSettingsContext } from '../framework/types';
import {
  SettingsField,
  SettingsNumber,
  SettingsSelect,
  SettingsSection,
  SettingsSwitch,
  TopicAutocomplete,
} from '../framework/settings';
import type { RawMessagesConfig } from './defaults';

export function RawMessagesPanelSettings({
  config,
  setConfig,
  topics,
}: PanelSettingsContext<RawMessagesConfig>): React.ReactNode {
  const { formatMessage } = useIntl();
  const binaryOptions = useMemo(
    () => [
      {
        value: 'uint8array' as const,
        label: formatMessage({ id: 'panels.rawMessages.settings.enum.binaryCopy.uint8array' }),
      },
      { value: 'hex' as const, label: formatMessage({ id: 'panels.rawMessages.settings.enum.binaryCopy.hex' }) },
      {
        value: 'base64' as const,
        label: formatMessage({ id: 'panels.rawMessages.settings.enum.binaryCopy.base64' }),
      },
    ],
    [formatMessage],
  );
  return (
    <div className="space-y-2">
      <SettingsSection title={formatMessage({ id: 'panels.rawMessages.settings.section.source' })}>
        <SettingsField label={formatMessage({ id: 'panels.rawMessages.settings.field.topic' })}>
          <TopicAutocomplete
            value={config.topic}
            onChange={(topic) => setConfig({ ...config, topic })}
            topics={topics}
          />
        </SettingsField>
      </SettingsSection>
      <SettingsSection title={formatMessage({ id: 'panels.rawMessages.settings.section.display' })}>
        <SettingsField
          label={formatMessage({ id: 'panels.rawMessages.settings.field.uiRefreshHz' })}
          help={formatMessage({ id: 'panels.rawMessages.settings.field.uiRefreshHz.help' })}
        >
          <SettingsNumber
            value={config.uiRefreshHz}
            min={1}
            max={60}
            step={1}
            onChange={(uiRefreshHz) => setConfig({ ...config, uiRefreshHz })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage({ id: 'panels.rawMessages.settings.field.pauseUpdates' })}
          orientation="row"
        >
          <SettingsSwitch
            checked={config.pauseUpdates}
            onChange={(pauseUpdates) => setConfig({ ...config, pauseUpdates })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage({ id: 'panels.rawMessages.settings.field.latestOnly' })}
          orientation="row"
          help={formatMessage({ id: 'panels.rawMessages.settings.field.latestOnly.help' })}
        >
          <SettingsSwitch
            checked={config.latestOnly}
            onChange={(latestOnly) => setConfig({ ...config, latestOnly })}
          />
        </SettingsField>
        <SettingsField label={formatMessage({ id: 'panels.rawMessages.settings.field.maxExpandedDepth' })}>
          <SettingsNumber
            value={config.maxExpandedDepth}
            min={1}
            max={6}
            step={1}
            onChange={(maxExpandedDepth) => setConfig({ ...config, maxExpandedDepth })}
          />
        </SettingsField>
        <SettingsField label={formatMessage({ id: 'panels.rawMessages.settings.field.maxRows' })}>
          <SettingsNumber
            value={config.maxRows}
            min={200}
            max={10000}
            step={100}
            onChange={(maxRows) => setConfig({ ...config, maxRows })}
          />
        </SettingsField>
        <SettingsField
          label={formatMessage({ id: 'panels.rawMessages.settings.field.binaryPreviewBytes' })}
          help={formatMessage({ id: 'panels.rawMessages.settings.field.binaryPreviewBytes.help' })}
        >
          <SettingsNumber
            value={config.maxBinaryPreviewBytes}
            min={16}
            max={8192}
            step={16}
            onChange={(maxBinaryPreviewBytes) => setConfig({ ...config, maxBinaryPreviewBytes })}
          />
        </SettingsField>
        <SettingsField label={formatMessage({ id: 'panels.rawMessages.settings.field.binaryCopyFormat' })}>
          <SettingsSelect
            value={config.binaryCopyFormat}
            options={binaryOptions}
            onChange={(next: RawMessagesConfig['binaryCopyFormat']) =>
              setConfig({ ...config, binaryCopyFormat: next })
            }
          />
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
