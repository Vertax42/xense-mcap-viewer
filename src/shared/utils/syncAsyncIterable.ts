/**
 * Wraps a synchronous `Generator` as an `AsyncIterableIterator` using
 * `Promise.resolve` on each `next`, without `async function*` (so callers avoid
 * `@typescript-eslint/require-await` on purely synchronous iteration).
 */
export function syncGeneratorToAsyncIterable<T>(create: () => Generator<T>): AsyncIterableIterator<T> {
  const iterator = create();
  const out: AsyncIterableIterator<T> = {
    next: () => Promise.resolve(iterator.next()),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return out;
}
