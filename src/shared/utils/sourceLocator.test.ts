import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatRemoteLocatorForAddressBar,
  isCustomLocalLocatorString,
  mergeSpaSearchForUrlParam,
  parseSourceLocator,
  serializeSourceLocator,
} from './sourceLocator';

describe('parseSourceLocator', () => {
  it('parses file:// and folder:// display names', () => {
    expect(parseSourceLocator('file://test.mcap')).toEqual({
      kind: 'local_file',
      displayName: 'test.mcap',
    });
    expect(parseSourceLocator('folder://dataset')).toEqual({
      kind: 'local_folder',
      displayName: 'dataset',
    });
  });

  it('parses sample:// id', () => {
    expect(parseSourceLocator('sample://franka_stack')).toEqual({
      kind: 'sample',
      sampleId: 'franka_stack',
    });
  });

  it('treats other values as remote', () => {
    expect(parseSourceLocator('/examples/a.mcap')).toMatchObject({
      kind: 'remote',
      raw: '/examples/a.mcap',
    });
    expect(parseSourceLocator('https://x.example/a.mcap')).toMatchObject({
      kind: 'remote',
      raw: 'https://x.example/a.mcap',
    });
  });
});

describe('serializeSourceLocator', () => {
  it('round-trips local ASCII names', () => {
    const f = parseSourceLocator('file://a.mcap')!;
    expect(f.kind).toBe('local_file');
    expect(serializeSourceLocator(f)).toBe('file://a.mcap');
  });

  it('round-trips sample id', () => {
    const s = parseSourceLocator('sample://dualairbot_fold')!;
    expect(s.kind).toBe('sample');
    expect(serializeSourceLocator(s)).toBe('sample://dualairbot_fold');
  });
});

describe('isCustomLocalLocatorString', () => {
  it('treats sample:// as custom', () => {
    expect(isCustomLocalLocatorString('sample://x')).toBe(true);
    expect(isCustomLocalLocatorString('https://a/b')).toBe(false);
  });
});

describe('mergeSpaSearchForUrlParam', () => {
  it('preserves theme and drops unrelated keys', () => {
    const q = mergeSpaSearchForUrlParam(
      '?theme=dark&list=https%3A%2F%2Fx&urls[]=%2Fa&url=%2Fold',
      '/examples/x.mcap',
    );
    expect(q).toContain('theme=dark');
    expect(q).toContain('url=%2Fexamples%2Fx.mcap');
    expect(q).not.toContain('list=');
    expect(q).not.toContain('urls');
  });
});

describe('formatRemoteLocatorForAddressBar', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.test', href: 'https://app.test/' },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses pathname for same-origin URLs', () => {
    expect(formatRemoteLocatorForAddressBar('https://app.test/examples/a.mcap')).toBe('/examples/a.mcap');
  });
});
