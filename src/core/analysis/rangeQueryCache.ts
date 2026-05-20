import type { GetMessagesInTimeRangeArgs, Player } from '@/core/types/player';
import type { MessageEvent } from '@/core/types/ros';
import type { DownsampleMode, TimestampMode } from './timeSeries';

interface CacheEntry {
  key: string;
  value: Promise<MessageEvent[]>;
  createdAt: number;
  lastAccessAt: number;
  sizeEstimate: number;
}

interface QueryMeta {
  fields?: string[];
  timestampMode?: TimestampMode;
  downsampleMode?: DownsampleMode;
  customTimestampPath?: string;
}

const DEFAULT_MAX_ENTRIES = 24;
const DEFAULT_MAX_SIZE_ESTIMATE = 1_500_000;

export class RangeQueryCache {
  #entries = new Map<string, CacheEntry>();
  #maxEntries = DEFAULT_MAX_ENTRIES;
  #maxSizeEstimate = DEFAULT_MAX_SIZE_ESTIMATE;

  setLimits(maxEntries: number, maxSizeEstimate: number): void {
    this.#maxEntries = Math.max(1, Math.floor(maxEntries));
    this.#maxSizeEstimate = Math.max(1000, Math.floor(maxSizeEstimate));
    this.#evictIfNeeded();
  }

  getOrCreate(
    player: Player,
    args: GetMessagesInTimeRangeArgs,
    meta: QueryMeta = {},
  ): Promise<MessageEvent[]> {
    if (!player.getMessagesInTimeRange) {
      return Promise.resolve([]);
    }
    const key = buildRangeKey(args, meta);
    const now = Date.now();
    const cached = this.#entries.get(key);
    if (cached) {
      cached.lastAccessAt = now;
      return cached.value;
    }
    const value = player
      .getMessagesInTimeRange(args)
      .catch((error) => {
        this.#entries.delete(key);
        throw error;
      });
    const entry: CacheEntry = {
      key,
      value,
      createdAt: now,
      lastAccessAt: now,
      sizeEstimate: estimateQueryCost(args, meta),
    };
    this.#entries.set(key, entry);
    this.#evictIfNeeded();
    return value;
  }

  clear(): void {
    this.#entries.clear();
  }

  getStats(): { entries: number; sizeEstimate: number } {
    let sizeEstimate = 0;
    for (const entry of this.#entries.values()) {
      sizeEstimate += entry.sizeEstimate;
    }
    return { entries: this.#entries.size, sizeEstimate };
  }

  #evictIfNeeded(): void {
    while (
      this.#entries.size > this.#maxEntries ||
      this.getStats().sizeEstimate > this.#maxSizeEstimate
    ) {
      // Linear scan to find the least-recently-used entry (O(n) per eviction,
      // but the cache is small by design so this is faster than sorting).
      let oldest: CacheEntry | undefined;
      for (const entry of this.#entries.values()) {
        if (!oldest || entry.lastAccessAt < oldest.lastAccessAt) oldest = entry;
      }
      if (!oldest) break;
      this.#entries.delete(oldest.key);
    }
  }
}

function estimateQueryCost(args: GetMessagesInTimeRangeArgs, meta: QueryMeta): number {
  const durationSec =
    (args.end.sec + args.end.nsec / 1e9) - (args.start.sec + args.start.nsec / 1e9);
  const topicFactor = Math.max(1, args.topics.length);
  const fieldFactor = Math.max(1, meta.fields?.length ?? 1);
  return Math.max(1, Math.floor(durationSec * 1000 * topicFactor * fieldFactor));
}

function buildRangeKey(args: GetMessagesInTimeRangeArgs, meta: QueryMeta): string {
  const sortedTopics = [...args.topics].sort();
  const sortedFields = [...(meta.fields ?? [])].sort();
  return JSON.stringify({
    start: args.start,
    end: args.end,
    topics: sortedTopics,
    fields: sortedFields,
    timestampMode: meta.timestampMode ?? 'receiveTime',
    downsampleMode: meta.downsampleMode ?? 'none',
    customTimestampPath: meta.customTimestampPath ?? '',
  });
}

export const rangeQueryCache = new RangeQueryCache();
