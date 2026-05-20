/**
 * Heuristic mapping from HDF5 dataset layout to virtual ROS topics.
 *
 * v1 targets the ALOHA/ACT episode schema:
 *   /action                              (N, D)
 *   /observations/qpos, qvel, tau_J       (N, 7)  -> merged into sensor_msgs/msg/JointState
 *   /observations/images/<cam>            (N, H, W, 3 | 4)  -> sensor_msgs/msg/Image
 *   /observations/ee_pos_t + ee_pos_q     -> geometry_msgs/msg/PoseStamped
 *   /observations/ee_twist_lin + _ang     -> geometry_msgs/msg/TwistStamped
 *   /observations/O_F_ext_hat_K           (N, 6)  -> geometry_msgs/msg/WrenchStamped
 *   /tm                                   (N,) or (N,1)  -> consumed for timeline, not published
 *
 * Anything else (N,D) falls back to std_msgs/msg/Float32MultiArray so the
 * Plot panel can at least show it.
 */

export interface HdfDatasetDescriptor {
  /** Absolute path inside the HDF5 file, always starting with '/'. */
  path: string;
  shape: number[];
  /** Lower-cased dtype string, e.g. 'float32', 'uint8'. */
  dtype: string;
}

export type TopicRecipe =
  | JointStateRecipe
  | ImageRecipe
  | PoseStampedRecipe
  | TwistStampedRecipe
  | WrenchStampedRecipe
  | Float32ArrayRecipe
  | Float32ScalarRecipe;

export interface JointStateRecipe {
  kind: 'jointState';
  topic: string;
  schemaName: 'sensor_msgs/msg/JointState';
  frameCount: number;
  jointCount: number;
  positionPath?: string;
  velocityPath?: string;
  effortPath?: string;
  /** Generated joint names, length === jointCount */
  jointNames: string[];
}

export interface ImageRecipe {
  kind: 'image';
  topic: string;
  schemaName: 'sensor_msgs/msg/Image';
  frameCount: number;
  path: string;
  height: number;
  width: number;
  /** ROS image encoding string (e.g. 'rgb8', 'rgba8', 'mono8'). */
  encoding: string;
  /** Source channels in the HDF5 data (3, 4, or 1). */
  sourceChannels: number;
  /** Underlying dtype, typically 'uint8'. */
  dtype: string;
}

export interface PoseStampedRecipe {
  kind: 'poseStamped';
  topic: string;
  schemaName: 'geometry_msgs/msg/PoseStamped';
  frameCount: number;
  positionPath: string;
  quaternionPath: string;
  frameId: string;
  /** Order of quaternion in source data. ALOHA-style "ee_pos_q" is typically (x,y,z,w). */
  quatOrder: 'xyzw' | 'wxyz';
}

export interface TwistStampedRecipe {
  kind: 'twistStamped';
  topic: string;
  schemaName: 'geometry_msgs/msg/TwistStamped';
  frameCount: number;
  linearPath: string;
  angularPath: string;
  frameId: string;
}

export interface WrenchStampedRecipe {
  kind: 'wrenchStamped';
  topic: string;
  schemaName: 'geometry_msgs/msg/WrenchStamped';
  frameCount: number;
  /** Shape (N, 6): [fx, fy, fz, tx, ty, tz] */
  path: string;
  frameId: string;
}

export interface Float32ArrayRecipe {
  kind: 'float32Array';
  topic: string;
  schemaName: 'std_msgs/msg/Float32MultiArray';
  frameCount: number;
  path: string;
  /** Per-frame element count (D). For (N,D1,D2) this is D1*D2. */
  dim: number;
  /** Original inner dims after the leading frame axis, e.g. [7] or [2,3]. */
  innerShape: number[];
  dtype: string;
}

export interface Float32ScalarRecipe {
  kind: 'float32Scalar';
  topic: string;
  schemaName: 'std_msgs/msg/Float32';
  frameCount: number;
  path: string;
  dtype: string;
}

export interface PlanResult {
  recipes: TopicRecipe[];
  /** Path of the dataset that provides the timeline. Undefined if no /tm present. */
  timelinePath?: string;
  /** Number of frames used for the global timeline. */
  frameCount: number;
  /** Multi-episode metadata when source paths are under /data/demo_x/.
   * `frameCount` is then the sum of all episode frame counts. */
  episodeFrameCounts?: number[];
  episodePrefixes?: string[];
  /**
   * Maps virtual recipe paths (e.g. `/obs/agentview_rgb`) to per-episode
   * dataset paths (e.g. `/data/demo_0/obs/agentview_rgb`, `/data/demo_1/...`).
   * Index aligns with `episodeFrameCounts` / `episodePrefixes`.
   */
  pathExpansions?: Record<string, string[]>;
  /** Datasets that couldn't be mapped (unusual shapes, string dtype, etc). */
  unmapped: string[];
}

const NUMERIC_DTYPES = new Set([
  'float32', 'float64',
  'int8', 'int16', 'int32', 'int64',
  'uint8', 'uint16', 'uint32', 'uint64',
]);

function isNumericDtype(dtype: string): boolean {
  return NUMERIC_DTYPES.has(dtype.toLowerCase());
}

function generateJointNames(count: number): string[] {
  const out = new Array<string>(count);
  for (let i = 0; i < count; i++) out[i] = `joint_${i}`;
  return out;
}

function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

type DemoDataset = {
  descriptor: HdfDatasetDescriptor;
  demoName: string;
  demoIndex: number;
  relativePath: string;
};

const DEMO_PATH_RE = /^\/data\/(demo_(\d+))\/(.+)$/;

function parseDemoDataset(d: HdfDatasetDescriptor): DemoDataset | null {
  const m = d.path.match(DEMO_PATH_RE);
  if (!m) return null;
  return {
    descriptor: d,
    demoName: m[1],
    demoIndex: Number(m[2]),
    relativePath: m[3],
  };
}

function pickFrameCountForGroup(datasets: HdfDatasetDescriptor[]): number {
  const counts = new Map<number, number>();
  for (const d of datasets) {
    if (d.shape.length >= 1 && d.shape[0] > 0 && isNumericDtype(d.dtype)) {
      counts.set(d.shape[0], (counts.get(d.shape[0]) ?? 0) + 1);
    }
  }
  let frameCount = 0;
  let bestVotes = 0;
  for (const [n, votes] of counts) {
    if (votes > bestVotes || (votes === bestVotes && n > frameCount)) {
      frameCount = n;
      bestVotes = votes;
    }
  }
  return frameCount;
}

function topicFromRelativePath(relativePath: string): string {
  return `/${relativePath.replace(/^\/+/, '')}`;
}

function planMultiDemo(datasets: HdfDatasetDescriptor[], parsed: DemoDataset[]): PlanResult | null {
  const byDemo = new Map<string, DemoDataset[]>();
  for (const p of parsed) {
    const arr = byDemo.get(p.demoName) ?? [];
    arr.push(p);
    byDemo.set(p.demoName, arr);
  }
  if (byDemo.size === 0) return null;

  const sortedDemos = Array.from(byDemo.entries())
    .map(([name, entries]) => ({ name, entries, idx: entries[0].demoIndex }))
    .sort((a, b) => a.idx - b.idx);

  const episodePrefixes: string[] = [];
  const episodeFrameCounts: number[] = [];
  const entriesByEpisode: DemoDataset[][] = [];
  for (const d of sortedDemos) {
    const frameCount = pickFrameCountForGroup(d.entries.map((e) => e.descriptor));
    if (frameCount <= 0) continue;
    episodePrefixes.push(`/data/${d.name}`);
    episodeFrameCounts.push(frameCount);
    entriesByEpisode.push(d.entries);
  }
  if (entriesByEpisode.length === 0) return null;

  const totalFrames = episodeFrameCounts.reduce((a, b) => a + b, 0);
  const recipes: TopicRecipe[] = [];
  const unmapped: string[] = [];
  const pathExpansions: Record<string, string[]> = {};
  const consumedActualPaths = new Set<string>();

  const relPathByEpisode = entriesByEpisode.map((entries) => {
    const m = new Map<string, HdfDatasetDescriptor>();
    for (const e of entries) m.set(e.relativePath, e.descriptor);
    return m;
  });

  const candidateRelPaths = new Set<string>();
  for (const rel of relPathByEpisode[0].keys()) candidateRelPaths.add(rel);
  for (let i = 1; i < relPathByEpisode.length; i++) {
    for (const rel of Array.from(candidateRelPaths)) {
      if (!relPathByEpisode[i].has(rel)) candidateRelPaths.delete(rel);
    }
  }

  const getShared = (relativePath: string): HdfDatasetDescriptor[] | null => {
    const out: HdfDatasetDescriptor[] = [];
    for (let i = 0; i < relPathByEpisode.length; i++) {
      const ds = relPathByEpisode[i].get(relativePath);
      if (!ds) return null;
      if (ds.shape.length < 1 || ds.shape[0] !== episodeFrameCounts[i]) return null;
      out.push(ds);
    }
    return out;
  };

  const recordExpansion = (virtualPath: string, shared: HdfDatasetDescriptor[]) => {
    pathExpansions[virtualPath] = shared.map((s) => s.path);
    for (const s of shared) consumedActualPaths.add(s.path);
  };

  const sharedJoint = getShared('obs/joint_states');
  if (sharedJoint && sharedJoint.every((d) => d.shape.length === 2 && d.shape[1] > 0)) {
    const jointCount = sharedJoint[0].shape[1];
    const sameShape = sharedJoint.every((d) => d.shape[1] === jointCount);
    if (sameShape) {
      const virtualPath = '/joint_states';
      recipes.push({
        kind: 'jointState',
        topic: virtualPath,
        schemaName: 'sensor_msgs/msg/JointState',
        frameCount: totalFrames,
        jointCount,
        jointNames: generateJointNames(jointCount),
        positionPath: virtualPath,
      });
      recordExpansion(virtualPath, sharedJoint);
    }
  }

  for (const rel of candidateRelPaths) {
    const shared = getShared(rel);
    if (!shared) continue;
    if (shared.every((d) => d.dtype === 'uint8' && d.shape.length === 4)) {
      const [, h, w, c] = shared[0].shape;
      if ((c === 1 || c === 3 || c === 4) && shared.every((d) => d.shape[1] === h && d.shape[2] === w && d.shape[3] === c)) {
        const virtualPath = topicFromRelativePath(rel);
        const encoding = c === 4 ? 'rgba8' : c === 1 ? 'mono8' : 'rgb8';
        recipes.push({
          kind: 'image',
          topic: virtualPath,
          schemaName: 'sensor_msgs/msg/Image',
          frameCount: totalFrames,
          path: virtualPath,
          height: h,
          width: w,
          encoding,
          sourceChannels: c,
          dtype: 'uint8',
        });
        recordExpansion(virtualPath, shared);
      }
    }
  }

  const actionShared = getShared('actions');
  if (actionShared && actionShared.every((d) => isNumericDtype(d.dtype) && d.shape.length >= 2)) {
    const innerShape = actionShared[0].shape.slice(1);
    if (actionShared.every((d) => d.shape.slice(1).join(',') === innerShape.join(','))) {
      const dim = innerShape.reduce((a, b) => a * b, 1);
      const virtualPath = '/actions';
      recipes.push({
        kind: 'float32Array',
        topic: virtualPath,
        schemaName: 'std_msgs/msg/Float32MultiArray',
        frameCount: totalFrames,
        path: virtualPath,
        dim,
        innerShape,
        dtype: actionShared[0].dtype,
      });
      recordExpansion(virtualPath, actionShared);
    }
  }

  for (const rel of candidateRelPaths) {
    const shared = getShared(rel);
    if (!shared) continue;
    if (shared.some((d) => consumedActualPaths.has(d.path))) continue;
    if (!shared.every((d) => isNumericDtype(d.dtype))) continue;
    const virtualPath = topicFromRelativePath(rel);
    if (shared.every((d) => d.shape.length === 1)) {
      recipes.push({
        kind: 'float32Scalar',
        topic: virtualPath,
        schemaName: 'std_msgs/msg/Float32',
        frameCount: totalFrames,
        path: virtualPath,
        dtype: shared[0].dtype,
      });
      recordExpansion(virtualPath, shared);
      continue;
    }
    if (shared.every((d) => d.shape.length >= 2)) {
      const innerShape = shared[0].shape.slice(1);
      if (!shared.every((d) => d.shape.slice(1).join(',') === innerShape.join(','))) continue;
      const dim = innerShape.reduce((a, b) => a * b, 1);
      if (innerShape.length === 1 && innerShape[0] === 1) {
        recipes.push({
          kind: 'float32Scalar',
          topic: virtualPath,
          schemaName: 'std_msgs/msg/Float32',
          frameCount: totalFrames,
          path: virtualPath,
          dtype: shared[0].dtype,
        });
      } else {
        recipes.push({
          kind: 'float32Array',
          topic: virtualPath,
          schemaName: 'std_msgs/msg/Float32MultiArray',
          frameCount: totalFrames,
          path: virtualPath,
          dim,
          innerShape,
          dtype: shared[0].dtype,
        });
      }
      recordExpansion(virtualPath, shared);
    }
  }

  recipes.push({
    kind: 'float32Scalar',
    topic: '/episode_index',
    schemaName: 'std_msgs/msg/Float32',
    frameCount: totalFrames,
    path: '/episode_index',
    dtype: 'float32',
  });

  for (const d of datasets) {
    if (!consumedActualPaths.has(d.path)) unmapped.push(d.path);
  }

  const order = (r: TopicRecipe): number => {
    switch (r.kind) {
      case 'jointState': return 0;
      case 'image': return 1;
      case 'poseStamped': return 2;
      case 'twistStamped': return 3;
      case 'wrenchStamped': return 4;
      default:
        return r.topic === '/actions' ? 5 : 6;
    }
  };
  recipes.sort((a, b) => {
    const da = order(a);
    const db = order(b);
    if (da !== db) return da - db;
    return a.topic.localeCompare(b.topic);
  });

  return {
    recipes,
    frameCount: totalFrames,
    episodeFrameCounts,
    episodePrefixes,
    pathExpansions,
    unmapped,
  };
}

/**
 * Plan virtual ROS topics from a list of HDF5 datasets.
 *
 * Semantics:
 *  - The global frame count is derived from the most common leading axis among
 *    (N, ...) shaped datasets. Datasets whose leading axis does not match are
 *    skipped (reported in `unmapped`).
 *  - Joint state merging happens only if qpos, qvel, and/or tau_J share the
 *    same (N, K) shape.
 *  - The timeline dataset `/tm` is NOT emitted as a topic (it's consumed by
 *    the source to build the time axis).
 */
export function planTopics(datasets: HdfDatasetDescriptor[]): PlanResult {
  const parsed = datasets
    .map((d) => parseDemoDataset(d))
    .filter((d): d is DemoDataset => d != null);
  if (parsed.length > 0) {
    const multi = planMultiDemo(datasets, parsed);
    if (multi) return multi;
  }

  const byPath = new Map<string, HdfDatasetDescriptor>();
  for (const d of datasets) byPath.set(d.path, d);

  // 1. Determine the global frame count by plurality vote over the leading axis.
  const counts = new Map<number, number>();
  for (const d of datasets) {
    if (d.shape.length >= 1 && d.shape[0] > 0 && isNumericDtype(d.dtype)) {
      counts.set(d.shape[0], (counts.get(d.shape[0]) ?? 0) + 1);
    }
  }
  let frameCount = 0;
  let bestVotes = 0;
  for (const [n, votes] of counts) {
    if (votes > bestVotes || (votes === bestVotes && n > frameCount)) {
      frameCount = n;
      bestVotes = votes;
    }
  }

  const timelinePath = byPath.has('/tm') ? '/tm' : undefined;

  const recipes: TopicRecipe[] = [];
  const unmapped: string[] = [];
  const consumed = new Set<string>();
  if (timelinePath) consumed.add(timelinePath);

  const take = (path: string): HdfDatasetDescriptor | undefined => {
    const d = byPath.get(path);
    if (d && !consumed.has(path)) return d;
    return undefined;
  };

  // 2. JointState: merge /observations/qpos | qvel | tau_J if compatible.
  const qpos = take('/observations/qpos');
  const qvel = take('/observations/qvel');
  const tau = take('/observations/tau_J');
  const jointCandidates = [qpos, qvel, tau].filter(Boolean) as HdfDatasetDescriptor[];
  if (jointCandidates.length > 0 && jointCandidates[0].shape.length === 2) {
    const [n0, k0] = jointCandidates[0].shape;
    const allMatch = jointCandidates.every(
      (d) => d.shape.length === 2 && d.shape[0] === n0 && d.shape[1] === k0,
    );
    if (allMatch && n0 === frameCount && k0 > 0) {
      const recipe: JointStateRecipe = {
        kind: 'jointState',
        topic: '/observations/joint_states',
        schemaName: 'sensor_msgs/msg/JointState',
        frameCount: n0,
        jointCount: k0,
        jointNames: generateJointNames(k0),
        positionPath: qpos?.path,
        velocityPath: qvel?.path,
        effortPath: tau?.path,
      };
      recipes.push(recipe);
      if (qpos) consumed.add(qpos.path);
      if (qvel) consumed.add(qvel.path);
      if (tau) consumed.add(tau.path);
    }
  }

  // 3. Pose/Twist/Wrench composites.
  const eePosT = take('/observations/ee_pos_t');
  const eePosQ = take('/observations/ee_pos_q');
  if (
    eePosT && eePosQ &&
    eePosT.shape.length === 2 && eePosT.shape[1] === 3 &&
    eePosQ.shape.length === 2 && eePosQ.shape[1] === 4 &&
    eePosT.shape[0] === eePosQ.shape[0] && eePosT.shape[0] === frameCount
  ) {
    recipes.push({
      kind: 'poseStamped',
      topic: '/observations/ee_pose',
      schemaName: 'geometry_msgs/msg/PoseStamped',
      frameCount: eePosT.shape[0],
      positionPath: eePosT.path,
      quaternionPath: eePosQ.path,
      frameId: 'base',
      quatOrder: 'xyzw',
    });
    consumed.add(eePosT.path);
    consumed.add(eePosQ.path);
  }

  const twistLin = take('/observations/ee_twist_lin');
  const twistAng = take('/observations/ee_twist_ang');
  if (
    twistLin && twistAng &&
    twistLin.shape.length === 2 && twistLin.shape[1] === 3 &&
    twistAng.shape.length === 2 && twistAng.shape[1] === 3 &&
    twistLin.shape[0] === twistAng.shape[0] && twistLin.shape[0] === frameCount
  ) {
    recipes.push({
      kind: 'twistStamped',
      topic: '/observations/ee_twist',
      schemaName: 'geometry_msgs/msg/TwistStamped',
      frameCount: twistLin.shape[0],
      linearPath: twistLin.path,
      angularPath: twistAng.path,
      frameId: 'base',
    });
    consumed.add(twistLin.path);
    consumed.add(twistAng.path);
  }

  const wrench = take('/observations/O_F_ext_hat_K');
  if (wrench && wrench.shape.length === 2 && wrench.shape[1] === 6 && wrench.shape[0] === frameCount) {
    recipes.push({
      kind: 'wrenchStamped',
      topic: '/observations/ee_wrench',
      schemaName: 'geometry_msgs/msg/WrenchStamped',
      frameCount: wrench.shape[0],
      path: wrench.path,
      frameId: 'base',
    });
    consumed.add(wrench.path);
  }

  // 4. Images: any (N, H, W, C) uint8 dataset becomes sensor_msgs/msg/Image.
  for (const d of datasets) {
    if (consumed.has(d.path)) continue;
    if (d.dtype !== 'uint8') continue;
    if (d.shape.length !== 4) continue;
    const [n, h, w, c] = d.shape;
    if (n !== frameCount) continue;
    if (c !== 3 && c !== 4 && c !== 1) continue;
    const encoding = c === 4 ? 'rgba8' : c === 1 ? 'mono8' : 'rgb8';
    recipes.push({
      kind: 'image',
      topic: d.path,
      schemaName: 'sensor_msgs/msg/Image',
      frameCount: n,
      path: d.path,
      height: h,
      width: w,
      encoding,
      sourceChannels: c,
      dtype: d.dtype,
    });
    consumed.add(d.path);
  }

  // 5. Fallback: (N, D) or (N, D1, D2, ...) numeric → Float32MultiArray.
  //    (N, 1) scalar → Float32.
  for (const d of datasets) {
    if (consumed.has(d.path)) continue;
    if (!isNumericDtype(d.dtype)) {
      unmapped.push(d.path);
      continue;
    }
    if (d.shape.length < 2) {
      // Pure (N,) scalars
      if (d.shape.length === 1 && d.shape[0] === frameCount) {
        recipes.push({
          kind: 'float32Scalar',
          topic: d.path,
          schemaName: 'std_msgs/msg/Float32',
          frameCount,
          path: d.path,
          dtype: d.dtype,
        });
        consumed.add(d.path);
      } else {
        unmapped.push(d.path);
      }
      continue;
    }
    if (d.shape[0] !== frameCount) {
      unmapped.push(d.path);
      continue;
    }
    const innerShape = d.shape.slice(1);
    const dim = innerShape.reduce((a, b) => a * b, 1);
    if (innerShape.length === 1 && innerShape[0] === 1) {
      recipes.push({
        kind: 'float32Scalar',
        topic: d.path,
        schemaName: 'std_msgs/msg/Float32',
        frameCount,
        path: d.path,
        dtype: d.dtype,
      });
    } else {
      recipes.push({
        kind: 'float32Array',
        topic: d.path,
        schemaName: 'std_msgs/msg/Float32MultiArray',
        frameCount,
        path: d.path,
        dim,
        innerShape,
        dtype: d.dtype,
      });
    }
    consumed.add(d.path);
  }

  // Sort recipes for a deterministic, user-friendly order:
  // jointState > images > pose/twist/wrench > action > other.
  const order = (r: TopicRecipe): number => {
    switch (r.kind) {
      case 'jointState': return 0;
      case 'image': return 1;
      case 'poseStamped': return 2;
      case 'twistStamped': return 3;
      case 'wrenchStamped': return 4;
      default:
        return r.topic === '/action' ? 5 : 6;
    }
  };
  recipes.sort((a, b) => {
    const da = order(a);
    const db = order(b);
    if (da !== db) return da - db;
    return a.topic.localeCompare(b.topic);
  });

  return { recipes, timelinePath, frameCount, unmapped };
}

export function describeHeuristicDefaults(): { quatOrder: 'xyzw' | 'wxyz'; imageEncoding: string } {
  return { quatOrder: 'xyzw', imageEncoding: 'rgb8' };
}

// Exported for tests
export const __internals = { basename, generateJointNames, isNumericDtype };
