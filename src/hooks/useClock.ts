'use client';

import { useEffect, useState } from 'react';

/**
 * Horloge qui avance, pour l'EPG « en cours ».
 *
 * Sans ça, `new Date()` figé au premier rendu laisse afficher un
 * programme de 11 h 30 alors qu'il est 18 h. L'intervalle est large :
 * une émission dure des dizaines de minutes, recalculer chaque seconde
 * redessinerait toute la grille pour rien.
 */
export function useClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
