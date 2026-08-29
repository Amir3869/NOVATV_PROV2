/**
 * Réglages d'apparence des sous-titres rendus par l'application.
 *
 * ─── Pourquoi ce module ─────────────────────────────────────────────
 *
 * Par défaut, hls.js rend les sous-titres avec le moteur natif du
 * navigateur (`renderTextTracksNatively: true`). Le navigateur les
 * affiche à sa façon, sur laquelle on n'a aucune prise : la taille est
 * fixe, la police est la sienne, aucun fond, aucune position réglable.
 *
 * Pour offrir les réglages demandés — taille, position, fond, police —
 * l'application peint elle-même les répliques dans un calque au-dessus
 * de la vidéo. hls.js est alors réglé sur `renderTextTracksNatively:
 * false` et émet les répliques via `CUES_PARSED` ; voir `subtitleCues.ts`
 * pour la collecte et `SubtitleOverlay` pour le rendu.
 *
 * Ce module ne fait que décrire les réglages : leurs types, leurs
 * valeurs par défaut, les gardes de migration, et la traduction d'une
 * valeur en style CSS. Même découpage que `videoFit.ts`.
 *
 * ─── Trois styles de police, pas plus ───────────────────────────────
 *
 * L'utilisateur a demandé deux à trois styles maximum. On en fournit
 * exactement trois, qui se distinguent nettement à l'œil : un sans-serif
 * lisible (Verdana), un serif éditorial (Georgia) et une police à chasse
 * fixe (Courier). Trois catégories bien distinctes, sans fausse
 * promesse de personnalisation infinie.
 */

/** Taille du texte des sous-titres. */
export type SubtitleSize = 'small' | 'medium' | 'large';

/** Position verticale du bloc de sous-titres dans l'image. */
export type SubtitlePosition = 'bottom' | 'middle' | 'top';

/** Fond posé derrière le texte, pour la lisibilité sur image claire. */
export type SubtitleBackground = 'none' | 'translucent' | 'opaque';

/** Famille de police. Trois styles seulement, par choix. */
export type SubtitleFont = 'sans' | 'serif' | 'mono';

/** Ordre d'affichage dans le panneau. */
export const SUBTITLE_SIZES: readonly SubtitleSize[] = ['small', 'medium', 'large'];
export const SUBTITLE_POSITIONS: readonly SubtitlePosition[] = ['bottom', 'middle', 'top'];
export const SUBTITLE_BACKGROUNDS: readonly SubtitleBackground[] = ['none', 'translucent', 'opaque'];
export const SUBTITLE_FONTS: readonly SubtitleFont[] = ['sans', 'serif', 'mono'];

/** Valeurs appliquées tant que l'utilisateur n'a rien choisi. */
export const DEFAULT_SUBTITLE_SIZE: SubtitleSize = 'medium';
export const DEFAULT_SUBTITLE_POSITION: SubtitlePosition = 'bottom';
export const DEFAULT_SUBTITLE_BACKGROUND: SubtitleBackground = 'translucent';
export const DEFAULT_SUBTITLE_FONT: SubtitleFont = 'sans';

/** Gardes de type, pour la migration des préférences enregistrées. */
export function isSubtitleSize(value: unknown): value is SubtitleSize {
  return typeof value === 'string' && (SUBTITLE_SIZES as readonly string[]).includes(value);
}
export function isSubtitlePosition(value: unknown): value is SubtitlePosition {
  return typeof value === 'string' && (SUBTITLE_POSITIONS as readonly string[]).includes(value);
}
export function isSubtitleBackground(value: unknown): value is SubtitleBackground {
  return typeof value === 'string' && (SUBTITLE_BACKGROUNDS as readonly string[]).includes(value);
}
export function isSubtitleFont(value: unknown): value is SubtitleFont {
  return typeof value === 'string' && (SUBTITLE_FONTS as readonly string[]).includes(value);
}

/** Pile CSS complète d'une famille de police. */
export function subtitleFontStack(font: SubtitleFont): string {
  switch (font) {
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    case 'mono':
      return '"Courier New", Courier, monospace';
    case 'sans':
    default:
      return 'Verdana, -apple-system, "Segoe UI", Arial, sans-serif';
  }
}

/** Taille en pixels du corps de texte pour un choix de taille donné. */
export function subtitleFontSize(size: SubtitleSize): number {
  switch (size) {
    case 'small':
      return 18;
    case 'large':
      return 32;
    case 'medium':
    default:
      return 24;
  }
}

/** Couleur et transparence du fond, selon le réglage. */
export function subtitleBackgroundCss(background: SubtitleBackground): string {
  switch (background) {
    case 'opaque':
      return 'rgba(0, 0, 0, 0.92)';
    case 'translucent':
      return 'rgba(0, 0, 0, 0.55)';
    case 'none':
    default:
      return 'transparent';
  }
}

/**
 * Décalage vertical du bloc depuis le bord, en pixels.
 *
 * `bottom` et `top` laissent la place nécessaire au bandeau de
 * commandes du lecteur : le sous-titre ne passe pas derrière les
 * contrôles. `middle` est exactement au centre de l'image.
 */
export function subtitlePositionCss(position: SubtitlePosition): {
  top: string;
  bottom: string;
} {
  switch (position) {
    case 'top':
      return { top: '72px', bottom: 'auto' };
    case 'middle':
      return { top: '50%', bottom: 'auto' };
    case 'bottom':
    default:
      return { top: 'auto', bottom: '12%' };
  }
}
