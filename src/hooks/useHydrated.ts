'use client';

import { useSyncExternalStore } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Indique si les données enregistrées ont fini d'être relues.
 *
 * ── Le problème ──
 * Le store est sauvegardé dans le navigateur (`localStorage`) par le
 * middleware `persist`. Or la page est d'abord fabriquée côté serveur,
 * là où `localStorage` n'existe pas : le premier rendu part donc
 * toujours d'un store **vide**. React affiche ce rendu vide, puis
 * relit les données et refait un rendu avec les vraies valeurs.
 *
 * Concrètement, quelqu'un qui a déjà configuré une source voyait
 * s'afficher « Aucune source configurée » pendant une fraction de
 * seconde à chaque chargement de page, avant que son catalogue
 * apparaisse. L'écran vide était donc un mensonge : les données
 * existaient, elles n'étaient simplement pas encore lues.
 *
 * ── La solution ──
 * `persist` expose deux outils : `hasHydrated()` qui dit où on en est,
 * et `onFinishHydration()` qui prévient quand c'est terminé. On les
 * branche sur `useSyncExternalStore`, le mécanisme officiel de React
 * pour lire une donnée qui vit en dehors de React sans provoquer
 * d'incohérence entre le rendu serveur et le rendu navigateur.
 *
 * Les trois arguments de `useSyncExternalStore` :
 *   1. s'abonner aux changements (et rendre la fonction de désabonnement) ;
 *   2. lire la valeur côté navigateur ;
 *   3. lire la valeur côté serveur — ici toujours `false`, puisque
 *      rien n'y est jamais relu.
 *
 * ── Usage ──
 * ```tsx
 * const hydrated = useHydrated();
 * if (!hydrated) return <SectionSkeleton />;  // on ne sait pas encore
 * if (playlists.length === 0) return <EmptyState … />;  // on sait : c'est vide
 * ```
 *
 * La règle : ne jamais annoncer « c'est vide » tant que `hydrated`
 * vaut `false`. On ne sait pas encore, donc on montre un chargement.
 */

function subscribe(onChange: () => void): () => void {
  return useAppStore.persist.onFinishHydration(onChange);
}

function getSnapshot(): boolean {
  return useAppStore.persist.hasHydrated();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
