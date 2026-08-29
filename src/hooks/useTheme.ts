'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { UserPreferences } from '@/types';

export type Theme = UserPreferences['theme'];
/** Thème réellement affiché, une fois `system` résolu. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Traduit la préférence en thème effectivement appliqué.
 *
 * Fonction pure, donc directement testable : `system` doit suivre le
 * réglage du système d'exploitation, les deux autres valeurs s'imposent.
 */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

/**
 * Pose la classe du thème sur l'élément `<html>`.
 *
 * Tout le thème clair repose sur cette classe : `globals.css` redéfinit
 * sous `html.light` la variable `--color-white` et les jetons de surface,
 * ce qui bascule d'un coup les quelque 660 couleurs de l'interface.
 * Sans cette classe, rien ne change.
 *
 * `colorScheme` est également renseigné pour que le navigateur adapte ce
 * qu'il dessine lui-même : barres de défilement, listes déroulantes,
 * champs de formulaire.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;
}

/**
 * Applique le thème choisi et suit le système quand la préférence vaut
 * `system` : basculer son téléphone en mode sombre le soir doit changer
 * l'application immédiatement, sans la rouvrir.
 */
export function useTheme(): void {
  const theme = useAppStore((s) => s.preferences.theme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const update = () => applyTheme(resolveTheme(theme, query.matches));
    update();

    // Inutile d'écouter le système si l'utilisateur a imposé un thème.
    if (theme !== 'system') return;

    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [theme]);
}
