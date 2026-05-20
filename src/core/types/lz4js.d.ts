declare module "lz4js" {
  export function decompressBound(src: Uint8Array): number;
  export function decompressBlock(
    src: Uint8Array,
    dst: Uint8Array,
    sIndex: number,
    sLength: number,
    dIndex: number,
  ): number;
  export function decompress(src: Uint8Array, maxSize?: number): Uint8Array;
  export function decompressFrame(src: Uint8Array, dst: Uint8Array): number;
  export function makeBuffer(size: number): Uint8Array;
}
