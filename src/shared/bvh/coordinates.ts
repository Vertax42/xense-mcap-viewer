export interface BvhCoordinateTransform {
  scale: number;
  yUpToZUp: boolean;
  flipY: boolean;
}

/** Convert BVH coordinates (typically cm, Y-up) into scene coordinates. */
export function transformBvhPointToScene(
  point: [number, number, number],
  transform: BvhCoordinateTransform,
): [number, number, number] {
  let [x, y, z] = point;
  x *= transform.scale;
  y *= transform.scale;
  z *= transform.scale;
  if (transform.yUpToZUp) {
    const nextY = -z;
    const nextZ = y;
    y = nextY;
    z = nextZ;
  }
  if (transform.flipY) {
    y = -y;
  }
  return [x, y, z];
}
