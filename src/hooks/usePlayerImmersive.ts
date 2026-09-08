'use client';

import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Cache les barres système Android (| □ <) pendant le lecteur.
 *
 * Sans cela, la barre de navigation native reste collée sur la vidéo.
 * Un glissement depuis le bord les fait réapparaître un instant
 * (comportement immersif Android). Hors Capacitor : no-op.
 */

interface PlayerImmersivePlugin {
  setImmersive(options: { value: boolean }): Promise<void>;
}

const PlayerImmersive = registerPlugin<PlayerImmersivePlugin>('PlayerImmersive');

export function usePlayerImmersive(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (!Capacitor.isNativePlatform()) return;

    void PlayerImmersive.setImmersive({ value: true }).catch(() => {
      /* Plugin absent (web, ou APK pas encore resync). */
    });

    return () => {
      void PlayerImmersive.setImmersive({ value: false }).catch(() => {});
    };
  }, [enabled]);
}
