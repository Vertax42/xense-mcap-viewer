import type { TransportMode } from "./transport";

export interface DetectTransportResult {
  mode: TransportMode;
  fallbackReason?: string;
}

function readTransportOverride(): TransportMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const forced = new URLSearchParams(window.location.search).get("transport");
  if (forced === "sab" || forced === "transfer" || forced === "comlink") {
    return forced;
  }
  return undefined;
}

export function detectTransportMode(): DetectTransportResult {
  const forcedMode = readTransportOverride();
  if (forcedMode) {
    return { mode: forcedMode, fallbackReason: "forced by query parameter" };
  }

  const hasSAB = typeof SharedArrayBuffer !== "undefined";
  const hasAtomics = typeof Atomics !== "undefined";
  const isIsolated = typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false;

  if (hasSAB && hasAtomics && isIsolated) {
    return { mode: "sab" };
  }
  if (!isIsolated) {
    return { mode: "transfer", fallbackReason: "cross-origin isolation unavailable" };
  }
  if (!hasSAB) {
    return { mode: "transfer", fallbackReason: "SharedArrayBuffer unavailable" };
  }
  if (!hasAtomics) {
    return { mode: "transfer", fallbackReason: "Atomics unavailable" };
  }
  return { mode: "comlink", fallbackReason: "transfer fallback path" };
}

