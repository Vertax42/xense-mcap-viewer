import type { PanelType } from './types';

/** Foxglove `configById[id]` is an arbitrary JSON object. */
export type FoxgloveConfig = Record<string, unknown>;

/** Foxglove stores panel title under this key inside its config. */
export const FOXGLOVE_PANEL_TITLE_KEY = 'foxglovePanelTitle';

/** Decoded view of a Foxglove panel config in our runtime shape. */
export interface FoxgloveAdapterDecoded<TConfig> {
  /** Parsed typed config ready for the panel's `render`/`renderSettings`. */
  config: TConfig;
  /** Unknown fields retained verbatim so re-export stays lossless. */
  extras: Record<string, unknown>;
  /** Title read from `config.foxglovePanelTitle` (if present). */
  title?: string;
}

/** Input to `toConfig` when serializing back to Foxglove. */
export interface FoxgloveAdapterState<TConfig> {
  config: TConfig;
  extras?: Record<string, unknown>;
  title?: string;
}

export interface PanelFoxgloveAdapter<TConfig = unknown> {
  /** Our internal panel type (runtime renderer). */
  internalType: PanelType;
  /** Foxglove type strings this adapter handles on import (e.g. `['Image', 'Canvas']`). */
  foxgloveTypes: readonly string[];
  /**
   * Foxglove type string to emit when serializing. When the id prefix is
   * also known (e.g. preserved from import) the caller should prefer that
   * over `defaultFoxgloveType` so `Canvas!xxx` imports round-trip as Canvas.
   */
  defaultFoxgloveType: string;
  fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<TConfig>;
  toConfig(state: FoxgloveAdapterState<TConfig>): FoxgloveConfig;
}

/**
 * Utility: collect "extras" as all keys of `config` that are not in
 * `knownKeys` and not the panel-title key. Returned as a shallow copy.
 */
export function collectExtras(
  config: FoxgloveConfig,
  knownKeys: readonly string[],
): Record<string, unknown> {
  const known = new Set<string>([...knownKeys, FOXGLOVE_PANEL_TITLE_KEY]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (!known.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Utility: merge extras + known fields into a Foxglove config, with known
 * fields winning so latest runtime values are authoritative.
 */
export function mergeWithExtras(
  extras: Record<string, unknown> | undefined,
  known: FoxgloveConfig,
): FoxgloveConfig {
  if (!extras) {
    return { ...known };
  }
  return { ...extras, ...known };
}

/** Type guard for plain objects. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}
