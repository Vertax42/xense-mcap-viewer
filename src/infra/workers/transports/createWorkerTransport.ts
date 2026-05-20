import { detectTransportMode } from "../detectTransport";
import { ComlinkTransport } from "./ComlinkTransport";
import type { WorkerTransport } from "./BaseWorkerTransport";
import { SabTransport } from "./SabTransport";
import { TransferTransport } from "./TransferTransport";

export function createWorkerTransport(): WorkerTransport {
  const detect = detectTransportMode();
  if (detect.mode === "sab") {
    return new SabTransport();
  }
  if (detect.mode === "transfer") {
    return new TransferTransport(64 * 1024, detect.fallbackReason);
  }
  return new ComlinkTransport();
}

