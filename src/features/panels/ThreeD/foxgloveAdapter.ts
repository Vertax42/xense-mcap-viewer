import {
  collectExtras,
  FOXGLOVE_PANEL_TITLE_KEY,
  isObject,
  mergeWithExtras,
  type FoxgloveAdapterDecoded,
  type FoxgloveAdapterState,
  type FoxgloveConfig,
  type PanelFoxgloveAdapter,
} from '../framework/foxgloveAdapter';
import { defaultUrdfSource, type ThreeDConfig, type UrdfSource, type UrdfSourceType } from './defaults';
import { parseThreeDConfig } from './schema';

/**
 * Foxglove's `3D` panel carries a rich config (cameraState/layers/scene/...)
 * that goes beyond what our ThreeD renderer currently honours. We:
 * - derive `showGrid` from any `layers` entry of `layerId === 'foxglove.Grid'`;
 * - derive the URDF source from the first `layerId === 'foxglove.Urdf'` layer
 *   so that importing a Foxglove layout wires the URDF panel automatically;
 * - parse the fields our settings already know about;
 * - stash everything else into `extras` for round-trip on export.
 */

const KNOWN_KEYS = [
  'showGrid',
  'showAxes',
  'showPlaceholder',
  'pointSize',
  'urdf',
  'topicSettings',
] as const;

const FOXGLOVE_URDF_SOURCE_MAP: Record<string, UrdfSourceType> = {
  topic: 'topic',
  url: 'url',
  filePath: 'file',
  /** Legacy Foxglove param source → same as subscribing to a string topic. */
  param: 'topic',
  parameter: 'topic',
};

function deriveShowGridFromLayers(config: FoxgloveConfig): boolean | undefined {
  const layers = config.layers;
  if (!isObject(layers)) {
    return undefined;
  }
  for (const value of Object.values(layers)) {
    if (!isObject(value)) continue;
    if (value.layerId === 'foxglove.Grid' && typeof value.visible === 'boolean') {
      return value.visible;
    }
  }
  return undefined;
}

function deriveUrdfFromLayers(config: FoxgloveConfig): UrdfSource | undefined {
  const layers = config.layers;
  if (!isObject(layers)) {
    return undefined;
  }
  for (const value of Object.values(layers)) {
    if (!isObject(value)) continue;
    if (value.layerId !== 'foxglove.Urdf') continue;
    const base = defaultUrdfSource();
    const rawSource = typeof value.sourceType === 'string' ? value.sourceType : 'topic';
    const mapped = FOXGLOVE_URDF_SOURCE_MAP[rawSource] ?? 'topic';
    const sourceType: UrdfSourceType =
      mapped === 'url' ? 'url' : mapped === 'file' ? 'file' : 'topic';
    const topicFromParam =
      rawSource === 'param' || rawSource === 'parameter'
        ? typeof value.parameter === 'string' && value.parameter.length > 0
          ? value.parameter
          : typeof value.topic === 'string'
            ? value.topic
            : base.topic
        : typeof value.topic === 'string'
          ? value.topic
          : base.topic;
    return {
      sourceType,
      topic: topicFromParam,
      url: typeof value.url === 'string' ? value.url : base.url,
      fileContent: base.fileContent,
    };
  }
  return undefined;
}

function fromConfig(config: FoxgloveConfig): FoxgloveAdapterDecoded<ThreeDConfig> {
  const parsed = parseThreeDConfig(config);
  const fromGrid = deriveShowGridFromLayers(config);
  const fromUrdf = deriveUrdfFromLayers(config);
  const merged: ThreeDConfig = {
    ...parsed,
    showGrid: fromGrid ?? parsed.showGrid,
    urdf: fromUrdf ?? parsed.urdf,
  };
  const title = typeof config[FOXGLOVE_PANEL_TITLE_KEY] === 'string'
    ? (config[FOXGLOVE_PANEL_TITLE_KEY])
    : undefined;
  return {
    config: merged,
    extras: collectExtras(config, KNOWN_KEYS),
    title,
  };
}

function toConfig(state: FoxgloveAdapterState<ThreeDConfig>): FoxgloveConfig {
  const known: FoxgloveConfig = {
    showGrid: state.config.showGrid,
    showAxes: state.config.showAxes,
    showPlaceholder: state.config.showPlaceholder,
    pointSize: state.config.pointSize,
    urdf: state.config.urdf,
    topicSettings: state.config.topicSettings,
  };
  if (state.title && state.title.length > 0) {
    known[FOXGLOVE_PANEL_TITLE_KEY] = state.title;
  }
  return mergeWithExtras(state.extras, known);
}

export const threeDFoxgloveAdapter: PanelFoxgloveAdapter<ThreeDConfig> = {
  internalType: '3D',
  foxgloveTypes: ['3D'],
  defaultFoxgloveType: '3D',
  fromConfig,
  toConfig,
};
