export type BvhChannelKind =
  | "Xposition"
  | "Yposition"
  | "Zposition"
  | "Xrotation"
  | "Yrotation"
  | "Zrotation"
  | "Unknown";

export interface BvhJointNode {
  name: string;
  offset: [number, number, number];
  channels: BvhChannelKind[];
  children: BvhJointNode[];
  isEndSite: boolean;
}

export interface BvhParseResult {
  root: BvhJointNode;
  channelCount: number;
  frameCount: number;
  frameTimeSec: number;
  frames: number[][];
  warnings: string[];
}

export interface BvhFlatJoint {
  name: string;
  parentIndex: number;
  offset: [number, number, number];
  channelKinds: BvhChannelKind[];
  channelIndices: number[];
  isEndSite: boolean;
}

export interface BvhLayout {
  joints: BvhFlatJoint[];
  channelCount: number;
  frameCount: number;
  frameTimeSec: number;
  frames: number[][];
  warnings: string[];
}

export interface BvhJointSample {
  name: string;
  parentIndex: number;
  position: [number, number, number];
  isEndSite: boolean;
}

export interface BvhSkeletonFrameMsg {
  frame_index: number;
  joints: Array<{
    name: string;
    parent_index: number;
    x: number;
    y: number;
    z: number;
    is_end_site: boolean;
  }>;
  source_warnings: string[];
}
