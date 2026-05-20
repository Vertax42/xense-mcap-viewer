import { isRosRecordingFilename } from '@/shared/utils/datasetSources';

export type RosRecordingPickResult = {
  files: File[];
  fileHandles?: FileSystemFileHandle[];
};

type WindowWithFilePicker = typeof window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle | FileSystemFileHandle[]>;
};

/**
 * Prefer File System Access API for persistent handles; otherwise returns empty and caller uses `<input type="file">`.
 */
export async function pickRosRecordingFiles(): Promise<RosRecordingPickResult | null> {
  const w = window as WindowWithFilePicker;
  if (typeof window === 'undefined' || typeof w.showOpenFilePicker !== 'function') {
    return null;
  }
  try {
    const picked = await w.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: 'ROS / HDF5 recordings',
          accept: {
            'application/octet-stream': ['.mcap', '.bag', '.db3', '.hdf5', '.h5', '.bvh'],
          },
        },
      ],
    });
    const handles = Array.isArray(picked) ? picked : [picked];
    const files: File[] = [];
    const fileHandles: FileSystemFileHandle[] = [];
    for (const h of handles) {
      const file = await h.getFile();
      if (isRosRecordingFilename(file.name)) {
        files.push(file);
        fileHandles.push(h);
      }
    }
    if (files.length === 0) {
      return { files: [], fileHandles: [] };
    }
    return { files, fileHandles };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { files: [], fileHandles: [] };
    }
    return null;
  }
}

