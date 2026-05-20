import type { PanelType } from './types';

const sessionIdSet = new Set<string>();

function nextShortHash(): string {
  // 10-digit base36 random, matching Foxglove `getPanelIdForType`.
  const factor = 1e10;
  return Math.round(Math.random() * factor).toString(36);
}

/**
 * Create a fresh instance id in Foxglove-compatible form `${type}!${hash}`.
 * The prefix before `!` encodes the panel type so that layout JSON shared
 * between Foxglove and this product can be identified purely from id.
 */
export function createPanelInstanceId(type: string): string {
  let next = `${type}!${nextShortHash()}`;
  while (sessionIdSet.has(next)) {
    next = `${type}!${nextShortHash()}`;
  }
  sessionIdSet.add(next);
  return next;
}

/** Record an externally-provided id so subsequent creates do not collide. */
export function markPanelInstanceId(id: string): void {
  sessionIdSet.add(id);
}

/**
 * Extract the Foxglove panel type encoded as the id's prefix (segment before
 * the first `!`). Returns the whole id when no `!` is present (legacy form).
 */
export function getPanelTypeFromId(id: string): string {
  const separatorIndex = id.indexOf('!');
  if (separatorIndex < 0) {
    return id;
  }
  return id.slice(0, separatorIndex);
}

// Compile-time guarantee: PanelType is a subtype of string.
type _PanelTypeIsString = PanelType extends string ? true : never;
const _typeCheck: _PanelTypeIsString = true;
void _typeCheck;
