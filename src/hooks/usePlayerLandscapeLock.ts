'use client';

import { useEffect } from 'react';

/**
 * `ScreenOrientation.lock` existe dans Chrome / Android / Capacitor,
 * mais TypeScript l'a retiré de `lib.dom` (Firefox ne le propose plus,
 * le type est tombé sous le seuil des deux navigateurs). On le décrit
 * ici, localement, plutôt que de mentir au compilateur global.
 */
type LockableOrientation = ScreenOrientation & {
  lock: (orientation: 'landscape' | 'portrait') => Promise<void>;
};

function isLockable(orientation: ScreenOrientation): orientation is LockableOrientation {
  return typeof (orientation as LockableOrientation).lock === 'function';
}

/**
 * Demande au système de verrouiller le lecteur en paysage.
 *
 * Sur l'APK Android / une WebView Capacitor, l'appel est généralement
 * honoré. Dans Safari iOS (et la plupart des navigateurs desktop), il
 * est refusé hors plein écran : l'échec est silencieux, et l'écran
 * « Tournez l'appareil » du lecteur prend le relais.
 *
 * `unlock` au démontage rend le reste de l'application à l'orientation
 * libre — Accueil, Live, Paramètres restent utilisables en portrait.
 */
export function usePlayerLandscapeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof screen === 'undefined' || !screen.orientation) return;

    const orientation = screen.orientation;
    if (isLockable(orientation)) {
      void orientation.lock('landscape').catch(() => {
        /* Refus du navigateur : l'overlay portrait s'en charge. */
      });
    }

    return () => {
      try {
        orientation.unlock();
      } catch {
        /* Déjà déverrouillé, ou API absente. */
      }
    };
  }, [enabled]);
}
