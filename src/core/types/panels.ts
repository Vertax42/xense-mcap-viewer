export interface PanelConfig {
  id: string;
  type: string;
  title: string;
  params?: unknown;
}

export interface PanelInfo {
  type: string;
  title: string;
  supportedMessageTypes?: string[];
}
