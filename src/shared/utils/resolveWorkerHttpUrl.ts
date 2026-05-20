/**
 * Resolve URL for fetch() inside a Web Worker.
 * Root-relative paths must use the document origin (`self.origin`), not the worker script URL.
 */
export function resolveWorkerHttpUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith("/") && typeof self !== "undefined" && self.origin) {
    return new URL(url, self.origin).href;
  }
  return url;
}
