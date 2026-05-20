import type {
  BvhChannelKind,
  BvhFlatJoint,
  BvhJointNode,
  BvhJointSample,
  BvhLayout,
  BvhParseResult,
} from "./types";

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function quatFromAxisAngle(axis: Vec3, radians: number): Quat {
  const half = radians * 0.5;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

function rotateVec3(v: Vec3, q: Quat): Vec3 {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function axisForChannel(kind: BvhChannelKind): Vec3 | undefined {
  switch (kind) {
    case "Xrotation":
      return [1, 0, 0];
    case "Yrotation":
      return [0, 1, 0];
    case "Zrotation":
      return [0, 0, 1];
    default:
      return undefined;
  }
}

function flattenJoint(
  node: BvhJointNode,
  parentIndex: number,
  joints: BvhFlatJoint[],
  channelCursor: { value: number },
): void {
  const channelIndices: number[] = [];
  for (let i = 0; i < node.channels.length; i++) {
    channelIndices.push(channelCursor.value++);
  }
  const idx = joints.length;
  joints.push({
    name: node.name,
    parentIndex,
    offset: node.offset,
    channelKinds: node.channels,
    channelIndices,
    isEndSite: node.isEndSite,
  });
  for (const child of node.children) {
    flattenJoint(child, idx, joints, channelCursor);
  }
}

export function buildBvhLayout(parsed: BvhParseResult): BvhLayout {
  const joints: BvhFlatJoint[] = [];
  const cursor = { value: 0 };
  flattenJoint(parsed.root, -1, joints, cursor);
  return {
    joints,
    channelCount: parsed.channelCount,
    frameCount: parsed.frameCount,
    frameTimeSec: parsed.frameTimeSec,
    frames: parsed.frames,
    warnings: parsed.warnings,
  };
}

function channelValue(frame: number[], joint: BvhFlatJoint, kind: BvhChannelKind): number {
  const idx = joint.channelKinds.indexOf(kind);
  if (idx < 0) return 0;
  const channelIdx = joint.channelIndices[idx];
  return Number(frame[channelIdx] ?? 0);
}

export function sampleBvhFrame(layout: BvhLayout, frameIndex: number): BvhJointSample[] {
  if (layout.frameCount === 0) return [];
  const clamped = Math.max(0, Math.min(layout.frameCount - 1, frameIndex));
  const frame = layout.frames[clamped] ?? [];
  const worldPositions: Vec3[] = [];
  const worldRotations: Quat[] = [];
  const out: BvhJointSample[] = [];

  for (let i = 0; i < layout.joints.length; i++) {
    const joint = layout.joints[i];
    if (!joint) continue;
    const localTranslation: Vec3 = [...joint.offset];
    localTranslation[0] += channelValue(frame, joint, "Xposition");
    localTranslation[1] += channelValue(frame, joint, "Yposition");
    localTranslation[2] += channelValue(frame, joint, "Zposition");

    let localRotation: Quat = IDENTITY_QUAT;
    for (let c = 0; c < joint.channelKinds.length; c++) {
      const kind = joint.channelKinds[c];
      if (!kind) continue;
      const axis = axisForChannel(kind);
      if (!axis) continue;
      const channelIndex = joint.channelIndices[c];
      const angleDeg = Number(frame[channelIndex ?? 0] ?? 0);
      const angleRad = (angleDeg * Math.PI) / 180;
      localRotation = quatMul(localRotation, quatFromAxisAngle(axis, angleRad));
    }

    if (joint.parentIndex < 0) {
      worldPositions.push(localTranslation);
      worldRotations.push(localRotation);
    } else {
      const parentPos = worldPositions[joint.parentIndex];
      const parentRot = worldRotations[joint.parentIndex];
      if (!parentPos || !parentRot) continue;
      const rotated = rotateVec3(localTranslation, parentRot);
      worldPositions.push([parentPos[0] + rotated[0], parentPos[1] + rotated[1], parentPos[2] + rotated[2]]);
      worldRotations.push(quatMul(parentRot, localRotation));
    }

    out.push({
      name: joint.name,
      parentIndex: joint.parentIndex,
      position: worldPositions[i] ?? [0, 0, 0],
      isEndSite: joint.isEndSite,
    });
  }

  return out;
}
