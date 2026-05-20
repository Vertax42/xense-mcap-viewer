import type { Readable } from '@/core/types/player';

export class BlobReadable implements Readable {
  private _blob: Blob;

  constructor(blob: Blob) {
    this._blob = blob;
  }

  size(): Promise<number> {
    return Promise.resolve(this._blob.size);
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    const slice = this._blob.slice(offset, offset + length);
    const arrayBuffer = await slice.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
