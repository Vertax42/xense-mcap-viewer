import { isRosRecordingFilename } from '@/shared/utils/datasetSources';
import { walkDirectoryHandle } from '@/shared/utils/collectDirectoryRosFiles';

type DataTransferItemWithHandle = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

export type DragRosRecordingFilesResult = {
  files: File[];
  fileHandles?: FileSystemFileHandle[];
  directoryHandle?: FileSystemDirectoryHandle;
};

type FileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type FileSystemFileEntry = FileSystemEntry & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type FileSystemDirectoryEntry = FileSystemEntry & {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntry[]) => void,
      error?: (error: DOMException) => void,
    ) => void;
  };
};

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile && 'file' in entry;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory && 'createReader' in entry;
}

function readLegacyFileEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(isRosRecordingFilename(file.name) ? file : null),
      () => resolve(null),
    );
  });
}

function readLegacyDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];
  return new Promise((resolve) => {
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        () => resolve(entries),
      );
    };
    readBatch();
  });
}

async function collectLegacyEntryFiles(entry: FileSystemEntry, maxDepth: number, depth: number, out: File[]): Promise<void> {
  if (depth > maxDepth) return;
  if (isFileEntry(entry)) {
    const file = await readLegacyFileEntry(entry);
    if (file) out.push(file);
    return;
  }
  if (!isDirectoryEntry(entry) || depth >= maxDepth) {
    return;
  }
  const children = await readLegacyDirectoryEntries(entry);
  for (const child of children) {
    await collectLegacyEntryFiles(child, maxDepth, depth + 1, out);
  }
}

function fileKey(file: File): string {
  return `${file.name}\0${file.size}\0${file.lastModified}`;
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const file of files) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

async function fileHandlesToFiles(fileHandles: FileSystemFileHandle[]): Promise<File[]> {
  const out: File[] = [];
  for (const handle of fileHandles) {
    try {
      const file = await handle.getFile();
      if (isRosRecordingFilename(file.name)) out.push(file);
    } catch {
      return [];
    }
  }
  return out;
}

/**
 * Collect `FileSystemFileHandle` from drag-and-drop when the browser supports
 * `DataTransferItem.getAsFileSystemHandle()` (File System Access API).
 */
export async function collectRosRecordingFileHandlesFromDataTransfer(
  items: DataTransferItemList | undefined,
): Promise<FileSystemFileHandle[] | undefined> {
  if (!items || items.length === 0) return undefined;
  const handles: FileSystemFileHandle[] = [];
  let sawFileItem = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    sawFileItem = true;
    const anyItem = item as DataTransferItemWithHandle;
    if (typeof anyItem.getAsFileSystemHandle !== 'function') {
      return undefined;
    }
    try {
      const h = await anyItem.getAsFileSystemHandle();
      if (h && h.kind === 'file') {
        handles.push(h as FileSystemFileHandle);
      }
    } catch {
      return undefined;
    }
  }
  if (!sawFileItem) return undefined;
  return handles.length > 0 ? handles : undefined;
}

export async function collectRosRecordingFilesFromDataTransfer(
  items: DataTransferItemList | undefined,
  maxDepth = 8,
): Promise<DragRosRecordingFilesResult | null> {
  if (!items || items.length === 0) return null;
  const files: File[] = [];
  const fileHandles: FileSystemFileHandle[] = [];
  let directoryHandle: FileSystemDirectoryHandle | undefined;
  let sawHandleApi = false;
  let sawLegacyEntry = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const anyItem = item as DataTransferItemWithHandle;
    if (typeof anyItem.getAsFileSystemHandle === 'function') {
      sawHandleApi = true;
      try {
        const handle = await anyItem.getAsFileSystemHandle();
        if (!handle) continue;
        if (handle.kind === 'file') {
          fileHandles.push(handle as FileSystemFileHandle);
          continue;
        }
        const dir = handle as FileSystemDirectoryHandle;
        directoryHandle ??= dir;
        await walkDirectoryHandle(dir, maxDepth, 0, files);
      } catch {
        return null;
      }
      continue;
    }

    if (typeof anyItem.webkitGetAsEntry === 'function') {
      sawLegacyEntry = true;
      const entry = anyItem.webkitGetAsEntry();
      if (entry) {
        await collectLegacyEntryFiles(entry, maxDepth, 0, files);
      }
    }
  }

  if (fileHandles.length > 0) {
    files.push(...await fileHandlesToFiles(fileHandles));
  }
  const uniqueFiles = dedupeFiles(files);
  if (uniqueFiles.length === 0 && !sawHandleApi && !sawLegacyEntry) {
    return null;
  }
  return {
    files: uniqueFiles,
    ...(fileHandles.length > 0 ? { fileHandles } : {}),
    ...(directoryHandle ? { directoryHandle } : {}),
  };
}

/**
 * Align raw dropped handles to the given ROS recording files (same name, size, lastModified).
 * Returns `undefined` if any file is missing a matching handle (caller should fall back to metadata-only history).
 */
export async function alignFileHandlesToRosFiles(
  rosFiles: File[],
  rawHandles: FileSystemFileHandle[],
): Promise<FileSystemFileHandle[] | undefined> {
  if (rosFiles.length === 0 || rawHandles.length === 0) return undefined;
  const byKey = new Map<string, FileSystemFileHandle>();
  for (const h of rawHandles) {
    try {
      const f = await h.getFile();
      if (!isRosRecordingFilename(f.name)) continue;
      const key = `${f.name}\0${f.size}\0${f.lastModified}`;
      if (!byKey.has(key)) byKey.set(key, h);
    } catch {
      return undefined;
    }
  }
  const aligned: FileSystemFileHandle[] = [];
  for (const f of rosFiles) {
    const key = `${f.name}\0${f.size}\0${f.lastModified}`;
    const h = byKey.get(key);
    if (!h) return undefined;
    aligned.push(h);
  }
  return aligned.length === rosFiles.length ? aligned : undefined;
}
