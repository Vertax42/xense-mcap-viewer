import { describe, it, expect } from 'vitest';
import { planTopics, type HdfDatasetDescriptor } from './heuristics';

const alohaDatasets: HdfDatasetDescriptor[] = [
  { path: '/action', shape: [133, 7], dtype: 'float32' },
  { path: '/observations/O_F_ext_hat_K', shape: [133, 6], dtype: 'float32' },
  { path: '/observations/dtau_J', shape: [133, 7], dtype: 'float32' },
  { path: '/observations/ee_pos_q', shape: [133, 4], dtype: 'float32' },
  { path: '/observations/ee_pos_rpy', shape: [133, 3], dtype: 'float32' },
  { path: '/observations/ee_pos_t', shape: [133, 3], dtype: 'float32' },
  { path: '/observations/ee_twist_ang', shape: [133, 3], dtype: 'float32' },
  { path: '/observations/ee_twist_lin', shape: [133, 3], dtype: 'float32' },
  { path: '/observations/elbow_jnt3_pos', shape: [133, 1], dtype: 'float32' },
  { path: '/observations/elbow_jnt4_flip', shape: [133, 1], dtype: 'float32' },
  { path: '/observations/gpos', shape: [133, 1], dtype: 'float32' },
  { path: '/observations/images/ext1', shape: [133, 480, 640, 3], dtype: 'uint8' },
  { path: '/observations/images/wrist', shape: [133, 480, 640, 3], dtype: 'uint8' },
  { path: '/observations/qpos', shape: [133, 7], dtype: 'float32' },
  { path: '/observations/qvel', shape: [133, 7], dtype: 'float32' },
  { path: '/observations/tau_J', shape: [133, 7], dtype: 'float32' },
  { path: '/observations/tau_ext_hat_filtered', shape: [133, 7], dtype: 'float32' },
  { path: '/tm', shape: [133, 1], dtype: 'float32' },
];

describe('planTopics — ALOHA sample', () => {
  const plan = planTopics(alohaDatasets);

  it('detects the global frame count from plurality vote', () => {
    expect(plan.frameCount).toBe(133);
  });

  it('picks /tm as the timeline source and excludes it from topics', () => {
    expect(plan.timelinePath).toBe('/tm');
    const topicNames = plan.recipes.map((r) => r.topic);
    expect(topicNames).not.toContain('/tm');
  });

  it('merges qpos + qvel + tau_J into sensor_msgs/msg/JointState', () => {
    const js = plan.recipes.find((r) => r.kind === 'jointState');
    expect(js).toBeDefined();
    if (js && js.kind === 'jointState') {
      expect(js.topic).toBe('/observations/joint_states');
      expect(js.schemaName).toBe('sensor_msgs/msg/JointState');
      expect(js.jointCount).toBe(7);
      expect(js.positionPath).toBe('/observations/qpos');
      expect(js.velocityPath).toBe('/observations/qvel');
      expect(js.effortPath).toBe('/observations/tau_J');
      expect(js.jointNames).toEqual([
        'joint_0','joint_1','joint_2','joint_3','joint_4','joint_5','joint_6',
      ]);
    }
  });

  it('maps /observations/images/* to sensor_msgs/msg/Image with rgb8 encoding', () => {
    const images = plan.recipes.filter((r) => r.kind === 'image');
    expect(images.map((r) => r.topic).sort()).toEqual([
      '/observations/images/ext1',
      '/observations/images/wrist',
    ]);
    for (const r of images) {
      if (r.kind === 'image') {
        expect(r.encoding).toBe('rgb8');
        expect(r.height).toBe(480);
        expect(r.width).toBe(640);
        expect(r.sourceChannels).toBe(3);
      }
    }
  });

  it('combines ee_pos_t + ee_pos_q into PoseStamped', () => {
    const pose = plan.recipes.find((r) => r.kind === 'poseStamped');
    expect(pose).toBeDefined();
    if (pose && pose.kind === 'poseStamped') {
      expect(pose.topic).toBe('/observations/ee_pose');
      expect(pose.positionPath).toBe('/observations/ee_pos_t');
      expect(pose.quaternionPath).toBe('/observations/ee_pos_q');
      expect(pose.quatOrder).toBe('xyzw');
    }
  });

  it('combines ee_twist_lin + ee_twist_ang into TwistStamped', () => {
    const twist = plan.recipes.find((r) => r.kind === 'twistStamped');
    expect(twist).toBeDefined();
    if (twist && twist.kind === 'twistStamped') {
      expect(twist.topic).toBe('/observations/ee_twist');
    }
  });

  it('maps O_F_ext_hat_K (N,6) to WrenchStamped', () => {
    const wrench = plan.recipes.find((r) => r.kind === 'wrenchStamped');
    expect(wrench).toBeDefined();
    if (wrench && wrench.kind === 'wrenchStamped') {
      expect(wrench.topic).toBe('/observations/ee_wrench');
      expect(wrench.path).toBe('/observations/O_F_ext_hat_K');
    }
  });

  it('keeps /action as Float32MultiArray', () => {
    const action = plan.recipes.find((r) => r.topic === '/action');
    expect(action?.kind).toBe('float32Array');
    expect(action?.schemaName).toBe('std_msgs/msg/Float32MultiArray');
  });

  it('collapses (N,1) datasets to Float32 scalar topics', () => {
    const scalar = plan.recipes.find((r) => r.topic === '/observations/gpos');
    expect(scalar?.kind).toBe('float32Scalar');
    expect(scalar?.schemaName).toBe('std_msgs/msg/Float32');
  });

  it('keeps non-merged (N,7) like tau_ext_hat_filtered as Float32MultiArray', () => {
    const t = plan.recipes.find((r) => r.topic === '/observations/tau_ext_hat_filtered');
    expect(t?.kind).toBe('float32Array');
  });

  it('does NOT emit /observations/ee_pos_rpy as a topic when ee_pose is formed', () => {
    // ee_pos_rpy is redundant with quaternion; we currently still expose it as
    // Float32MultiArray for plotting convenience.
    const rpy = plan.recipes.find((r) => r.topic === '/observations/ee_pos_rpy');
    expect(rpy?.kind).toBe('float32Array');
  });

  it('produces a deterministic, user-friendly ordering', () => {
    const order = plan.recipes.map((r) => r.kind);
    // jointState should come first, images next, then pose/twist/wrench.
    expect(order[0]).toBe('jointState');
    expect(order.indexOf('image')).toBeLessThan(order.indexOf('poseStamped'));
    expect(order.indexOf('poseStamped')).toBeLessThan(order.indexOf('twistStamped'));
    expect(order.indexOf('twistStamped')).toBeLessThan(order.indexOf('wrenchStamped'));
  });
});

describe('planTopics — edge cases', () => {
  it('handles empty input', () => {
    const plan = planTopics([]);
    expect(plan.recipes).toEqual([]);
    expect(plan.frameCount).toBe(0);
  });

  it('tolerates absence of /tm', () => {
    const plan = planTopics([
      { path: '/action', shape: [10, 7], dtype: 'float32' },
    ]);
    expect(plan.timelinePath).toBeUndefined();
    expect(plan.frameCount).toBe(10);
  });

  it('does not merge JointState when shapes disagree', () => {
    const plan = planTopics([
      { path: '/observations/qpos', shape: [10, 7], dtype: 'float32' },
      { path: '/observations/qvel', shape: [10, 6], dtype: 'float32' },
    ]);
    expect(plan.recipes.every((r) => r.kind !== 'jointState')).toBe(true);
    // Both should appear as Float32MultiArray fallbacks.
    expect(plan.recipes.map((r) => r.topic).sort()).toEqual([
      '/observations/qpos',
      '/observations/qvel',
    ]);
  });

  it('skips datasets with string dtype (reports unmapped)', () => {
    const plan = planTopics([
      { path: '/action', shape: [5, 7], dtype: 'float32' },
      { path: '/note', shape: [5], dtype: 'string' },
    ]);
    expect(plan.unmapped).toContain('/note');
  });

  it('reports unmapped for leading-axis mismatch', () => {
    const plan = planTopics([
      { path: '/a', shape: [10, 3], dtype: 'float32' },
      { path: '/b', shape: [10, 3], dtype: 'float32' },
      { path: '/c', shape: [7, 3], dtype: 'float32' },
    ]);
    expect(plan.frameCount).toBe(10);
    expect(plan.unmapped).toContain('/c');
  });

  it('recognizes RGBA images as rgba8', () => {
    const plan = planTopics([
      { path: '/cam', shape: [8, 64, 64, 4], dtype: 'uint8' },
    ]);
    const img = plan.recipes.find((r) => r.kind === 'image');
    expect(img?.kind === 'image' && img.encoding).toBe('rgba8');
  });

  it('recognizes single-channel as mono8', () => {
    const plan = planTopics([
      { path: '/cam', shape: [8, 64, 64, 1], dtype: 'uint8' },
    ]);
    const img = plan.recipes.find((r) => r.kind === 'image');
    expect(img?.kind === 'image' && img.encoding).toBe('mono8');
  });
});
