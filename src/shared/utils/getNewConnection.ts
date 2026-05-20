import { isOverlapping } from "intervals-fn";
import { isRangeCoveredByRanges, missingRanges } from "./ranges";
import type { Range } from "./ranges";

export function getNewConnection(options: {
  currentRemainingRange?: Range;
  readRequestRange?: Range;
  downloadedRanges: Range[];
  lastResolvedCallbackEnd?: number;
  maxRequestSize: number;
  fileSize: number;
  continueDownloadingThreshold: number;
}): Range | undefined {
  const { readRequestRange, currentRemainingRange, ...otherOptions } = options;
  if (readRequestRange) {
    return getNewConnectionWithExistingReadRequest({
      readRequestRange,
      currentRemainingRange,
      ...otherOptions,
    });
  } else if (!currentRemainingRange) {
    return getNewConnectionWithoutExistingConnection(otherOptions);
  }
  return undefined;
}

function getNewConnectionWithExistingReadRequest({
  currentRemainingRange,
  readRequestRange,
  downloadedRanges,
  maxRequestSize,
  fileSize,
  continueDownloadingThreshold,
}: {
  currentRemainingRange?: Range;
  readRequestRange: Range;
  downloadedRanges: Range[];
  lastResolvedCallbackEnd?: number;
  maxRequestSize: number;
  fileSize: number;
  continueDownloadingThreshold: number;
}): Range | undefined {
  if (readRequestRange.end - readRequestRange.start > maxRequestSize) {
    throw new Error(
      `Range ${readRequestRange.start}-${readRequestRange.end} exceeds max request size ${maxRequestSize} (file size ${fileSize})`,
    );
  }

  const notDownloadedRanges = missingRanges(readRequestRange, downloadedRanges);

  if (!notDownloadedRanges[0]) {
    throw new Error(
      "Range for the first read request is fully downloaded, so it should have been deleted",
    );
  }

  const startNewConnection =
    !currentRemainingRange ||
    !isOverlapping(notDownloadedRanges, [currentRemainingRange]) ||
    currentRemainingRange.start + continueDownloadingThreshold < notDownloadedRanges[0].start;

  if (!startNewConnection) {
    return;
  }
  if (maxRequestSize >= fileSize) {
    const range = { start: notDownloadedRanges[0].start, end: fileSize };
    return missingRanges(range, downloadedRanges)[0];
  }

  if (notDownloadedRanges[0].end === readRequestRange.end) {
    return {
      ...notDownloadedRanges[0],
      end: Math.min(readRequestRange.start + maxRequestSize, fileSize),
    };
  }

  return notDownloadedRanges[0];
}

function getNewConnectionWithoutExistingConnection({
  downloadedRanges,
  lastResolvedCallbackEnd,
  maxRequestSize,
  fileSize,
}: {
  downloadedRanges: Range[];
  lastResolvedCallbackEnd?: number;
  maxRequestSize: number;
  fileSize: number;
}): Range | undefined {
  let readAheadRange: Range | undefined;
  if (maxRequestSize >= fileSize) {
    const potentialRange = { start: lastResolvedCallbackEnd ?? 0, end: fileSize };
    if (!isRangeCoveredByRanges(potentialRange, downloadedRanges)) {
      readAheadRange = potentialRange;
    } else {
      readAheadRange = { start: 0, end: fileSize };
    }
  } else if (lastResolvedCallbackEnd != undefined) {
    readAheadRange = {
      start: lastResolvedCallbackEnd,
      end: Math.min(lastResolvedCallbackEnd + maxRequestSize, fileSize),
    };
  }
  if (readAheadRange) {
    return missingRanges(readAheadRange, downloadedRanges)[0];
  }
  return undefined;
}
