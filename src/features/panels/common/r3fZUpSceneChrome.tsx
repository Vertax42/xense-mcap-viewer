import React, { useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  DEFAULT_GRID_SIZE,
  framePerspectiveCameraToGrid,
  GIZMO_AXIS_COLORS,
  GIZMO_MARGIN,
} from '@/features/panels/common/zUpSceneLayout';

export const SceneBackgroundLayer: React.FC<{ background: THREE.ColorRepresentation }> = React.memo(
  ({ background }) => <color attach="background" args={[background]} />,
);
SceneBackgroundLayer.displayName = 'SceneBackgroundLayer';

/**
 * Z-up perspective camera framed to the default ground grid (same as 3D panel).
 */
export const ZUpCameraSetup: React.FC = () => {
  const { camera, size, invalidate } = useThree();
  const didInitialFitRef = useRef(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // New camera instance (e.g. remounted Canvas): run full grid framing again once.
  useEffect(() => {
    cameraRef.current = camera as THREE.PerspectiveCamera;
    didInitialFitRef.current = false;
  }, [camera]);

  useEffect(() => {
    const persp = cameraRef.current;
    if (!persp) return;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0) return;

    persp.aspect = w / h;

    if (!didInitialFitRef.current) {
      framePerspectiveCameraToGrid(persp, new THREE.Vector3(0, 0, 0), DEFAULT_GRID_SIZE);
      didInitialFitRef.current = true;
    } else {
      // Viewport resize only: keep OrbitControls position/target/zoom; update projection only.
      persp.updateProjectionMatrix();
    }
    invalidate();
  }, [size.width, size.height, invalidate]);
  return null;
};

export const R3fZUpGizmoLayer: React.FC<{ labelColor: string }> = React.memo(({ labelColor }) => {
  const { invalidate } = useThree();
  const handleControlsChange = useCallback(() => {
    invalidate();
  }, [invalidate]);
  return (
    <>
      <OrbitControls makeDefault={true} onChange={handleControlsChange} />
      <GizmoHelper alignment="bottom-right" margin={GIZMO_MARGIN}>
        <GizmoViewport axisColors={GIZMO_AXIS_COLORS} labelColor={labelColor} />
      </GizmoHelper>
    </>
  );
});
R3fZUpGizmoLayer.displayName = 'R3fZUpGizmoLayer';
