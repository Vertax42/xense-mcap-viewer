import { describe, expect, it } from 'vitest';
import { parseRawMessagesConfig } from './schema';
import { buildRowsForShape } from './shapeTree';

describe('parseRawMessagesConfig', () => {
  it('returns defaults for invalid input', () => {
    const parsed = parseRawMessagesConfig(undefined);
    expect(parsed.topic).toBe('');
    expect(parsed.uiRefreshHz).toBe(10);
    expect(parsed.latestOnly).toBe(true);
    expect(parsed.maxExpandedDepth).toBe(4);
    expect(parsed.maxRows).toBe(2000);
    expect(parsed.maxBinaryPreviewBytes).toBe(256);
    expect(parsed.binaryCopyFormat).toBe('uint8array');
  });

  it('sanitizes configured values', () => {
    const parsed = parseRawMessagesConfig({
      topic: '/camera/image_raw',
      uiRefreshHz: 200,
      pauseUpdates: true,
      latestOnly: true,
      maxExpandedDepth: 99,
      maxRows: 99,
      maxBinaryPreviewBytes: 2,
      binaryCopyFormat: 'hex',
    });
    expect(parsed.topic).toBe('/camera/image_raw');
    expect(parsed.uiRefreshHz).toBe(60);
    expect(parsed.pauseUpdates).toBe(true);
    expect(parsed.latestOnly).toBe(true);
    expect(parsed.maxExpandedDepth).toBe(6);
    expect(parsed.maxRows).toBe(200);
    expect(parsed.maxBinaryPreviewBytes).toBe(16);
    expect(parsed.binaryCopyFormat).toBe('hex');
  });
});

describe('buildRowsForShape', () => {
  const message = {
    joints: [
      { name: 'hip', angle: 1.25, velocity: 0.5 },
      { name: 'knee', angle: 0.75, velocity: 0.25 },
    ],
  };

  it('includes fields inside array item objects when depth allows it', () => {
    const { rows } = buildRowsForShape(message, 3, 100);
    const paths = rows.map((row) => row.path);

    expect(paths).toContain('message.joints.0.name');
    expect(paths).toContain('message.joints.0.angle');
    expect(paths).toContain('message.joints.1.velocity');
  });

  it('preserves the old truncation behavior at depth 2', () => {
    const { rows } = buildRowsForShape(message, 2, 100);
    const paths = rows.map((row) => row.path);

    expect(paths).toContain('message.joints.0');
    expect(paths).not.toContain('message.joints.0.name');
  });

  it('marks rows that were generated from array items', () => {
    const { rows } = buildRowsForShape(message, 3, 100);
    const firstJoint = rows.find((row) => row.path === 'message.joints.0');

    expect(firstJoint).toMatchObject({
      key: '0',
      expandable: true,
      parentIsArray: true,
    });
  });
});
