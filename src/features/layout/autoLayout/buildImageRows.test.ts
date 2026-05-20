import { describe, expect, it } from 'vitest';
import { buildImageRows } from '@/features/layout/autoLayout/buildImageRows';

describe('buildImageRows', () => {
  it('returns empty for no topics', () => {
    expect(buildImageRows([])).toEqual([]);
  });

  it('uses one row for up to 4 topics', () => {
    const names = ['/a', '/b', '/c', '/d'];
    expect(buildImageRows(names)).toEqual([['/a', '/b', '/c', '/d']]);
  });

  it('splits 6 topics as 2 rows of 3', () => {
    const names = ['/1', '/2', '/3', '/4', '/5', '/6'];
    expect(buildImageRows(names)).toEqual([
      ['/1', '/2', '/3'],
      ['/4', '/5', '/6'],
    ]);
  });

  it('splits 7 topics as 4 + 3', () => {
    const names = ['/1', '/2', '/3', '/4', '/5', '/6', '/7'];
    expect(buildImageRows(names)).toEqual([
      ['/1', '/2', '/3', '/4'],
      ['/5', '/6', '/7'],
    ]);
  });

  it('splits 10 topics across 3 rows as 4+3+3', () => {
    const names = Array.from({ length: 10 }, (_, i) => `/t${i}`);
    expect(buildImageRows(names)).toEqual([
      ['/t0', '/t1', '/t2', '/t3'],
      ['/t4', '/t5', '/t6'],
      ['/t7', '/t8', '/t9'],
    ]);
  });

  it('caps at 12 panels', () => {
    const names = Array.from({ length: 20 }, (_, i) => `/cam${i}`);
    const rows = buildImageRows(names);
    const flat = rows.flat();
    expect(flat).toHaveLength(12);
  });
});
