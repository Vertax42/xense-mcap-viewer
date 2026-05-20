/**
 * Unified dataset list for Xense MCAP Viewer: local files + remote URLs.
 * Merge order: `files` → `file` → `urls` → `url` (files before URLs).
 */

export type DatasetItem = {
  id: string;
  kind: 'file' | 'url';
  /** Display label (file basename or URL tail) */
  name: string;
  file?: File;
  url?: string;
  /** Optional manifest metadata (remote list or host-injected). */
  sizeBytes?: number;
  durationSec?: number;
  topicCount?: number;
  /** Files opened together, e.g. from a directory. Some formats need sibling files to initialize correctly. */
  siblingFiles?: File[];
};

/** One row from host `fileManifest` or remote dataset JSON. */
export type FileListItem = {
  url: string;
  name?: string;
  sizeBytes?: number;
  durationSec?: number;
  topicCount?: number;
};

const ROS_EXT = /\.(mcap|bag|db3|hdf5|h5|bvh)$/i;

export function isRosRecordingFilename(name: string): boolean {
  return ROS_EXT.test(name);
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function makeFileDataset(file: File): DatasetItem {
  return {
    id: `file:${fileKey(file)}`,
    kind: 'file',
    name: file.name,
    file,
  };
}

function makeUrlDataset(url: string, sizeBytes?: number): DatasetItem {
  const trimmed = url.trim();
  const name = trimmed.split('/').pop() || trimmed;
  return {
    id: `url:${trimmed}`,
    kind: 'url',
    name,
    url: trimmed,
    ...(typeof sizeBytes === 'number' &&
    Number.isFinite(sizeBytes) &&
    sizeBytes > 0
      ? { sizeBytes: Math.floor(sizeBytes) }
      : {}),
  };
}

export type McapViewerSourceProps = {
  file?: File;
  files?: File[];
  url?: string;
  urls?: string[];
  /** Inline manifest rows or JSON URL string (embed via `fileManifest` prop). */
  fileManifest?: string | FileListItem[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null;
}

/** Parse remote JSON array into rows; invalid entries skipped (logged). */
export function parseRemoteDatasetListJson(json: unknown): FileListItem[] {
  if (!Array.isArray(json)) {
    throw new Error('Dataset list JSON must be an array');
  }
  const out: FileListItem[] = [];
  for (const row of json) {
    if (!isRecord(row)) continue;
    const url = row.url;
    if (typeof url !== 'string' || !url.trim()) continue;
    const name = typeof row.name === 'string' ? row.name : undefined;
    const sizeBytes = typeof row.sizeBytes === 'number' ? row.sizeBytes : undefined;
    const durationSec = typeof row.durationSec === 'number' ? row.durationSec : undefined;
    const topicCount = typeof row.topicCount === 'number' ? row.topicCount : undefined;
    out.push({ url: url.trim(), name, sizeBytes, durationSec, topicCount });
  }
  return out;
}

export function datasetItemsFromListItems(items: FileListItem[]): DatasetItem[] {
  return items.map((row, i) => {
    const u = row.url.trim();
    const name = row.name?.trim() || u.split('/').pop() || u;
    return {
      id: `url:${u}:${i}`,
      kind: 'url' as const,
      name,
      url: u,
      sizeBytes: row.sizeBytes,
      durationSec: row.durationSec,
      topicCount: row.topicCount,
    };
  });
}

/**
 * Normalize props into a deduplicated dataset list (files first, then URLs).
 */
export function normalizeMcapViewerSources(props: McapViewerSourceProps): DatasetItem[] {
  const out: DatasetItem[] = [];
  const seenFileKeys = new Set<string>();
  const seenUrls = new Set<string>();

  const pushFile = (file: File | undefined) => {
    if (!file || !isRosRecordingFilename(file.name)) return;
    const key = fileKey(file);
    if (seenFileKeys.has(key)) return;
    seenFileKeys.add(key);
    out.push(makeFileDataset(file));
  };

  const pushUrl = (raw: string | undefined) => {
    if (!raw?.trim()) return;
    const u = raw.trim();
    if (seenUrls.has(u)) return;
    seenUrls.add(u);
    out.push(makeUrlDataset(u));
  };

  for (const f of props.files ?? []) {
    pushFile(f);
  }
  pushFile(props.file);
  for (const u of props.urls ?? []) {
    pushUrl(u);
  }
  pushUrl(props.url);

  if (Array.isArray(props.fileManifest)) {
    const rows = datasetItemsFromListItems(props.fileManifest);
    for (const item of rows) {
      if (seenUrls.has(item.url ?? '')) continue;
      seenUrls.add(item.url ?? '');
      out.push(item);
    }
  }

  return out;
}

/** Dedupe by id, keeping first occurrence (caller controls order). */
export function dedupeDatasetItems(items: DatasetItem[]): DatasetItem[] {
  const seen = new Set<string>();
  const out: DatasetItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function mergeDatasetLists(base: DatasetItem[], extra: DatasetItem[]): DatasetItem[] {
  return dedupeDatasetItems([...base, ...extra]);
}

/** Collect ROS files from a directory-style FileList (e.g. webkitdirectory). */
export function filterRosFilesFromFileList(fileList: FileList | File[]): File[] {
  const arr = Array.from(fileList as Iterable<File>);
  return arr.filter((f) => isRosRecordingFilename(f.name));
}
