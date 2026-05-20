import type { PanelDefinition } from '../framework/types';
import { defaultUnavailableConfig, type UnavailableConfig } from './defaults';
import { UnavailablePanelBody } from './UnavailablePanelBody';

export const unavailablePanelDefinition: PanelDefinition<UnavailableConfig> = {
  type: 'Unavailable',
  defaultTitle: 'Unavailable',
  createDefaultConfig: defaultUnavailableConfig,
  configSchema: {
    version: 1,
    parse: (input) => {
      const base = defaultUnavailableConfig();
      if (typeof input !== 'object' || input == null) return base;
      const value = input as Record<string, unknown>;
      return {
        originalType: typeof value.originalType === 'string' ? value.originalType : base.originalType,
        reason: typeof value.reason === 'string' ? value.reason : base.reason,
      };
    },
  },
  render: ({ config, panelId }) => <UnavailablePanelBody panelId={panelId} config={config} />,
};
