import { McapTypes } from "@mcap/core";
import type { Readable } from '@/core/types/player';

export class RemoteReadable implements McapTypes.IReadable {
  private _readable: Readable;

  constructor(readable: Readable) {
    this._readable = readable;
  }

  async size(): Promise<bigint> {
    return BigInt(await this._readable.size());
  }

  async read(offset: bigint, length: bigint): Promise<Uint8Array> {
    return await this._readable.read(Number(offset), Number(length));
  }
}
