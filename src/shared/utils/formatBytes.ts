/** Human-readable byte size for sidebar dataset metadata. */
export function formatBytes(n: number | undefined): string | undefined {
  if (n == null || !Number.isFinite(n) || n < 0) return undefined;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const digits = u === 0 ? 0 : v < 10 ? 2 : v < 100 ? 1 : 0;
  return `${v.toFixed(digits)} ${units[u]}`;
}
