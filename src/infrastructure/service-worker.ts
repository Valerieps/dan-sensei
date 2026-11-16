/**
 * Registers the app's service worker (ADR-009) so the app opens without internet. Only in the
 * production build: the dev server serves no `sw.js` worth keeping and hot reload would fight it.
 * A failure is harmless (the app just needs the network, as before), so it is never shown.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
