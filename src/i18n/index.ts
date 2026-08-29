'use client';

/**
 * Moteur de traduction — point d'entrée unique du multilingue.
 *
 * Usage dans un composant :
 *
 *   const { t } = useTranslation();
 *   return <h1>{t('movies.title')}</h1>;
 *
 * Avec une valeur à insérer :
 *
 *   t('liveTV.channelCount', { count: channels.length })
 *   → « 128 chaînes disponibles »
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { fr, type Messages } from './messages/fr';
import { en } from './messages/en';
import { es } from './messages/es';
import { ar } from './messages/ar';
import { DEFAULT_LOCALE, isLocale, isRTL, type Locale } from './types';

export { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE, isRTL, isLocale, detectLocale } from './types';
export type { Locale } from './types';
export type { Messages } from './messages/fr';

/**
 * Toutes les traductions, chargées d'un bloc.
 *
 * On pourrait les charger à la demande (`import()` dynamique) pour
 * alléger le premier téléchargement. Ce n'est pas fait ici : les quatre
 * fichiers pèsent environ 20 Ko au total, et un chargement différé
 * ferait clignoter l'interface en anglais avant d'afficher la bonne
 * langue. À revoir seulement si le nombre de langues explose.
 */
const MESSAGES: Record<Locale, Messages> = { fr, en, es, ar };

/**
 * Chemin d'une chaîne traduisible, du type `'movies.title'`.
 *
 * Ce type est calculé à partir du fichier français : TypeScript refuse
 * `t('movies.titre')` ou `t('movie.title')` à la compilation, et
 * l'autocomplétion de VS Code propose les clés existantes. C'est tout
 * l'intérêt de ne pas passer par une bibliothèque générique, qui
 * accepterait n'importe quelle chaîne.
 */
export type MessageKey = {
  [S in keyof Messages]: `${S & string}.${keyof Messages[S] & string}`;
}[keyof Messages];

/** Valeurs injectables dans un texte à trous. */
export type MessageValues = Record<string, string | number>;

/**
 * Remplace les `{marqueurs}` par leur valeur.
 *
 * Exemple : formatMessage('{count} chaînes', { count: 128 })
 *           → '128 chaînes'
 *
 * Un marqueur sans valeur correspondante est laissé tel quel plutôt que
 * remplacé par du vide : à l'écran, « {count} chaînes » signale
 * immédiatement l'oubli, alors qu'un blanc passerait inaperçu.
 */
export function formatMessage(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * Lit une clé `'section.cle'` dans un dictionnaire.
 *
 * Retombe sur le français si la clé manque dans la langue active — cas
 * possible si une traduction est ajoutée pendant qu'un utilisateur a
 * d'anciens fichiers en cache. En dernier recours, renvoie la clé
 * elle-même : mieux vaut afficher « movies.title » qu'une zone vide,
 * car le défaut devient visible et localisable.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  values?: MessageValues,
): string {
  const [section, name] = key.split('.') as [keyof Messages, string];
  const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const template =
    (dict[section] as Record<string, string> | undefined)?.[name] ??
    (MESSAGES[DEFAULT_LOCALE][section] as Record<string, string> | undefined)?.[name];

  if (template === undefined) return key;
  return formatMessage(template, values);
}

/**
 * Applique la langue à la balise <html>.
 *
 * Deux attributs, deux rôles distincts :
 * - `lang` renseigne les lecteurs d'écran (prononciation) et les
 *   moteurs de recherche ;
 * - `dir` retourne la mise en page pour l'arabe.
 *
 * Appelée depuis le hook ci-dessous, et aussi par le script d'amorçage
 * dans le <head> pour éviter que la page s'affiche à l'endroit pendant
 * une fraction de seconde avant de basculer.
 */
export function applyLocaleToDocument(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = locale;
  html.dir = isRTL(locale) ? 'rtl' : 'ltr';
}

/**
 * Langue actuellement active, lue dans les préférences.
 *
 * On ne peut pas se contenter de lire le store directement au premier
 * rendu : les préférences sont restaurées depuis le stockage du
 * navigateur de façon asynchrone (voir `useHydrated`). Avant cette
 * restauration, la valeur enregistrée est inconnue et le rendu serveur
 * doit produire le français, sinon React signale une incohérence
 * d'hydratation.
 */
export function useLocale(): Locale {
  const language = useAppStore((s) => s.preferences.language);
  return isLocale(language) ? language : DEFAULT_LOCALE;
}

/** Indique si l'interface doit être retournée (arabe). */
export function useIsRTL(): boolean {
  return isRTL(useLocale());
}

/**
 * Hook principal.
 *
 * Renvoie `t`, la fonction de traduction, et `locale`, la langue
 * active. `t` est mémorisée avec `useCallback` : sans cela, elle
 * changerait d'identité à chaque rendu et ferait retravailler tous les
 * composants enfants mémorisés qui la reçoivent en propriété.
 */
export function useTranslation(): {
  t: (key: MessageKey, values?: MessageValues) => string;
  locale: Locale;
  isRTL: boolean;
} {
  const locale = useLocale();

  const t = useCallback(
    (key: MessageKey, values?: MessageValues) => translate(locale, key, values),
    [locale],
  );

  return useMemo(() => ({ t, locale, isRTL: isRTL(locale) }), [t, locale]);
}

/**
 * Synchronise <html lang/dir> avec la préférence enregistrée.
 *
 * Monté une seule fois, dans `ClientLayout`, à côté de `useTheme` qui
 * fait exactement le même travail pour le thème clair/sombre.
 *
 * `useEffect` ne s'exécute que dans le navigateur, jamais pendant le
 * rendu serveur : c'est voulu, `document` n'existe pas côté serveur.
 * L'attribut est réécrit à chaque changement de langue.
 */
export function useLocaleDocument(): Locale {
  const locale = useLocale();

  useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  return locale;
}

/**
 * Change la langue de l'interface.
 *
 * Passe par `updatePreferences` du store, donc le choix est enregistré
 * comme les autres réglages et survit à la fermeture de l'application.
 */
export function useSetLocale(): (locale: Locale) => void {
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  return useCallback(
    (locale: Locale) => updatePreferences({ language: locale }),
    [updatePreferences],
  );
}
