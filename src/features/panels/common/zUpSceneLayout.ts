import * as THREE from 'three';

export const Z_UP = new THREE.Vector3(0, 0, 1);
export const GIZMO_MARGIN: [number, number] = [80, 80];
export const GIZMO_AXIS_COLORS: [string, string, string] = ['#ff3653', '#0adb46', '#2c8fff'];
export const DEFAULT_GRID_SIZE = 20;
export const DEFAULT_GRID_DIVISIONS = 10;
export const CAMERA_GRID_FILL_RATIO = 0.8;
export const CAMERA_VIEW_DIRECTION = new THREE.Vector3(
  Math.cos(Math.PI / 6),
  0,
  Math.sin(Math.PI / 6),
).normalize();

/** +X toward viewer with a slight top-down angle, +Z up — matches framing in `framePerspectiveCameraToGrid`. */
export const CANVAS_CAMERA = {
  position: [10, 0, 6] as [number, number, number],
  up: [0, 0, 1] as [number, number, number],
  fov: 45,
  near: 0.5,
  far: 5000,
};

export const CANVAS_GL = { antialias: true };

export function framePerspectiveCameraToGrid(
  camera: THREE.PerspectiveCamera,
  center: THREE.Vector3,
  gridSize: number,
  fillRatio: number = CAMERA_GRID_FILL_RATIO,
): void {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const tanHalfV = Math.tan(vFov / 2);
  const tanHalfH = Math.tan(hFov / 2);
  const forward = CAMERA_VIEW_DIRECTION.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, Z_UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const halfSize = gridSize / 2;
  const corners = [
    new THREE.Vector3(-halfSize, -halfSize, 0),
    new THREE.Vector3(-halfSize, halfSize, 0),
    new THREE.Vector3(halfSize, -halfSize, 0),
    new THREE.Vector3(halfSize, halfSize, 0),
  ];

  let distance = 0;
  for (const corner of corners) {
    const towardCamera = corner.dot(CAMERA_VIEW_DIRECTION);
    distance = Math.max(
      distance,
      towardCamera + Math.abs(corner.dot(right)) / (tanHalfH * fillRatio),
      towardCamera + Math.abs(corner.dot(up)) / (tanHalfV * fillRatio),
    );
  }

  camera.up.copy(Z_UP);
  camera.position.copy(center).addScaledVector(CAMERA_VIEW_DIRECTION, distance);
  camera.lookAt(center);
  camera.near = Math.max(0.01, distance / 1500);
  camera.far = Math.max(6000, distance * 80);
  camera.updateProjectionMatrix();
}
