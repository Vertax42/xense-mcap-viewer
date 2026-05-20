import type { Remote } from "comlink";
import type { IWorkerSerializedSourceWorker } from "../types";
import type { TransportDiagnostics, WorkerTransportConfig } from "../transport";

export interface WorkerTransport {
  configure(remote: Remote<IWorkerSerializedSourceWorker>): Promise<void>;
  diagnostics(remote: Remote<IWorkerSerializedSourceWorker>): Promise<TransportDiagnostics>;
  mode(): WorkerTransportConfig["mode"];
  fallbackReason(): string | undefined;
}

