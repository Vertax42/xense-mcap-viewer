function visitTransferables(value: unknown, seen: WeakSet<object>, out: Transferable[]): void {
  if (!value) return;

  if (value instanceof ArrayBuffer) {
    out.push(value);
    return;
  }

  if (ArrayBuffer.isView(value)) {
    const viewBuffer = value.buffer;
    if (viewBuffer instanceof ArrayBuffer) {
      out.push(viewBuffer);
    }
    return;
  }

  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      visitTransferables(item, seen, out);
    }
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    visitTransferables(item, seen, out);
  }
}

export function collectTransferables(value: unknown): Transferable[] {
  const out: Transferable[] = [];
  visitTransferables(value, new WeakSet<object>(), out);
  return out;
}

