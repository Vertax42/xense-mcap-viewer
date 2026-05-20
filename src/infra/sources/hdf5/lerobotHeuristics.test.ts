import { describe, expect, it } from 'vitest';
import { planTopics, type HdfDatasetDescriptor } from './heuristics';

function demoDatasets(demo: number, frames: number): HdfDatasetDescriptor[] {
  const p = `/data/demo_${demo}`;
  return [
    { path: `${p}/actions`, shape: [frames, 7], dtype: 'float64' },
    { path: `${p}/obs/joint_states`, shape: [frames, 7], dtype: 'float64' },
    { path: `${p}/obs/agentview_rgb`, shape: [frames, 128, 128, 3], dtype: 'uint8' },
    { path: `${p}/obs/eye_in_hand_rgb`, shape: [frames, 128, 128, 3], dtype: 'uint8' },
    { path: `${p}/dones`, shape: [frames], dtype: 'uint8' },
    { path: `${p}/rewards`, shape: [frames], dtype: 'uint8' },
  ];
}

describe('planTopics multi-demo (LeRobot/Robosuite)', () => {
  it('flattens demo_* episodes into one timeline and virtual topics', () => {
    const datasets = [...demoDatasets(0, 4), ...demoDatasets(1, 3)];
    const plan = planTopics(datasets);
    expect(plan.frameCount).toBe(7);
    expect(plan.episodeFrameCounts).toEqual([4, 3]);
    expect(plan.episodePrefixes).toEqual(['/data/demo_0', '/data/demo_1']);

    const names = plan.recipes.map((r) => r.topic);
    expect(names).toContain('/joint_states');
    expect(names).toContain('/obs/agentview_rgb');
    expect(names).toContain('/obs/eye_in_hand_rgb');
    expect(names).toContain('/actions');
    expect(names).toContain('/dones');
    expect(names).toContain('/rewards');
    expect(names).toContain('/episode_index');

    expect(plan.pathExpansions?.['/joint_states']).toEqual([
      '/data/demo_0/obs/joint_states',
      '/data/demo_1/obs/joint_states',
    ]);
    expect(plan.pathExpansions?.['/actions']).toEqual([
      '/data/demo_0/actions',
      '/data/demo_1/actions',
    ]);
  });
});
