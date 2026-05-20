import type { TimestampMode } from '@/core/analysis/timeSeries';

export const JOINT_FIELDS = ['position', 'velocity', 'effort'] as const;
export type JointField = (typeof JOINT_FIELDS)[number];

export const MIN_POINTS_PER_JOINT = 200;
export const MAX_POINTS_PER_JOINT = 10_000;

export interface JointStatePlotConfig {
  topic: string;
  /** Which JointState field to plot. */
  field: JointField;
  /**
   * Joint names to display. Empty array means "show all".
   * Populated from the `name[]` array in received JointState messages.
   */
  selectedJoints: string[];
  timestampMode: TimestampMode;
  /** Max stored points per joint series before downsampling kicks in. */
  maxPointsPerJoint: number;
}

export const defaultJointStatePlotConfig = (): JointStatePlotConfig => ({
  topic: '',
  field: 'position',
  selectedJoints: [],
  timestampMode: 'headerStamp',
  maxPointsPerJoint: 2000,
});
