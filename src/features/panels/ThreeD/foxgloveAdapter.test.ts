import { describe, expect, it } from 'vitest';
import { threeDFoxgloveAdapter } from './foxgloveAdapter';

/**
 * The 3D adapter needs to derive our `urdf` sub-config from Foxglove's
 * `layers[*].layerId === 'foxglove.Urdf'` entry. These tests fix the
 * mapping so that importing a Foxglove layout wires URDF immediately.
 */

describe('threeDFoxgloveAdapter', () => {
  it('extracts URDF topic source from layers', () => {
    const decoded = threeDFoxgloveAdapter.fromConfig({
      cameraState: { fovy: 45 },
      layers: {
        'grid-1': { layerId: 'foxglove.Grid', visible: true },
        'urdf-1': {
          layerId: 'foxglove.Urdf',
          sourceType: 'topic',
          topic: 'robot_description',
          framePrefix: 'robot1/',
          visible: true,
        },
      },
      foxglovePanelTitle: 'My 3D',
    });
    expect(decoded.config.urdf.sourceType).toBe('topic');
    expect(decoded.config.urdf.topic).toBe('robot_description');
    expect(decoded.config.urdf).not.toHaveProperty('framePrefix');
    expect(decoded.title).toBe('My 3D');
    // cameraState is unknown to us, must survive in extras.
    expect(decoded.extras.cameraState).toEqual({ fovy: 45 });
  });

  it('maps Foxglove `filePath` sourceType to our `file` source', () => {
    const decoded = threeDFoxgloveAdapter.fromConfig({
      layers: {
        'urdf-1': {
          layerId: 'foxglove.Urdf',
          sourceType: 'filePath',
          topic: '',
        },
      },
    });
    expect(decoded.config.urdf.sourceType).toBe('file');
  });

  it('falls back to default urdf config when no urdf layer present', () => {
    const decoded = threeDFoxgloveAdapter.fromConfig({
      layers: {
        'grid-1': { layerId: 'foxglove.Grid', visible: true },
      },
    });
    expect(decoded.config.urdf.sourceType).toBe('topic');
    expect(decoded.config.urdf.topic).toBe('');
  });

  it('derives showGrid from a Grid layer visibility', () => {
    const decoded = threeDFoxgloveAdapter.fromConfig({
      layers: {
        'grid-1': { layerId: 'foxglove.Grid', visible: false },
      },
    });
    expect(decoded.config.showGrid).toBe(false);
  });

  it('round-trips unknown config fields verbatim', () => {
    const cameraState = { fovy: 60, perspective: true };
    const input = {
      cameraState,
      publish: { type: 'point' },
      imageMode: {},
      followMode: 'follow-none',
      scene: { meshUpAxis: 'y_up' },
    };
    const decoded = threeDFoxgloveAdapter.fromConfig(input);
    const exported = threeDFoxgloveAdapter.toConfig({
      config: decoded.config,
      extras: decoded.extras,
      title: decoded.title,
    });
    expect(exported.cameraState).toEqual(cameraState);
    expect(exported.publish).toEqual({ type: 'point' });
    expect(exported.imageMode).toEqual({});
    expect(exported.followMode).toBe('follow-none');
    expect(exported.scene).toEqual({ meshUpAxis: 'y_up' });
  });
});
