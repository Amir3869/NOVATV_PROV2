/**
 * Socle du multilingue (i18n) — types et langues disponibles.
 *
 * « i18n » est l'abréviation usuelle de « internationalization » :
 * i, puis 18 lettres, puis n. Il s'agit de sortir les textes du code
 * pour pouvoir les traduire sans toucher aux composants.
 *
 * ── Pourquoi pas une bibliothèque ? ──
 * `next-intl`, `react-i18next` et consorts sont conçus pour des sites
 * qui changent de langue par l'URL (/fr/…, /en/…) et pour du rendu
 * serveur. Nova TV est une application locale, exportée en fichiers
 * statiques puis empaquetée en APK : pas de serveur, pas de segment de
 * langue dans l'URL, et la langue est un réglage utilisateur enregistré
 * comme les autres. Ces bibliothèques ajouteraient 40 à 60 Ko et une
 * couche de configuration pour un besoin que 60 lignes couvrent.
 */

/**
 * Langues proposées. `as const` fige le tableau : TypeScript en déduit
 * le type exact des codes plutôt qu'un simple `string[]`, ce qui permet
 * de détecter à la compilation une langue inexistante.
 */
export const LOCALES = ['fr', 'en', 'es', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/**
 * Noms affichés dans le sélecteur de langue, écrits dans leur propre
 * langue : quelqu'un qui cherche l'espagnol cherche « Español », pas
 * « Espagnol ».
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  ar: 'العربية',
};

/**
 * Langues écrites de droite à gauche.
 *
 * L'arabe s'écrit dans l'autre sens : il ne suffit pas de traduire les
 * mots, toute la mise en page se retourne (le menu passe à droite, les
 * flèches s'inversent). On pose `dir="rtl"` sur la balise <html> et le
 * navigateur s'occupe du reste, à condition que les styles utilisent
 * des propriétés logiques (`ms-4` plutôt que `ml-4` chez Tailwind).
 */
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

/**
 * Vérifie qu'une chaîne quelconque est bien une langue connue.
 *
 * Utile pour les valeurs venant de l'extérieur : réglages enregistrés
 * par une ancienne version, langue du navigateur, saisie manuelle.
 * Sans ce contrôle, une valeur inattendue afficherait des clés brutes
 * à la place des textes.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Déduit la langue à utiliser à partir de celle du navigateur.
 *
 * `navigator.language` renvoie par exemple « fr-BE » ou « en-US ». On
 * ne garde que la partie avant le tiret : le français de Belgique et
 * celui de France partagent la même traduction ici.
 */
export function detectLocale(navigatorLanguages: readonly string[]): Locale {
  for (const tag of navigatorLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
