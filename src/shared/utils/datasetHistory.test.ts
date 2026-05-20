import { describe, expect, it } from 'vitest';
import {
  computeDatasetHistoryDedupeKey,
  fingerprintRosFileSet,
  normalizeDatasetHistoryUrl,
  tarFileFingerprint,
} from './datasetHistory';

describe('normalizeDatasetHistoryUrl', () => {
  it('lowercases host and strips hash', () => {
    expect(normalizeDatasetHistoryUrl('HTTPS://Example.COM/path/File.MCAP#frag')).toBe(
      'https://example.com/path/File.MCAP',
    );
  });

  it('returns trimmed lowercase for non-absolute URLs', () => {
    expect(normalizeDatasetHistoryUrl('  ./Relative/Path  ')).toBe('./relative/path');
  });
});

describe('fingerprintRosFileSet', () => {
  it('is order-independent', () => {
    const a = [
      { name: 'b.mcap', size: 2, lastModified: 20 },
      { name: 'a.mcap', size: 1, lastModified: 10 },
    ];
    const b = [
      { name: 'a.mcap', size: 1, lastModified: 10 },
      { name: 'b.mcap', size: 2, lastModified: 20 },
    ];
    expect(fingerprintRosFileSet(a)).toBe(fingerprintRosFileSet(b));
  });
});

describe('tarFileFingerprint', () => {
  it('includes name size and lastModified', () => {
    expect(tarFileFingerprint({ name: 'x.tar', size: 3, lastModified: 99 })).toBe('x.tar:3:99');
  });
});

describe('computeDatasetHistoryDedupeKey', () => {
  it('keys url and remote_tar separately', () => {
    const u = 'https://example.com/data.mcap';
    expect(
      computeDatasetHistoryDedupeKey({
        id: '1',
        openedAt: 1,
        kind: 'url',
        displayName: 'data.mcap',
        url: u,
      }),
    ).toBe(`url:${normalizeDatasetHistoryUrl(u)}`);
    expect(
      computeDatasetHistoryDedupeKey({
        id: '2',
        openedAt: 1,
        kind: 'remote_tar',
        displayName: 'a.tgz',
        url: u,
      }),
    ).toBe(`remote_tar:${normalizeDatasetHistoryUrl(u)}`);
  });

  it('prefers sampleId for sample kind', () => {
    expect(
      computeDatasetHistoryDedupeKey({
        id: '1',
        openedAt: 1,
        kind: 'sample',
        displayName: 'Sample',
        url: 'https://example.com/a.tar',
        sampleId: 'demo-1',
      }),
    ).toBe('sample:id:demo-1');
  });

  it('uses fileSetFingerprint when present', () => {
    const fp = 'a.mcap:1:1|b.mcap:2:2';
    expect(
      computeDatasetHistoryDedupeKey({
        id: '1',
        openedAt: 1,
        kind: 'file_meta',
        displayName: 'ignored',
        fileSetFingerprint: fp,
      }),
    ).toBe(`fileset:${fp}`);
  });

  it('uses persisted dedupeKey when set', () => {
    expect(
      computeDatasetHistoryDedupeKey({
        id: '1',
        openedAt: 1,
        kind: 'url',
        displayName: 'x',
        url: 'https://a',
        dedupeKey: 'custom:key',
      }),
    ).toBe('custom:key');
  });
});
