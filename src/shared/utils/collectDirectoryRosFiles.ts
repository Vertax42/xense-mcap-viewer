import { filterRosFilesFromFileList, isRosRecordingFilename } from './datasetSources';

export type DirectoryRosFilesPickResult = {
  files: File[];
  /** Present when the user picked via File System Access API (not webkitdirectory fallback). */
  directoryHandle?: FileSystemDirectoryHandle | null;
};

export async function walkDirectoryHandle(
  dir: FileSystemDirectoryHandle,
  maxDepth: number,
  depth: number,
  out: File[],
): Promise<void> {
  if (depth > maxDepth) return;
  for await (const [, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      const fh = handle;
      const file = await fh.getFile();
      if (isRosRecordingFilename(file.name)) out.push(file);
    } else if (handle.kind === 'directory' && depth < maxDepth) {
      await walkDirectoryHandle(handle, maxDepth, depth + 1, out);
    }
  }
}

/**
 * Prefer File System Access API directory picker; fall back to `<input webkitdirectory>`.
 */
export async function collectRosFilesFromUserDirectoryChoice(
  maxDepth = 8,
): Promise<DirectoryRosFilesPickResult> {
  type WindowWithDirPicker = typeof window & {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  };
  const w = window as WindowWithDirPicker;
  if (typeof window !== 'undefined' && typeof w.showDirectoryPicker === 'function') {
    try {
      const dir = await w.showDirectoryPicker({ mode: 'read' });
      const out: File[] = [];
      await walkDirectoryHandle(dir, maxDepth, 0, out);
      return { files: out, directoryHandle: dir };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { files: [], directoryHandle: null };
      }
      // fall through to webkitdirectory
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener(
      'change',
      () => {
        const files = filterRosFilesFromFileList(input.files ?? []);
        document.body.removeChild(input);
        resolve({ files, directoryHandle: null });
      },
      { once: true },
    );
    input.click();
  });
}
