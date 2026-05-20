export type TransportMode = "sab" | "transfer" | "comlink";

export interface SharedPayloadRef {
  __xenseSharedPayloadRef: true;
  seq: number;
  slot: number;
  length: number;
}

export interface SharedPayloadRingConfig {
  control: SharedArrayBuffer;
  data: SharedArrayBuffer;
  slotCount: number;
  slotSizeBytes: number;
}

export interface WorkerTransportConfig {
  mode: TransportMode;
  binaryPayloadThresholdBytes: number;
  payloadRing?: SharedPayloadRingConfig;
}

export interface TransportDiagnostics {
  mode: TransportMode;
  fallbackReason?: string;
  crossOriginIsolated?: boolean;
  binaryPayloadThresholdBytes?: number;
  sharedPayloadRing?: {
    slotCount: number;
    slotSizeBytes: number;
    totalBytes: number;
  };
  droppedPayloads: number;
  stalePayloadRefs: number;
}

export function isSharedPayloadRef(value: unknown): value is SharedPayloadRef {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (value as SharedPayloadRef).__xenseSharedPayloadRef === true;
}

