import { describe, it, expect } from 'vitest';
import { normalizeDtype, dtypeFromMetadata } from './Hdf5IterableSource';

describe('dtypeFromMetadata — HDF5 metadata mapping', () => {
  it('maps float/integer classes via (type, size, signed)', () => {
    // H5T_FLOAT (class 1)
    expect(dtypeFromMetadata({ type: 1, size: 4 })).toBe('float32');
    expect(dtypeFromMetadata({ type: 1, size: 8 })).toBe('float64');
    // H5T_INTEGER (class 0)
    expect(dtypeFromMetadata({ type: 0, size: 1, signed: false })).toBe('uint8');
    expect(dtypeFromMetadata({ type: 0, size: 1, signed: true })).toBe('int8');
    expect(dtypeFromMetadata({ type: 0, size: 2, signed: false })).toBe('uint16');
    expect(dtypeFromMetadata({ type: 0, size: 4, signed: true })).toBe('int32');
    expect(dtypeFromMetadata({ type: 0, size: 8, signed: false })).toBe('uint64');
  });

  it('returns unknown for unsupported classes or sizes', () => {
    expect(dtypeFromMetadata(undefined)).toBe('unknown');
    expect(dtypeFromMetadata({ type: 3, size: 10 })).toBe('unknown'); // string
    expect(dtypeFromMetadata({ type: 6, size: 16 })).toBe('unknown'); // compound
    expect(dtypeFromMetadata({ type: 1, size: 2 })).toBe('unknown'); // float16 not supported
  });
});

describe('normalizeDtype — fallback string parser', () => {
  it('maps NumPy-style dtype codes to canonical strings', () => {
    expect(normalizeDtype('<f4')).toBe('float32');
    expect(normalizeDtype('>f4')).toBe('float32');
    expect(normalizeDtype('=f4')).toBe('float32');
    expect(normalizeDtype('|f4')).toBe('float32');
    expect(normalizeDtype('<f8')).toBe('float64');
    expect(normalizeDtype('<i1')).toBe('int8');
    expect(normalizeDtype('|u1')).toBe('uint8');
    expect(normalizeDtype('<i2')).toBe('int16');
    expect(normalizeDtype('<u4')).toBe('uint32');
  });

  it('passes through already-canonical forms', () => {
    expect(normalizeDtype('float32')).toBe('float32');
    expect(normalizeDtype('uint8')).toBe('uint8');
  });

  it('returns unknown for unsupported dtypes', () => {
    expect(normalizeDtype('S10')).toBe('unknown');
    expect(normalizeDtype('O')).toBe('unknown');
    expect(normalizeDtype(null)).toBe('unknown');
    expect(normalizeDtype({})).toBe('unknown');
    expect(normalizeDtype('<f3')).toBe('unknown');
  });
});
