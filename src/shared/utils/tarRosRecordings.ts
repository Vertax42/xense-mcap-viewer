import { gunzipSync } from 'fflate';
import { isRosRecordingFilename } from '@/shared/utils/datasetSources';

function readNullTerminatedString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const slice = end >= 0 ? bytes.subarray(0, end) : bytes;
  return new TextDecoder('utf-8', { fatal: false }).decode(slice);
}

function readOctalField(bytes: Uint8Array): number {
  const s = readNullTerminatedString(bytes).replace(/\0/g, '').trim();
  if (!s) return 0;
  const n = parseInt(s, 8);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a POSIX ustar tar (optional gzip) and return File objects for supported ROS recordings.
 */
export function extractRosFilesFromTarArchive(input: ArrayBuffer): File[] {
  let view = new Uint8Array(input);
  if (view.byteLength >= 2 && view[0] === 0x1f && view[1] === 0x8b) {
    view = new Uint8Array(gunzipSync(view));
  }

  const out: File[] = [];
  let offset = 0;

  while (offset + 512 <= view.byteLength) {
    let allZero = true;
    for (let i = 0; i < 512; i++) {
      if (view[offset + i] !== 0) {
        allZero = false;
        break;
      }
    }
    if (allZero) break;

    const header = view.subarray(offset, offset + 512);
    const nameField = header.subarray(0, 100);
    const prefixField = header.subarray(345, 500);
    const nameFromName = readNullTerminatedString(nameField);
    const prefix = readNullTerminatedString(prefixField);
    const fullPath = prefix ? `${prefix}/${nameFromName}` : nameFromName;
    const size = readOctalField(header.subarray(124, 136));
    const typeflag = String.fromCharCode(header[156] ?? 0);

    offset += 512;
    if (offset + size > view.byteLength) break;

    const payload = view.subarray(offset, offset + size);
    offset += size;
    const pad = (512 - (size % 512)) % 512;
    offset += pad;

    if (typeflag !== '0' && typeflag !== '\0') continue;

    const baseName = fullPath.split('/').filter(Boolean).pop() || fullPath;
    if (baseName && isRosRecordingFilename(baseName)) {
      out.push(new File([payload], baseName, { type: 'application/octet-stream' }));
    }
  }

  return out;
}
