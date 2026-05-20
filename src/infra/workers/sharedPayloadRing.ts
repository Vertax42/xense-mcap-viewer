import type { SharedPayloadRef, SharedPayloadRingConfig } from "./transport";

const IDX_WRITE_SEQ = 0;
const IDX_SLOT_COUNT = 1;
const IDX_SLOT_SIZE = 2;
const IDX_DROPPED = 3;

const CONTROL_INTS = 4;

export class SharedPayloadRing {
  private readonly _control: Int32Array;
  private readonly _data: Uint8Array;
  private readonly _config: SharedPayloadRingConfig;

  constructor(config: SharedPayloadRingConfig) {
    this._config = config;
    this._control = new Int32Array(config.control, 0, CONTROL_INTS);
    this._data = new Uint8Array(config.data);
    if (Atomics.load(this._control, IDX_SLOT_COUNT) === 0) {
      Atomics.store(this._control, IDX_SLOT_COUNT, config.slotCount);
      Atomics.store(this._control, IDX_SLOT_SIZE, config.slotSizeBytes);
      Atomics.store(this._control, IDX_WRITE_SEQ, 0);
      Atomics.store(this._control, IDX_DROPPED, 0);
    }
  }

  write(payload: Uint8Array): SharedPayloadRef | null {
    const slotSize = this._config.slotSizeBytes;
    if (payload.byteLength > slotSize) {
      Atomics.add(this._control, IDX_DROPPED, 1);
      return null;
    }

    const seq = Atomics.load(this._control, IDX_WRITE_SEQ);
    const slot = seq % this._config.slotCount;
    const offset = slot * slotSize;
    this._data.set(payload, offset);
    Atomics.store(this._control, IDX_WRITE_SEQ, seq + 1);
    Atomics.notify(this._control, IDX_WRITE_SEQ);

    return {
      __xenseSharedPayloadRef: true,
      seq,
      slot,
      length: payload.byteLength,
    };
  }

  isRefLive(ref: SharedPayloadRef): boolean {
    if (ref.slot !== ref.seq % this._config.slotCount) {
      return false;
    }
    const currentWriteSeq = Atomics.load(this._control, IDX_WRITE_SEQ);
    return currentWriteSeq > ref.seq && currentWriteSeq - ref.seq <= this._config.slotCount;
  }

  view(ref: SharedPayloadRef): Uint8Array<SharedArrayBuffer> | null {
    if (!this.isRefLive(ref)) {
      return null;
    }
    const slotSize = this._config.slotSizeBytes;
    const offset = ref.slot * slotSize;
    return new Uint8Array(this._config.data, offset, ref.length);
  }

  read(ref: SharedPayloadRef): Uint8Array | null {
    if (!this.isRefLive(ref)) {
      return null;
    }
    const slotSize = this._config.slotSizeBytes;
    const offset = ref.slot * slotSize;
    // Return a stable copy instead of a live view into the shared ring. Callers
    // cache message payloads in `messageBus`, so a view would be overwritten the
    // next time another topic reuses the same slot and panels would render the
    // wrong image bytes.
    const out = new Uint8Array(ref.length);
    out.set(new Uint8Array(this._config.data, offset, ref.length));
    return out;
  }

  droppedPayloads(): number {
    return Atomics.load(this._control, IDX_DROPPED);
  }
}

export function createSharedPayloadRingConfig(totalBytes: number, slotSizeBytes: number): SharedPayloadRingConfig {
  const slotCount = Math.max(8, Math.floor(totalBytes / slotSizeBytes));
  return {
    control: new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * CONTROL_INTS),
    data: new SharedArrayBuffer(slotCount * slotSizeBytes),
    slotCount,
    slotSizeBytes,
  };
}

