/**
 * Runtime type guards used across schema parsers and panel configs.
 * Kept separate from type-declaration files so that guard functions
 * (which produce runtime code) have a clear home.
 */

/** Returns true for plain objects: non-null, non-array objects. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}
