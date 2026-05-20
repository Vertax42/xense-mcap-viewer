export interface RawMessagesConfig {
  topic: string;
  uiRefreshHz: number;
  pauseUpdates: boolean;
  latestOnly: boolean;
  maxExpandedDepth: number;
  maxRows: number;
  maxBinaryPreviewBytes: number;
  binaryCopyFormat: 'uint8array' | 'hex' | 'base64';
}

export const defaultRawMessagesConfig = (): RawMessagesConfig => ({
  topic: '',
  uiRefreshHz: 10,
  pauseUpdates: false,
  latestOnly: true,
  maxExpandedDepth: 4,
  maxRows: 2000,
  maxBinaryPreviewBytes: 256,
  binaryCopyFormat: 'uint8array',
});
