const MAX_COLS = 4;
const MAX_ROWS = 3;
const MAX_PANELS = MAX_COLS * MAX_ROWS;

/**
 * Split image topic names into rows: max 3 rows, max 4 columns, max 12 panels.
 * Row counts follow an even split with remainder assigned to earlier rows
 * (e.g. 7 → [4,3], 10 → [4,3,3]).
 */
export function buildImageRows(topicNames: ReadonlyArray<string>): string[][] {
  const slice = topicNames.slice(0, MAX_PANELS);
  const n = slice.length;
  if (n === 0) return [];

  const rowCount = n <= 4 ? 1 : n <= 8 ? 2 : MAX_ROWS;
  const counts: number[] = [];
  const base = Math.floor(n / rowCount);
  const extra = n % rowCount;
  for (let r = 0; r < rowCount; r++) {
    counts.push(base + (r < extra ? 1 : 0));
  }

  const rows: string[][] = [];
  let offset = 0;
  for (const c of counts) {
    rows.push(slice.slice(offset, offset + c));
    offset += c;
  }
  return rows;
}

export const IMAGE_LAYOUT_MAX_COLS = MAX_COLS;
export const IMAGE_LAYOUT_MAX_ROWS = MAX_ROWS;
