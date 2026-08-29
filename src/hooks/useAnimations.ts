'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { UserPreferences } from '@/types';

/**
 * Préférence brute enregistrée pour les animations.
 *
 * Comme pour l'effet de verre, trois états et non deux :
 *   `true`  — l'utilisateur veut les animations ;
 *   `false` — il n'en veut pas ;
 *   `null`  — il n'a jamais touché l'interrupteur.
 *
 * Le troisième état est indispensable ici pour une raison précise : sans
 * lui, impossible d'obéir au réglage système « réduire les animations »
 * sans écraser un choix contraire fait dans l'application.
 */
export type AnimationsPreference = UserPreferences['animationsEnabled'];

/** Requête média du réglage d'accessibilité système. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Tranche entre le choix de l'utilisateur, le réglage système et l'appareil.
 *
 * Fonction pure, donc testable sans navigateur.
 *
 * Ordre de priorité, du plus fort au plus faible :
 *   1. un choix explicite dans Nova TV l'emporte sur tout, y compris sur
 *      le réglage système — la personne est devant l'écran, elle sait ce
 *      qu'elle veut ;
 *   2. sinon, `prefers-reduced-motion` du système est respecté en
 *      silence : elle a déjà répondu à la question ailleurs, une
 *      application bien élevée ne la repose pas ;
 *   3. sinon, on coupe sur téléviseur, où les 54 `transition-all` de
 *      l'interface pèsent sur des puces d'entrée de gamme et font
 *      traîner le curseur de focus derrière la télécommande ;
 *   4. sinon, animations actives.
 */
export function resolveAnimations(
  preference: AnimationsPreference,
  isTV: boolean,
  prefersReducedMotion: boolean
): boolean {
  if (preference === true) return true;
  if (preference === false) return false;
  if (prefersReducedMotion) return false;
  return !isTV;
}

/**
 * S'abonne aux changements du réglage système « réduire les animations ».
 *
 * Définie hors du hook : `useSyncExternalStore` compare cette fonction
 * d'un rendu à l'autre pour savoir s'il doit se réabonner. Recréée à
 * chaque rendu, elle provoquerait un désabonnement/réabonnement continuel.
 */
function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Lit l'état courant du réglage système. */
function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Pose l'état des animations sur l'élément `<html>`.
 *
 * Trois valeurs possibles pour l'attribut `data-motion`, et la troisième
 * n'est pas un détail :
 *
 *   `"off"`  — animations coupées ;
 *   `"on"`   — animations explicitement demandées ;
 *   absent   — aucune décision prise (le script n'a pas encore tourné).
 *
 * Pourquoi distinguer `"on"` de l'absence d'attribut : `globals.css`
 * contient une règle `@media (prefers-reduced-motion: reduce)` qui coupe
 * les animations sans passer par JavaScript. Elle est utile avant que
 * React ne démarre, mais elle ignore le réglage de l'application. Sans
 * marqueur `"on"`, une personne ayant activé « réduire les animations »
 * dans Windows puis rallumé les animations dans Nova TV n'obtiendrait
 * rien : la règle CSS continuerait de tout figer. Le sélecteur
 * `html:not([data-motion='on'])` lui rend la main.
 */
export function applyAnimations(enabled: boolean): void {
  document.documentElement.setAttribute('data-motion', enabled ? 'on' : 'off');
}

/**
 * Applique la préférence d'animations et la maintient à jour.
 *
 * À monter une seule fois, dans `ClientLayout`.
 *
 * Le hook surveille trois sources : le réglage de l'utilisateur, le
 * réglage système (qui peut changer pendant que l'application tourne —
 * d'où l'écouteur, et non une simple lecture), et le type d'appareil.
 *
 * @param isTV     L'appareil est un téléviseur ou un boîtier TV.
 * @param isReady  La détection d'appareil a réellement eu lieu. Tant
 *                 qu'elle vaut `false`, `isTV` est une valeur d'attente.
 */
export function useAnimations(isTV: boolean, isReady: boolean): void {
  const preference = useAppStore((s) => s.preferences.animationsEnabled);

  // L'état système est suivi et non lu une fois pour toutes : basculer
  // « réduire les animations » dans le système doit se voir aussitôt,
  // sans redémarrer l'application.
  //
  // `useSyncExternalStore` est l'outil prévu pour cela : il relie React à
  // une source de vérité extérieure. On pourrait croire qu'un `useState`
  // rempli dans un `useEffect` suffirait, mais écrire un état depuis un
  // effet provoque un second rendu à chaque montage — et le compilateur
  // React le refuse (`react-hooks/set-state-in-effect`).
  //
  // Les trois arguments : comment s'abonner aux changements, comment lire
  // la valeur courante côté navigateur, et quoi répondre côté serveur —
  // où `window` n'existe pas. Le serveur répond `false`, valeur neutre
  // corrigée dès l'affichage par le script anti-clignotement.
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  useEffect(() => {
    // Un choix explicite ne dépend ni de l'appareil ni du système : il
    // peut être appliqué sans attendre la détection.
    if (preference === null && !isReady) return;

    applyAnimations(resolveAnimations(preference, isTV, prefersReducedMotion));
  }, [preference, isTV, isReady, prefersReducedMotion]);
}
