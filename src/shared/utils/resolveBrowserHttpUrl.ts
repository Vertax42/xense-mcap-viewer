/**
 * Turn root-relative paths into absolute URLs for fetch() (main thread or worker).
 */
export function resolveBrowserHttpUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${url}`;
  }
  return url;
}
