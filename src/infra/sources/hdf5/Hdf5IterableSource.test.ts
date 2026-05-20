import { describe, it, expect } from 'vitest';
import { Hdf5IterableSource } from './Hdf5IterableSource';
import { toNano } from '@/shared/utils/time';

/**
 * Minimal mock of the HDF5 `File`/`Group`/`Dataset` surface the source relies
 * on. Datasets are keyed by full path; groups are synthesized from path parents.
 */
interface FakeDatasetSpec {
  shape: number[];
  dtype: string;
  /** Full flat array of frame-major data (N * product(inner)). */
  data: ArrayLike<number>;
}

function makeFakeH5File(datasets: Record<string, FakeDatasetSpec>) {
  const allPaths = Object.keys(datasets);
  const groupChildren = new Map<string, Set<string>>();
  const ensureGroup = (g: string) => {
    if (!groupChildren.has(g)) groupChildren.set(g, new Set());
    return groupChildren.get(g)!;
  };
  ensureGroup('/');
  for (const p of allPaths) {
    const parts = p.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const parentPath = i === 0 ? '/' : '/' + parts.slice(0, i).join('/');
      ensureGroup(parentPath).add(parts[i]);
    }
  }

  const make = (fullPath: string): unknown => {
    if (datasets[fullPath]) {
      const spec = datasets[fullPath];
      return {
        type: 'Dataset',
        path: fullPath,
        shape: spec.shape,
        dtype: spec.dtype,
        value: spec.data,
        slice: (ranges: Array<Array<number | null>>) => {
          const [r0] = ranges;
          const start = typeof r0[0] === 'number' ? r0[0] : 0;
          const stop = typeof r0[1] === 'number' ? r0[1] : spec.shape[0];
          const inner = spec.shape.slice(1).reduce((a, b) => a * b, 1);
          const off = start * inner;
          const len = (stop - start) * inner;
          const src = spec.data;
          const out = new Array<number>(len);
          for (let i = 0; i < len; i++) out[i] = Number(src[off + i] ?? 0);
          // Mimic binding returning a TypedArray-like; for uint8 we do use
          // Uint8Array so the source's image ensureUint8Array path is exercised.
          if (spec.dtype === 'uint8') {
            const u = new Uint8Array(len);
            for (let i = 0; i < len; i++) u[i] = out[i] & 0xff;
            return u;
          }
          if (spec.dtype === 'float32') {
            return Float32Array.from(out);
          }
          return out;
        },
      };
    }
    // It's a group
    const children = groupChildren.get(fullPath);
    if (!children) return null;
    return {
      type: 'Group',
      path: fullPath,
      keys: () => Array.from(children),
      get: (name: string) => {
        const childPath = fullPath === '/' ? `/${name}` : `${fullPath}/${name}`;
        return make(childPath);
      },
    };
  };

  const root = make('/') as { keys: () => string[]; get: (name: string) => unknown };
  return {
    keys: () => root.keys(),
    get: (name: string) => {
      // Paths may be "foo" or "/foo" at the root; our source uses absolute.
      const p = name.startsWith('/') ? name : `/${name}`;
      return make(p);
    },
    close: () => 0,
  };
}

function seqFloat32(len: number, scale = 1): Float32Array {
  const a = new Float32Array(len);
  for (let i = 0; i < len; i++) a[i] = i * scale;
  return a;
}

describe('Hdf5IterableSource', () => {
  const N = 4;
  const K = 3;
  const H = 2, W = 2, C = 3;
  const datasets = {
    '/action': { shape: [N, K], dtype: 'float32', data: seqFloat32(N * K) },
    '/observations/qpos': { shape: [N, K], dtype: 'float32', data: seqFloat32(N * K, 2) },
    '/observations/qvel': { shape: [N, K], dtype: 'float32', data: seqFloat32(N * K, 3) },
    '/observations/tau_J': { shape: [N, K], dtype: 'float32', data: seqFloat32(N * K, 4) },
    '/observations/ee_pos_t': { shape: [N, 3], dtype: 'float32', data: seqFloat32(N * 3, 0.1) },
    '/observations/ee_pos_q': {
      shape: [N, 4],
      dtype: 'float32',
      // Identity quaternion (0,0,0,1) for every frame so the source's default xyzw order is verifiable.
      data: Float32Array.from(Array.from({ length: N }).flatMap(() => [0, 0, 0, 1])),
    },
    '/observations/images/cam0': {
      shape: [N, H, W, C],
      dtype: 'uint8',
      data: Array.from({ length: N * H * W * C }, (_, i) => i & 0xff),
    },
    // `/tm` is present but intentionally ignored by the source — we verify it
    // shows up as a skip warning, not as a topic.
    '/tm': { shape: [N, 1], dtype: 'float32', data: Float32Array.from([0.125, 0.25, 0.125, 0.5]) },
  } satisfies Record<string, FakeDatasetSpec>;

  const h5 = makeFakeH5File(datasets);

  it('initializes with topics, datatypes, and a uniform-dt timeline starting at 0', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    const init = await src.initialize();

    expect(init.start).toEqual({ sec: 0, nsec: 0 });
    // Uniform 10 Hz: end = (N-1) × 100 ms = 300 ms for 4 frames.
    expect(toNano(init.end)).toBe(300_000_000n);

    const names = init.topics.map((t) => t.name).sort();
    expect(names).toContain('/observations/joint_states');
    expect(names).toContain('/observations/ee_pose');
    expect(names).toContain('/observations/images/cam0');
    expect(names).toContain('/action');
    expect(names).not.toContain('/tm');

    // Source now reports that it deliberately skipped the stored /tm dataset.
    const ignored = init.problems.find((p) => p.message.includes('Ignored timeline'));
    expect(ignored).toBeDefined();

    // Datatypes must include the synthesized schemas so RawMessages panel works.
    expect(init.datatypes['sensor_msgs/msg/JointState']).toBeDefined();
    expect(init.datatypes['sensor_msgs/msg/Image']).toBeDefined();
    expect(init.datatypes['geometry_msgs/msg/PoseStamped']).toBeDefined();
    expect(init.datatypes['std_msgs/msg/Float32MultiArray']).toBeDefined();
  });

  it('honors a custom frameDtSec option', async () => {
    const src = new Hdf5IterableSource(h5 as never, { frameDtSec: 0.2 });
    const init = await src.initialize();
    // end = 3 × 200 ms = 600 ms
    expect(toNano(init.end)).toBe(600_000_000n);
  });

  it('advertises preferredSamplingFps so the player can align its tick rate', async () => {
    const defaultSrc = new Hdf5IterableSource(h5 as never);
    const defaultInit = await defaultSrc.initialize();
    expect(defaultInit.preferredSamplingFps).toBe(10);

    const fastSrc = new Hdf5IterableSource(h5 as never, { frameDtSec: 1 / 30 });
    const fastInit = await fastSrc.initialize();
    expect(fastInit.preferredSamplingFps).toBeCloseTo(30, 5);
  });

  it('messageIterator yields one message per subscribed topic per frame in time order', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();

    const events: Array<{ topic: string; ns: bigint }> = [];
    for await (const event of src.messageIterator({
      startTime: { sec: 0, nsec: 0 },
      topics: ['/observations/joint_states', '/observations/images/cam0'],
    })) {
      events.push({ topic: event.topic, ns: toNano(event.receiveTime) });
    }
    // 4 frames × 2 topics
    expect(events).toHaveLength(8);
    // Non-decreasing time axis
    for (let i = 1; i < events.length; i++) {
      expect(events[i].ns >= events[i - 1].ns).toBe(true);
    }
  });

  it('builds a JointState with position/velocity/effort from qpos/qvel/tau_J', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();

    const backfill = await src.getBackfillMessages({
      // Uniform 10 Hz → frames at 0, 100, 200, 300 ms. 250 ms picks frame 2.
      time: { sec: 0, nsec: 250_000_000 },
      topics: ['/observations/joint_states'],
    });
    expect(backfill).toHaveLength(1);
    const js = backfill[0].message as unknown as {
      name: string[];
      position: number[];
      velocity: number[];
      effort: number[];
    };
    expect(js.name).toEqual(['joint_0', 'joint_1', 'joint_2']);
    expect(js.position).toHaveLength(K);
    expect(js.velocity).toHaveLength(K);
    expect(js.effort).toHaveLength(K);
    // qpos[2, 0..2] with scale=2 starting at flat index 6 → [12, 14, 16].
    expect(js.position).toEqual([12, 14, 16]);
  });

  it('emits image messages with a Uint8Array data payload matching the frame', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();

    const backfill = await src.getBackfillMessages({
      time: { sec: 0, nsec: 0 },
      topics: ['/observations/images/cam0'],
    });
    expect(backfill).toHaveLength(1);
    const img = backfill[0].message as unknown as {
      width: number;
      height: number;
      encoding: string;
      step: number;
      data: Uint8Array;
    };
    expect(img.width).toBe(W);
    expect(img.height).toBe(H);
    expect(img.encoding).toBe('rgb8');
    expect(img.step).toBe(W * C);
    expect(img.data).toBeInstanceOf(Uint8Array);
    expect(img.data.byteLength).toBe(H * W * C);
    // Frame 0 starts at byte 0
    expect(img.data[0]).toBe(0);
  });

  it('getBackfillMessages falls forward to frame 0 if time is before the start', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();
    // Use a huge negative-equivalent (time=0 with no dt accumulation → frame 0).
    const msgs = await src.getBackfillMessages({
      time: { sec: 0, nsec: 0 },
      topics: ['/observations/joint_states'],
    });
    expect(msgs).toHaveLength(1);
    expect(toNano(msgs[0].receiveTime)).toBe(0n);
  });

  it('getAdjacentMessage: next/prev traverses frames', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();

    const firstNext = await src.getAdjacentMessage({
      time: { sec: 0, nsec: 0 },
      topics: ['/observations/joint_states'],
      direction: 'next',
    });
    // Uniform 10 Hz → next after t=0 is frame 1 at 100 ms.
    expect(firstNext).not.toBeNull();
    expect(toNano(firstNext!.receiveTime)).toBe(100_000_000n);

    const prev = await src.getAdjacentMessage({
      time: { sec: 0, nsec: 100_000_000 },
      topics: ['/observations/joint_states'],
      direction: 'prev',
    });
    expect(prev).not.toBeNull();
    expect(toNano(prev!.receiveTime)).toBe(0n);

    const pastEnd = await src.getAdjacentMessage({
      time: { sec: 0, nsec: 300_000_000 },
      topics: ['/observations/joint_states'],
      direction: 'next',
    });
    expect(pastEnd).toBeNull();
  });

  it('PoseStamped is composed with quaternion in xyzw order', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();

    const msgs = await src.getBackfillMessages({
      time: { sec: 0, nsec: 0 },
      topics: ['/observations/ee_pose'],
    });
    expect(msgs).toHaveLength(1);
    const pose = msgs[0].message as unknown as {
      pose: {
        position: { x: number; y: number; z: number };
        orientation: { x: number; y: number; z: number; w: number };
      };
    };
    expect(pose.pose.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('ignores the stored /tm even when it contains anomalous stalls', async () => {
    // ALOHA-style recording: a 6.75 s warm-up at frame 0 and a 3 s mid-stall
    // at frame 4. Honoring these would stretch an 8-frame episode to ~10.2 s
    // and produce a frozen playback; instead we build a uniform 10 Hz
    // timeline (0.8 s total) so every frame renders at a natural cadence.
    const N2 = 8;
    const tm = Float64Array.from([6.75, 0.125, 0.125, 0.125, 3.0, 0.125, 0.125, 0.125]);
    const specs: Record<string, FakeDatasetSpec> = {
      '/action': { shape: [N2, 1], dtype: 'float32', data: new Float32Array(N2) },
      '/tm': { shape: [N2, 1], dtype: 'float32', data: tm },
    };
    const localH5 = makeFakeH5File(specs);
    const src = new Hdf5IterableSource(localH5 as never);
    const init = await src.initialize();
    // (N-1) × 100 ms = 700 ms — depends only on frame count, not on /tm.
    expect(toNano(init.end)).toBe(700_000_000n);
    const warn = init.problems.find((p) => p.message.includes('Ignored timeline'));
    expect(warn).toBeDefined();
    expect(warn?.message).toMatch(/uniform 100 ms\/frame/);
  });

  it('unknown topics are silently ignored in messageIterator', async () => {
    const src = new Hdf5IterableSource(h5 as never);
    await src.initialize();
    const events = [];
    for await (const ev of src.messageIterator({
      startTime: { sec: 0, nsec: 0 },
      topics: ['/does/not/exist'],
    })) {
      events.push(ev);
    }
    expect(events).toEqual([]);
  });

  it('multi-demo paths are flattened into sequential timeline with episode_index', async () => {
    const specs: Record<string, FakeDatasetSpec> = {
      '/data/demo_0/actions': { shape: [2, 2], dtype: 'float64', data: Float64Array.from([1, 2, 3, 4]) },
      '/data/demo_0/obs/joint_states': { shape: [2, 2], dtype: 'float64', data: Float64Array.from([10, 11, 12, 13]) },
      '/data/demo_0/obs/agentview_rgb': {
        shape: [2, 1, 1, 3], dtype: 'uint8', data: Uint8Array.from([1, 2, 3, 4, 5, 6]),
      },
      '/data/demo_1/actions': { shape: [1, 2], dtype: 'float64', data: Float64Array.from([7, 8]) },
      '/data/demo_1/obs/joint_states': { shape: [1, 2], dtype: 'float64', data: Float64Array.from([20, 21]) },
      '/data/demo_1/obs/agentview_rgb': {
        shape: [1, 1, 1, 3], dtype: 'uint8', data: Uint8Array.from([9, 10, 11]),
      },
    };
    const src = new Hdf5IterableSource(makeFakeH5File(specs) as never);
    const init = await src.initialize();
    expect(init.topics.map((t) => t.name)).toContain('/episode_index');
    expect(init.topics.map((t) => t.name)).toContain('/joint_states');
    expect(init.topics.map((t) => t.name)).toContain('/obs/agentview_rgb');

    const msgs = await src.getBackfillMessages({
      time: { sec: 0, nsec: 200_000_000 },
      topics: ['/episode_index', '/joint_states', '/obs/agentview_rgb'],
    });
    const epi = msgs.find((m) => m.topic === '/episode_index')!.message as unknown as { data: number };
    expect(epi.data).toBe(1);
    const js = msgs.find((m) => m.topic === '/joint_states')!.message as unknown as { position: number[] };
    expect(js.position).toEqual([20, 21]);
    const img = msgs.find((m) => m.topic === '/obs/agentview_rgb')!.message as unknown as { data: Uint8Array };
    expect(Array.from(img.data)).toEqual([9, 10, 11]);
  });
});
