import React from 'react';
import { useIntl } from 'react-intl';
import type { UnavailableConfig } from './defaults';

export function UnavailablePanelBody(props: { panelId: string; config: UnavailableConfig }): React.ReactNode {
  const { formatMessage } = useIntl();
  const { panelId, config } = props;
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full border border-border rounded-md p-3 space-y-2">
        <div className="text-sm font-semibold">{formatMessage({ id: 'panels.framework.unavailable.title' })}</div>
        <div className="text-xs text-muted-foreground">
          {formatMessage({ id: 'panels.framework.unavailable.instance' }, { panelId })}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatMessage({ id: 'panels.framework.unavailable.type' }, { panelType: config.originalType })}
        </div>
        <div className="text-xs">{config.reason}</div>
      </div>
    </div>
  );
}
