import type { Initialization, MessageEvent } from '@/core/types/ros';
import type { GetAdjacentMessageArgs, MessageIteratorArgs, GetBackfillMessagesArgs } from '@/infra/workers/types';

export type { GetAdjacentMessageArgs, AdjacentDirection } from '@/infra/workers/types';

export interface IIterableSource {
  initialize(): Promise<Initialization>;
  messageIterator(args: MessageIteratorArgs): AsyncIterableIterator<MessageEvent>;
  getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent[]>;
  /** Next/prev message in log time across the given topics (optional; workers may gate). */
  getAdjacentMessage?(args: GetAdjacentMessageArgs): Promise<MessageEvent | null>;
}
