import { simplify, substract, unify } from "intervals-fn";
import { isRangeCoveredByRanges } from "./ranges";
import type { Range } from "./ranges";

const kMaxLength = Math.pow(2, 32);

export default class VirtualLRUBuffer {
  public readonly byteLength: number;
  #blocks: (Uint8Array | undefined)[] = [];
  #blockSize: number = Math.trunc(kMaxLength / 2);
  #numberOfBlocks: number = Infinity;
  #lastAccessedBlockIndices: number[] = [];
  #rangesWithData: Range[] = [];

  public constructor(options: { size: number; blockSize?: number; numberOfBlocks?: number }) {
    this.byteLength = options.size;
    this.#blockSize = options.blockSize ?? this.#blockSize;
    this.#numberOfBlocks = options.numberOfBlocks ?? this.#numberOfBlocks;
  }

  public hasData(start: number, end: number): boolean {
    return isRangeCoveredByRanges({ start, end }, this.#rangesWithData);
  }

  public getRangesWithData(): Range[] {
    return this.#rangesWithData;
  }

  public copyFrom(source: Uint8Array, targetStart: number): void {
    if (targetStart < 0 || targetStart >= this.byteLength) {
      throw new Error("VirtualLRUBuffer#copyFrom invalid input");
    }

    const range = { start: targetStart, end: targetStart + source.byteLength };

    let position = range.start;
    while (position < range.end) {
      const { blockIndex, positionInBlock, remainingBytesInBlock } =
        this.#calculatePosition(position);
      const targetBlock = this.#getBlock(blockIndex);
      const sourceOffset = position - targetStart;
      const count = Math.min(remainingBytesInBlock, range.end - position);
      targetBlock.set(source.subarray(sourceOffset, sourceOffset + count), positionInBlock);
      this.#rangesWithData = simplify(unify([{ start: position, end: position + count }], this.#rangesWithData));
      position += count;
    }
  }

  public slice(start: number, end: number): Uint8Array {
    const size = end - start;
    this.#validateReadableRange("slice", start, end, size);

    const startPositionData = this.#calculatePosition(start);
    if (size <= startPositionData.remainingBytesInBlock) {
      const { blockIndex, positionInBlock } = startPositionData;
      return this.#getBlock(blockIndex).slice(positionInBlock, positionInBlock + size);
    }

    const result = new Uint8Array(size);
    let position = start;
    while (position < end) {
      const { blockIndex, positionInBlock, remainingBytesInBlock } =
        this.#calculatePosition(position);
      const sourceBlock = this.#getBlock(blockIndex);
      const targetOffset = position - start;
      const count = Math.min(remainingBytesInBlock, end - position);
      result.set(sourceBlock.subarray(positionInBlock, positionInBlock + count), targetOffset);
      position += count;
    }
    return result;
  }

  public viewOrSlice(start: number, end: number): Uint8Array {
    const size = end - start;
    this.#validateReadableRange("viewOrSlice", start, end, size);

    const startPositionData = this.#calculatePosition(start);
    if (size <= startPositionData.remainingBytesInBlock) {
      const { blockIndex, positionInBlock } = startPositionData;
      return this.#getBlock(blockIndex).subarray(positionInBlock, positionInBlock + size);
    }
    return this.slice(start, end);
  }

  #getBlock(index: number): Uint8Array {
    if (!this.#blocks[index]) {
      let size = this.#blockSize;
      if ((index + 1) * this.#blockSize > this.byteLength) {
        size = this.byteLength % this.#blockSize;
      }
      this.#blocks[index] = new Uint8Array(size);
    }
    
    this.#lastAccessedBlockIndices = [
      ...this.#lastAccessedBlockIndices.filter((idx) => idx !== index),
      index,
    ];
    if (this.#lastAccessedBlockIndices.length > this.#numberOfBlocks) {
      const deleteIndex = this.#lastAccessedBlockIndices.shift();
      if (deleteIndex !== undefined) {
        this.#blocks[deleteIndex] = undefined;
        this.#rangesWithData = simplify(
          substract(this.#rangesWithData, [
            { start: deleteIndex * this.#blockSize, end: (deleteIndex + 1) * this.#blockSize },
          ]),
        );
      }
    }
    const block = this.#blocks[index];
    if (!block) {
      throw new Error("invariant violation - no block at index");
    }
    return block;
  }

  #calculatePosition(position: number) {
    if (position < 0 || position >= this.byteLength) {
      throw new Error("VirtualLRUBuffer#_calculatePosition invalid input");
    }
    const blockIndex = Math.floor(position / this.#blockSize);
    const positionInBlock = position - blockIndex * this.#blockSize;
    const block = this.#getBlock(blockIndex);
    const remainingBytesInBlock = block.byteLength - positionInBlock;
    return { blockIndex, positionInBlock, remainingBytesInBlock };
  }

  #validateReadableRange(operation: string, start: number, end: number, size: number): void {
    if (start < 0 || end > this.byteLength || size <= 0 || size > kMaxLength) {
      throw new Error(`VirtualLRUBuffer#${operation} invalid input`);
    }
    if (!this.hasData(start, end)) {
      throw new Error(`VirtualLRUBuffer#${operation} range has no data set`);
    }
  }
}
