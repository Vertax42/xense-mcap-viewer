import type { MessageDefinition } from "@foxglove/message-definition";

export const BVH_JOINT_SCHEMA_NAME = "embodiflow_msgs/msg/BvhJoint";
export const BVH_SKELETON_SCHEMA_NAME = "embodiflow_msgs/msg/BvhSkeletonFrame";

const BVH_JOINT_DEF: MessageDefinition = {
  name: BVH_JOINT_SCHEMA_NAME,
  definitions: [
    { name: "name", type: "string" },
    { name: "parent_index", type: "int32" },
    { name: "x", type: "float64" },
    { name: "y", type: "float64" },
    { name: "z", type: "float64" },
    { name: "is_end_site", type: "bool" },
  ],
};

const BVH_SKELETON_FRAME_DEF: MessageDefinition = {
  name: BVH_SKELETON_SCHEMA_NAME,
  definitions: [
    { name: "frame_index", type: "int32" },
    { name: "joints", type: "embodiflow_msgs/msg/BvhJoint", isComplex: true, isArray: true },
    { name: "source_warnings", type: "string", isArray: true },
  ],
};

export function buildBvhDatatypesMap(): Record<string, unknown> {
  return {
    [BVH_JOINT_SCHEMA_NAME]: BVH_JOINT_DEF,
    [BVH_SKELETON_SCHEMA_NAME]: BVH_SKELETON_FRAME_DEF,
  };
}
