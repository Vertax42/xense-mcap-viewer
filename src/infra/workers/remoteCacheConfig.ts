const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const MIN_REMOTE_CACHE_BYTES = 256 * MIB;
const DEFAULT_REMOTE_CACHE_BYTES = 512 * MIB;
const MAX_REMOTE_CACHE_BYTES = GIB;

export function resolveRemoteCacheBytes(): number {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  const reportedGiB =
    nav != undefined && typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;

  if (reportedGiB == undefined || !Number.isFinite(reportedGiB) || reportedGiB <= 0) {
    return DEFAULT_REMOTE_CACHE_BYTES;
  }

  const target = Math.floor(reportedGiB * GIB * 0.25);
  return Math.max(MIN_REMOTE_CACHE_BYTES, Math.min(MAX_REMOTE_CACHE_BYTES, target));
}
