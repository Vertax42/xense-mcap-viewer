/**
 * ROS message definitions for the virtual topics the HDF5 source emits.
 *
 * These mirror the common `sensor_msgs` / `geometry_msgs` / `std_msgs`
 * schemas so existing panels (Image, Joints, Plot, RawMessages, ThreeD)
 * recognize the topic types without adaptation. We use ROS 2 naming
 * (`<pkg>/msg/<Type>`) and `builtin_interfaces/msg/Time` for headers, to
 * match what MCAP channels carry.
 */

import type { MessageDefinition } from '@foxglove/message-definition';

const TIME_DEF: MessageDefinition = {
  name: 'builtin_interfaces/msg/Time',
  definitions: [
    { name: 'sec', type: 'int32' },
    { name: 'nanosec', type: 'uint32' },
  ],
};

const HEADER_DEF: MessageDefinition = {
  name: 'std_msgs/msg/Header',
  definitions: [
    { name: 'stamp', type: 'builtin_interfaces/msg/Time', isComplex: true },
    { name: 'frame_id', type: 'string' },
  ],
};

const JOINT_STATE_DEF: MessageDefinition = {
  name: 'sensor_msgs/msg/JointState',
  definitions: [
    { name: 'header', type: 'std_msgs/msg/Header', isComplex: true },
    { name: 'name', type: 'string', isArray: true },
    { name: 'position', type: 'float64', isArray: true },
    { name: 'velocity', type: 'float64', isArray: true },
    { name: 'effort', type: 'float64', isArray: true },
  ],
};

const IMAGE_DEF: MessageDefinition = {
  name: 'sensor_msgs/msg/Image',
  definitions: [
    { name: 'header', type: 'std_msgs/msg/Header', isComplex: true },
    { name: 'height', type: 'uint32' },
    { name: 'width', type: 'uint32' },
    { name: 'encoding', type: 'string' },
    { name: 'is_bigendian', type: 'uint8' },
    { name: 'step', type: 'uint32' },
    { name: 'data', type: 'uint8', isArray: true },
  ],
};

const POINT_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/Point',
  definitions: [
    { name: 'x', type: 'float64' },
    { name: 'y', type: 'float64' },
    { name: 'z', type: 'float64' },
  ],
};

const VECTOR3_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/Vector3',
  definitions: [
    { name: 'x', type: 'float64' },
    { name: 'y', type: 'float64' },
    { name: 'z', type: 'float64' },
  ],
};

const QUATERNION_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/Quaternion',
  definitions: [
    { name: 'x', type: 'float64' },
    { name: 'y', type: 'float64' },
    { name: 'z', type: 'float64' },
    { name: 'w', type: 'float64' },
  ],
};

const POSE_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/Pose',
  definitions: [
    { name: 'position', type: 'geometry_msgs/msg/Point', isComplex: true },
    { name: 'orientation', type: 'geometry_msgs/msg/Quaternion', isComplex: true },
  ],
};

const POSE_STAMPED_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/PoseStamped',
  definitions: [
    { name: 'header', type: 'std_msgs/msg/Header', isComplex: true },
    { name: 'pose', type: 'geometry_msgs/msg/Pose', isComplex: true },
  ],
};

const TWIST_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/Twist',
  definitions: [
    { name: 'linear', type: 'geometry_msgs/msg/Vector3', isComplex: true },
    { name: 'angular', type: 'geometry_msgs/msg/Vector3', isComplex: true },
  ],
};

const TWIST_STAMPED_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/TwistStamped',
  definitions: [
    { name: 'header', type: 'std_msgs/msg/Header', isComplex: true },
    { name: 'twist', type: 'geometry_msgs/msg/Twist', isComplex: true },
  ],
};

const WRENCH_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/Wrench',
  definitions: [
    { name: 'force', type: 'geometry_msgs/msg/Vector3', isComplex: true },
    { name: 'torque', type: 'geometry_msgs/msg/Vector3', isComplex: true },
  ],
};

const WRENCH_STAMPED_DEF: MessageDefinition = {
  name: 'geometry_msgs/msg/WrenchStamped',
  definitions: [
    { name: 'header', type: 'std_msgs/msg/Header', isComplex: true },
    { name: 'wrench', type: 'geometry_msgs/msg/Wrench', isComplex: true },
  ],
};

const MULTI_ARRAY_DIMENSION_DEF: MessageDefinition = {
  name: 'std_msgs/msg/MultiArrayDimension',
  definitions: [
    { name: 'label', type: 'string' },
    { name: 'size', type: 'uint32' },
    { name: 'stride', type: 'uint32' },
  ],
};

const MULTI_ARRAY_LAYOUT_DEF: MessageDefinition = {
  name: 'std_msgs/msg/MultiArrayLayout',
  definitions: [
    { name: 'dim', type: 'std_msgs/msg/MultiArrayDimension', isComplex: true, isArray: true },
    { name: 'data_offset', type: 'uint32' },
  ],
};

const FLOAT32_MULTI_ARRAY_DEF: MessageDefinition = {
  name: 'std_msgs/msg/Float32MultiArray',
  definitions: [
    { name: 'layout', type: 'std_msgs/msg/MultiArrayLayout', isComplex: true },
    { name: 'data', type: 'float32', isArray: true },
  ],
};

const FLOAT32_DEF: MessageDefinition = {
  name: 'std_msgs/msg/Float32',
  definitions: [{ name: 'data', type: 'float32' }],
};

export const HDF5_MESSAGE_DEFINITIONS: ReadonlyArray<MessageDefinition> = [
  TIME_DEF,
  HEADER_DEF,
  JOINT_STATE_DEF,
  IMAGE_DEF,
  POINT_DEF,
  VECTOR3_DEF,
  QUATERNION_DEF,
  POSE_DEF,
  POSE_STAMPED_DEF,
  TWIST_DEF,
  TWIST_STAMPED_DEF,
  WRENCH_DEF,
  WRENCH_STAMPED_DEF,
  MULTI_ARRAY_DIMENSION_DEF,
  MULTI_ARRAY_LAYOUT_DEF,
  FLOAT32_MULTI_ARRAY_DEF,
  FLOAT32_DEF,
];

/** Build a datatypes map for `Initialization.datatypes`. */
export function buildHdf5DatatypesMap(): Record<string, MessageDefinition> {
  const out: Record<string, MessageDefinition> = {};
  for (const def of HDF5_MESSAGE_DEFINITIONS) {
    if (def.name) {
      out[def.name] = def;
    }
  }
  return out;
}
