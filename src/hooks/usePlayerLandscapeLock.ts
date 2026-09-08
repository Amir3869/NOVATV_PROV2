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
 * Verrouillage paysage du lecteur, ou déverrouillage si `enabled` est faux.
 *
 * Le lecteur s'ouvre désormais dans n'importe quel sens : on appelle
 * ce hook avec `false` pour lever un verrou laissé par une version
 * précédente. Accueil, Live et Paramètres restent libres.
 */
export function usePlayerLandscapeLock(enabled: boolean): void {
  useEffect(() => {
    if (typeof screen === 'undefined' || !screen.orientation) return;

    const orientation = screen.orientation;
    if (!enabled) {
      try {
        orientation.unlock();
      } catch {
        /* Déjà déverrouillé, ou API absente. */
      }
      return;
    }
    if (isLockable(orientation)) {
      void orientation.lock('landscape').catch(() => {
        /* Refus du navigateur : lecture libre dans le sens du téléphone. */
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
