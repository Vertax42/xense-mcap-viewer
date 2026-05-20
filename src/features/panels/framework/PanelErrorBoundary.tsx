import React from 'react';
import { useIntl } from 'react-intl';

interface PanelErrorBoundaryProps {
  panelName: string;
  panelId: string;
  onReset: () => void;
  children: React.ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

function PanelErrorFallback(props: {
  panelName: string;
  panelId: string;
  error: Error;
  onReset: () => void;
}): React.ReactNode {
  const { formatMessage } = useIntl();
  const { panelName, panelId, error, onReset } = props;
  return (
    <div className="h-full w-full bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-destructive/40 bg-destructive/5 rounded-md p-3 space-y-2">
        <div className="text-sm font-semibold">
          {formatMessage({ id: 'panels.framework.errorBoundary.title' }, { panelName })}
        </div>
        <div className="text-xs text-muted-foreground break-all">
          {formatMessage({ id: 'panels.framework.errorBoundary.instance' }, { panelId })}
        </div>
        <div className="text-xs text-muted-foreground">
          {error.message || formatMessage({ id: 'panels.framework.errorBoundary.unknownError' })}
        </div>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-accent"
          onClick={onReset}
        >
          {formatMessage({ id: 'panels.framework.errorBoundary.resetButton' })}
        </button>
      </div>
    </div>
  );
}

export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  public constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error): void {
    console.error(`Panel crashed: ${this.props.panelName} (${this.props.panelId})`, error);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset();
  };

  public render(): React.ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <PanelErrorFallback
        panelName={this.props.panelName}
        panelId={this.props.panelId}
        error={error}
        onReset={this.handleReset}
      />
    );
  }
}
