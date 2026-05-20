import { isRecord } from '@/shared/utils/guards';
import {
  defaultJointStatePlotConfig,
  JOINT_FIELDS,
  MAX_POINTS_PER_JOINT,
  MIN_POINTS_PER_JOINT,
  type JointField,
  type JointStatePlotConfig,
} from './defaults';

export function parseJointStatePlotConfig(input: unknown): JointStatePlotConfig {
  const base = defaultJointStatePlotConfig();
  if (!isRecord(input)) return base;

  const field: JointField = JOINT_FIELDS.includes(input.field as JointField)
    ? (input.field as JointField)
    : base.field;

  const selectedJoints: string[] = Array.isArray(input.selectedJoints)
    ? input.selectedJoints.filter((v): v is string => typeof v === 'string')
    : base.selectedJoints;

  const timestampMode =
    input.timestampMode === 'receiveTime' || input.timestampMode === 'publishTime'
      ? input.timestampMode
      : base.timestampMode;

  const maxPointsPerJoint =
    typeof input.maxPointsPerJoint === 'number' && Number.isFinite(input.maxPointsPerJoint)
      ? Math.max(MIN_POINTS_PER_JOINT, Math.min(MAX_POINTS_PER_JOINT, Math.round(input.maxPointsPerJoint)))
      : base.maxPointsPerJoint;

  return {
    topic: typeof input.topic === 'string' ? input.topic : base.topic,
    field,
    selectedJoints,
    timestampMode,
    maxPointsPerJoint,
  };
}
