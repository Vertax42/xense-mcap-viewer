import type { BvhChannelKind, BvhJointNode, BvhParseResult } from "./types";

const KNOWN_CHANNELS = new Set<BvhChannelKind>([
  "Xposition",
  "Yposition",
  "Zposition",
  "Xrotation",
  "Yrotation",
  "Zrotation",
]);

interface ParseState {
  tokens: string[];
  idx: number;
  warnings: string[];
}

function tokenize(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const matches = normalized.match(/[{}]|[^\s{}]+/g);
  return matches ?? [];
}

function expect(state: ParseState, expected: string): void {
  const got = state.tokens[state.idx];
  if (got !== expected) {
    throw new Error(`Expected "${expected}" but got "${got ?? "<eof>"}"`);
  }
  state.idx++;
}

function readNumber(state: ParseState, label: string): number {
  const token = state.tokens[state.idx++];
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number for ${label}: ${token ?? "<eof>"}`);
  }
  return value;
}

function parseOffset(state: ParseState): [number, number, number] {
  expect(state, "OFFSET");
  return [readNumber(state, "offset.x"), readNumber(state, "offset.y"), readNumber(state, "offset.z")];
}

function parseChannels(state: ParseState): BvhChannelKind[] {
  expect(state, "CHANNELS");
  const count = Math.max(0, Math.floor(readNumber(state, "channels.count")));
  const channels: BvhChannelKind[] = [];
  for (let i = 0; i < count; i++) {
    const raw = state.tokens[state.idx++] ?? "";
    if (KNOWN_CHANNELS.has(raw as BvhChannelKind)) {
      channels.push(raw as BvhChannelKind);
    } else {
      channels.push("Unknown");
      state.warnings.push(`Unknown channel "${raw}" at channel index ${i}`);
    }
  }
  return channels;
}

function parseJointBody(
  state: ParseState,
  name: string,
  opts: { forceNoChannels: boolean; isEndSite: boolean },
): BvhJointNode {
  expect(state, "{");
  const offset = parseOffset(state);
  let channels: BvhChannelKind[] = [];
  if (!opts.forceNoChannels && state.tokens[state.idx] === "CHANNELS") {
    channels = parseChannels(state);
  }
  const children: BvhJointNode[] = [];

  while (state.idx < state.tokens.length) {
    const token = state.tokens[state.idx];
    if (token === "}") {
      state.idx++;
      break;
    }
    if (token === "JOINT") {
      state.idx++;
      const childName = state.tokens[state.idx++];
      if (!childName) throw new Error("JOINT missing name");
      children.push(parseJointBody(state, childName, { forceNoChannels: false, isEndSite: false }));
      continue;
    }
    if (token === "End" && state.tokens[state.idx + 1] === "Site") {
      state.idx += 2;
      children.push(parseJointBody(state, "End Site", { forceNoChannels: true, isEndSite: true }));
      continue;
    }
    state.warnings.push(`Unexpected token "${token}" inside joint "${name}", skipping.`);
    state.idx++;
  }

  return {
    name,
    offset,
    channels,
    children,
    isEndSite: opts.isEndSite,
  };
}

function countChannels(node: BvhJointNode): number {
  let total = node.channels.length;
  for (const child of node.children) {
    total += countChannels(child);
  }
  return total;
}

function parseMotionHeader(tokens: string[], startIdx: number): {
  frameCount: number;
  frameTimeSec: number;
  dataStartIdx: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  let idx = startIdx;
  let frameCount = 0;
  let frameTimeSec = 1 / 30;

  if (tokens[idx] === "Frames:" || tokens[idx] === "Frames") {
    idx++;
    frameCount = Math.max(0, Math.floor(Number(tokens[idx++] ?? "0")));
  } else {
    warnings.push('Missing "Frames:" in MOTION header; inferring from data length.');
  }

  if (tokens[idx] === "Frame" && tokens[idx + 1] === "Time:") {
    idx += 2;
    frameTimeSec = Number(tokens[idx++] ?? "0");
  } else if (tokens[idx] === "Frame" && tokens[idx + 1] === "Time") {
    idx += 2;
    frameTimeSec = Number(tokens[idx++] ?? "0");
  } else {
    warnings.push('Missing "Frame Time:" in MOTION header; using 1/30s.');
  }

  if (!Number.isFinite(frameTimeSec) || frameTimeSec <= 0) {
    frameTimeSec = 1 / 30;
    warnings.push("Invalid Frame Time value; using 1/30s.");
  }

  return { frameCount, frameTimeSec, dataStartIdx: idx, warnings };
}

export function parseBvhFile(text: string): BvhParseResult {
  const tokens = tokenize(text);
  const state: ParseState = { tokens, idx: 0, warnings: [] };

  expect(state, "HIERARCHY");
  const rootToken = state.tokens[state.idx++];
  if (rootToken !== "ROOT") {
    throw new Error(`Expected ROOT after HIERARCHY, got "${rootToken ?? "<eof>"}"`);
  }
  const rootName = state.tokens[state.idx++];
  if (!rootName) throw new Error("ROOT missing name");
  const root = parseJointBody(state, rootName, { forceNoChannels: false, isEndSite: false });

  const maybeAnotherRoot = state.tokens.slice(state.idx).filter((t) => t === "ROOT").length;
  if (maybeAnotherRoot > 0) {
    state.warnings.push(`Detected extra ROOT declarations (${maybeAnotherRoot}), only first hierarchy is used.`);
  }

  const motionToken = state.tokens[state.idx++];
  if (motionToken !== "MOTION") {
    throw new Error(`Expected MOTION section, got "${motionToken ?? "<eof>"}"`);
  }

  const motion = parseMotionHeader(state.tokens, state.idx);
  state.warnings.push(...motion.warnings);
  state.idx = motion.dataStartIdx;

  const channelCount = countChannels(root);
  const dataValues: number[] = [];
  while (state.idx < state.tokens.length) {
    const token = state.tokens[state.idx++];
    const value = Number(token);
    if (!Number.isFinite(value)) {
      state.warnings.push(`Ignoring non-numeric MOTION token "${token}".`);
      continue;
    }
    dataValues.push(value);
  }

  const usableFrames = channelCount > 0 ? Math.floor(dataValues.length / channelCount) : 0;
  if (channelCount === 0) {
    state.warnings.push("Hierarchy has zero channels.");
  } else if (dataValues.length % channelCount !== 0) {
    state.warnings.push(
      `MOTION value count ${dataValues.length} is not divisible by channel count ${channelCount}; trailing values ignored.`,
    );
  }

  const effectiveFrameCount =
    motion.frameCount > 0 ? Math.min(motion.frameCount, usableFrames) : usableFrames;
  if (motion.frameCount > 0 && effectiveFrameCount < motion.frameCount) {
    state.warnings.push(
      `Frames header says ${motion.frameCount} but only ${effectiveFrameCount} complete frames parsed.`,
    );
  }

  const frames: number[][] = [];
  for (let i = 0; i < effectiveFrameCount; i++) {
    const from = i * channelCount;
    frames.push(dataValues.slice(from, from + channelCount));
  }

  return {
    root,
    channelCount,
    frameCount: effectiveFrameCount,
    frameTimeSec: motion.frameTimeSec,
    frames,
    warnings: state.warnings,
  };
}
