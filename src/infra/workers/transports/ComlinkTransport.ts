import type { Remote } from "comlink";
import type { IWorkerSerializedSourceWorker } from "../types";
import type { TransportDiagnostics } from "../transport";
import type { WorkerTransport } from "./BaseWorkerTransport";

export class ComlinkTransport implements WorkerTransport {
  async configure(remote: Remote<IWorkerSerializedSourceWorker>): Promise<void> {
    await remote.configureTransport({
      mode: "comlink",
      binaryPayloadThresholdBytes: Number.MAX_SAFE_INTEGER,
    });
  }

  async diagnostics(remote: Remote<IWorkerSerializedSourceWorker>): Promise<TransportDiagnostics> {
    return await remote.getTransportDiagnostics();
  }

  mode(): "comlink" {
    return "comlink";
  }

  fallbackReason(): string | undefined {
    return undefined;
  }
}

