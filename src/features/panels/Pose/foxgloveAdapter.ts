import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import type { PoseConfig } from './defaults';
import { parsePoseConfig } from './schema';

const KNOWN_KEYS = [
  'topics',
  'historySec',
  'minLineWidth',
  'maxLineWidth',
  'showOrientation',
  'orientationScale',
  'frameMode',
  'targetFrame',
] as const;

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<PoseConfig> {
  const title =
    typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
      ? config[FOXGLOVE_PANEL_TITLE_KEY]
      : undefined;
  return {
    config: parsePoseConfig(config),
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<PoseConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = { ...state.config };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const poseFoxgloveAdapter: PanelFoxgloveAdapter<PoseConfig> = {
  internalType: 'Pose',
  foxgloveTypes: ['Pose'],
  defaultFoxgloveType: 'Pose',
  fromConfig,
  toConfig,
};
