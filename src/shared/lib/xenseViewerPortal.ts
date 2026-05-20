/** Portal target for Radix overlays when embedded under `#xense-mcap-viewer-root`. */
export function getXenseViewerPortalRoot(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.getElementById('xense-mcap-viewer-root') ?? undefined;
}
