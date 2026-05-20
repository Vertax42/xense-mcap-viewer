/**
 * Sample dataset manifest loading (same env contract as LeRobot).
 * @see VITE_SAMPLES_BASE_URL, VITE_SAMPLE_DATASETS_MANIFEST_URL, getSampleDatasetsManifestUrl (SPA `?url=sample://id`)
 */

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  url?: string;
  version?: 'v2' | 'v3';
  title?: string;
  coverImageUrl?: string;
  previewVideoUrl?: string;
  archiveUrl?: string;
}

export function getArchiveUrl(sample: SampleDataset): string {
  return sample.archiveUrl || sample.url || '';
}

/** When manifest is missing or invalid, show empty list (MCAP-oriented samples expected). */
export const DEFAULT_SAMPLE_DATASETS: SampleDataset[] = [];

export interface SampleDatasetsManifestV1 {
  schemaVersion: 1;
  generatedAt?: string;
  baseUrl?: string;
  datasets: Array<{
    id: string;
    title?: string;
    name?: string;
    description?: string;
    version?: 'v2' | 'v3';
    archiveUrl?: string;
    archiveFile?: string;
    coverImageUrl?: string;
    coverImageFile?: string;
    previewVideoUrl?: string;
  }>;
}

function getSamplesBaseUrl(): string | null {
  const raw = import.meta.env.VITE_SAMPLES_BASE_URL;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Resolved manifest URL from env / origin, or `null` when samples are disabled. */
export function getSampleDatasetsManifestUrl(): string | null {
  const baseUrl = getSamplesBaseUrl();
  if (baseUrl) {
    try {
      return new URL('sample-datasets.manifest.json', baseUrl).toString();
    } catch {
      // ignore
    }
  }

  const fromEnv = import.meta.env.VITE_SAMPLE_DATASETS_MANIFEST_URL;
  if (fromEnv === 'off') return null;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();

  if (typeof window !== 'undefined') {
    try {
      return new URL('/sample-datasets.manifest.json', window.location.origin).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function resolveMaybeRelativeUrl(value: string, base: string): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function normalizeSamplesFromManifest(manifest: SampleDatasetsManifestV1, manifestUrl: string): SampleDataset[] {
  const envBase = getSamplesBaseUrl();
  const resolvedBase = envBase
    ? envBase
    : manifest.baseUrl?.trim()
      ? resolveMaybeRelativeUrl(manifest.baseUrl.trim(), manifestUrl)
      : (() => {
          try {
            return new URL('./', manifestUrl).toString();
          } catch {
            return manifestUrl;
          }
        })();

  return (manifest.datasets || [])
    .filter((d) => !!d && typeof d.id === 'string' && d.id.trim())
    .map((d) => {
      const title = d.title || d.name || d.id;
      const archiveUrl =
        d.archiveUrl?.trim()
          ? resolveMaybeRelativeUrl(d.archiveUrl.trim(), manifestUrl)
          : d.archiveFile?.trim()
            ? resolveMaybeRelativeUrl(d.archiveFile.trim(), resolvedBase)
            : '';
      const coverImageUrl =
        d.coverImageUrl?.trim()
          ? resolveMaybeRelativeUrl(d.coverImageUrl.trim(), manifestUrl)
          : d.coverImageFile?.trim()
            ? resolveMaybeRelativeUrl(d.coverImageFile.trim(), resolvedBase)
            : undefined;

      const version: 'v2' | 'v3' = d.version === 'v3' ? 'v3' : 'v2';

      return {
        id: d.id,
        name: title,
        title,
        description: d.description || '',
        url: archiveUrl || '',
        archiveUrl: archiveUrl || '',
        version,
        coverImageUrl,
        previewVideoUrl: d.previewVideoUrl,
      } satisfies SampleDataset;
    })
    .filter((s) => !!s.url);
}

let _cachedSamples: SampleDataset[] | null = null;
let _pendingLoad: Promise<SampleDataset[]> | null = null;

export async function loadSampleDatasets(options?: { forceReload?: boolean }): Promise<SampleDataset[]> {
  if (!options?.forceReload) {
    if (_cachedSamples) return _cachedSamples;
    if (_pendingLoad) return _pendingLoad;
  }

  const manifestUrl = getSampleDatasetsManifestUrl();
  if (!manifestUrl) {
    _cachedSamples = DEFAULT_SAMPLE_DATASETS;
    return _cachedSamples;
  }

  _pendingLoad = (async () => {
    try {
      const res = await fetch(manifestUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
      const json = (await res.json()) as SampleDatasetsManifestV1;
      if (!json || json.schemaVersion !== 1 || !Array.isArray(json.datasets)) {
        throw new Error('Invalid samples manifest schema');
      }
      const samples = normalizeSamplesFromManifest(json, manifestUrl);
      _cachedSamples = samples.length > 0 ? samples : DEFAULT_SAMPLE_DATASETS;
      return _cachedSamples;
    } catch (e) {
      console.warn('[Xense MCAP Viewer] Failed to load sample datasets manifest', e);
      _cachedSamples = DEFAULT_SAMPLE_DATASETS;
      return _cachedSamples;
    } finally {
      _pendingLoad = null;
    }
  })();

  return _pendingLoad;
}
