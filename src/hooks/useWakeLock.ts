'use client';

import { useEffect } from 'react';

/**
 * Empêche l'écran de s'éteindre pendant la lecture.
 *
 * L'API `screen.wakeLock` existe sur Chrome / Android / la WebView
 * Capacitor. Elle est absente de Safari iOS ancien : l'échec est
 * silencieux, le téléphone suivra alors son propre délai.
 *
 * On redemande le verrou au retour au premier plan : le système le
 * relâche dès que la page n'est plus visible.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        /* Économie d'énergie, permission refusée, onglet en fond. */
      }
    };

    void request();

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
