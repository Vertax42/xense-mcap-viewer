import type { MessageEvent } from '@/core/types/ros';
import type { IMessageCursor } from '@/infra/workers/types';

export class BufferedIterableSource {
  private _cursor?: IMessageCursor<unknown>;

  constructor(cursor: IMessageCursor<unknown>) {
    this._cursor = cursor;
  }

  async nextBatch(durationMs: number): Promise<MessageEvent[]> {
    if (!this._cursor) return [];
    
    // Simple implementation for now: just proxy to cursor
    return await this._cursor.nextBatch(durationMs);
  }

  async close() {
    if (this._cursor) {
      await this._cursor.end();
    }
  }
}
