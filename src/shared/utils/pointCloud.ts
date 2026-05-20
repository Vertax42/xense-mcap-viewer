export interface PointCloudData {
  positions: Float32Array;
  colors?: Float32Array;
}

interface PointField {
  name: string;
  offset: number;
  datatype?: number;
}

function isPointField(value: unknown): value is PointField {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.offset === "number";
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

export function parsePointCloud2(message: unknown): PointCloudData | null {
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  const { fields, data, point_step, width, height } = m;
  if (!Array.isArray(fields) || !isUint8Array(data) || typeof point_step !== "number") return null;
  if (typeof width !== "number" || typeof height !== "number") return null;

  const count = width * height;
  const positions = new Float32Array(count * 3);

  const typedFields = fields.filter(isPointField);
  const xField = typedFields.find((f) => f.name === "x");
  const yField = typedFields.find((f) => f.name === "y");
  const zField = typedFields.find((f) => f.name === "z");

  if (!xField || !yField || !zField) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const isLittleEndian = true; // ROS2 is usually little endian

  for (let i = 0; i < count; i++) {
    const offset = i * point_step;
    positions[i * 3] = view.getFloat32(offset + xField.offset, isLittleEndian);
    positions[i * 3 + 1] = view.getFloat32(offset + yField.offset, isLittleEndian);
    positions[i * 3 + 2] = view.getFloat32(offset + zField.offset, isLittleEndian);
  }

  return { positions };
}
