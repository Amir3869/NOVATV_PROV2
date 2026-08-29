'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { UserPreferences } from '@/types';

/**
 * Préférence brute telle qu'elle est enregistrée.
 *
 * `null` n'est pas un oubli : il signifie « l'utilisateur n'a jamais
 * touché cet interrupteur ». C'est ce troisième état qui permet
 * d'appliquer un comportement d'usine différent selon l'appareil —
 * verre actif sur téléphone, inactif sur téléviseur — tout en
 * respectant un choix explicite dès qu'il existe.
 *
 * Avec un simple booléen, impossible de distinguer « l'utilisateur veut
 * le verre » d'un « valeur par défaut à true » : on ne saurait jamais
 * si on a le droit de décider à sa place.
 */
export type GlassPreference = UserPreferences['glassEnabled'];

/**
 * Tranche entre la préférence enregistrée et le type d'appareil.
 *
 * Fonction pure — aucun accès au navigateur, aucun état — donc
 * directement testable, comme `resolveTheme` pour le thème.
 *
 * Règle :
 *   - un choix explicite (true / false) l'emporte toujours ;
 *   - sans choix, on suit l'appareil : pas de verre sur un téléviseur.
 *
 * Pourquoi couper sur téléviseur par défaut : `backdrop-filter` demande
 * au processeur graphique de recalculer le flou de tout ce qui se trouve
 * derrière un panneau, à chaque image affichée. Un Fire TV Stick a une
 * puce d'entrée de gamme ; sur une grille de chaînes qui défile, le coût
 * se voit immédiatement sous forme de saccades. Mieux vaut une première
 * ouverture fluide qu'une première ouverture jolie mais hachée.
 */
export function resolveGlass(preference: GlassPreference, isTV: boolean): boolean {
  if (preference === true) return true;
  if (preference === false) return false;
  return !isTV;
}

/**
 * Pose l'état du verre sur l'élément `<html>`.
 *
 * Même mécanisme que `applyTheme` : plutôt que de rendre conditionnelles
 * les 42 classes `backdrop-blur` disséminées dans 20 fichiers, on écrit
 * un seul attribut sur la racine du document et `globals.css` neutralise
 * l'ensemble d'un coup.
 *
 * L'avantage décisif est la durabilité : tout composant écrit plus tard
 * avec `backdrop-blur` sera couvert automatiquement, sans que personne
 * ait à y penser. Une approche fichier par fichier se serait dégradée
 * dès le premier écran ajouté.
 *
 * L'attribut n'est posé que dans le cas « désactivé ». Ne rien écrire
 * dans le cas normal évite de laisser une trace inutile dans le HTML.
 */
export function applyGlass(enabled: boolean): void {
  const root = document.documentElement;

  if (enabled) {
    root.removeAttribute('data-glass');
  } else {
    root.setAttribute('data-glass', 'off');
  }
}

/**
 * Applique la préférence d'effet de verre et la maintient à jour.
 *
 * À monter une seule fois, dans `ClientLayout`, exactement comme
 * `useTheme`. Le hook réagit à deux sources : le réglage de
 * l'utilisateur, et la détection d'appareil qui n'est fiable qu'après
 * le premier rendu côté navigateur.
 *
 * @param isTV      L'appareil est un téléviseur ou un boîtier TV.
 * @param isReady   La détection a réellement eu lieu. Tant qu'elle vaut
 *                  `false`, `isTV` est une valeur d'attente et non un
 *                  constat : agir dessus ferait clignoter le verre sur
 *                  les téléviseurs, allumé puis éteint.
 */
export function useGlass(isTV: boolean, isReady: boolean): void {
  const preference = useAppStore((s) => s.preferences.glassEnabled);

  useEffect(() => {
    // Un choix explicite ne dépend pas de l'appareil : on peut
    // l'appliquer tout de suite, sans attendre la détection.
    if (preference === null && !isReady) return;

    applyGlass(resolveGlass(preference, isTV));
  }, [preference, isTV, isReady]);
}
