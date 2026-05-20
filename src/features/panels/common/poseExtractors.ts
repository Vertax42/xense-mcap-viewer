type RecordLike = Record<string, unknown>;

function asRecord(input: unknown): RecordLike | null {
  return input && typeof input === 'object' ? (input as RecordLike) : null;
}

function readPoseNode(input: unknown): RecordLike | null {
  const record = asRecord(input);
  if (!record) return null;
  const poseRaw = record.pose;
  const poseRecord = asRecord(poseRaw);
  if (!poseRecord) return record;
  const nestedPose = asRecord(poseRecord.pose);
  return nestedPose ?? poseRecord;
}

export function readPoseStampedPosition3(input: unknown): [number, number, number] | undefined {
  const pose = readPoseNode(input);
  if (!pose) return undefined;
  const position = asRecord(pose.position ?? asRecord(input)?.position);
  if (!position) return undefined;
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    return undefined;
  }
  return [position.x, position.y, typeof position.z === 'number' ? position.z : 0];
}

export function readPoseStampedPosition2(input: unknown): { x: number; y: number } | undefined {
  const xyz = readPoseStampedPosition3(input);
  if (!xyz) return undefined;
  return { x: xyz[0], y: xyz[1] };
}

export function readPoseStampedOrientation(input: unknown): [number, number, number, number] | undefined {
  const pose = readPoseNode(input);
  if (!pose) return undefined;
  const orientation = asRecord(pose.orientation);
  if (!orientation) return undefined;
  if (
    typeof orientation.x !== 'number' ||
    typeof orientation.y !== 'number' ||
    typeof orientation.z !== 'number' ||
    typeof orientation.w !== 'number'
  ) {
    return undefined;
  }
  return [orientation.x, orientation.y, orientation.z, orientation.w];
}

export function readPoseStampedFrameId(input: unknown): string {
  const record = asRecord(input);
  const header = asRecord(record?.header);
  return typeof header?.frame_id === 'string' ? header.frame_id : '';
}

export function extractPathPoints3(input: unknown): Array<[number, number, number]> {
  const record = asRecord(input);
  const poses = record?.poses;
  if (!Array.isArray(poses)) {
    const single = readPoseStampedPosition3(input);
    return single ? [single] : [];
  }
  return poses
    .map(readPoseStampedPosition3)
    .filter((point): point is [number, number, number] => point != null);
}

export function extractPathPoints2(input: unknown): Array<{ x: number; y: number }> {
  return extractPathPoints3(input).map(([x, y]) => ({ x, y }));
}
