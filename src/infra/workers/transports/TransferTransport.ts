import type { Remote } from "comlink";
import type { IWorkerSerializedSourceWorker } from "../types";
import type { TransportDiagnostics } from "../transport";
import type { WorkerTransport } from "./BaseWorkerTransport";

export class TransferTransport implements WorkerTransport {
  private readonly _thresholdBytes: number;
  private readonly _fallbackReason?: string;

  constructor(
    thresholdBytes = 64 * 1024,
    fallbackReason?: string,
  ) {
    this._thresholdBytes = thresholdBytes;
    this._fallbackReason = fallbackReason;
  }

  async configure(remote: Remote<IWorkerSerializedSourceWorker>): Promise<void> {
    await remote.configureTransport({
      mode: "transfer",
      binaryPayloadThresholdBytes: this._thresholdBytes,
    });
  }

  async diagnostics(remote: Remote<IWorkerSerializedSourceWorker>): Promise<TransportDiagnostics> {
    return await remote.getTransportDiagnostics();
  }

  mode(): "transfer" {
    return "transfer";
  }

  fallbackReason(): string | undefined {
    return this._fallbackReason;
  }
}

