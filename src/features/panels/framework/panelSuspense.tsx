import React, { Suspense } from 'react';
import { useIntl } from 'react-intl';

function PanelLoadingFallback() {
  const { formatMessage } = useIntl();
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
      {formatMessage({ id: 'layout.panelSuspense.loading' })}
    </div>
  );
}

export function PanelSuspense({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Suspense fallback={<PanelLoadingFallback />}>{children}</Suspense>;
}
