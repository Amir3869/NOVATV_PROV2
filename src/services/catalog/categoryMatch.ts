/**
 * Appariement d'une chaîne à une catégorie Live.
 *
 * ── Le piège Xtream ──────────────────────────────────────────────
 * Les catégories sont enregistrées sous un id scopé
 * (`playlistId:livecat:12`) pour que deux sources ne se marchent pas
 * dessus. Les chaînes, elles, ont longtemps gardé l'id brut du portail
 * (`12`). Le filtre `ch.categoryId === cat.id` ne matchait alors
 * jamais : toutes les chaînes dans « Toutes », zéro dans chaque
 * rubrique.
 *
 * Les listes M3U sont déjà alignées (`playlistId:m3ucat:hash` des deux
 * côtés). On compare donc d'abord à l'identique, puis au jeton brut
 * pour les catalogues déjà synchronisés avant le correctif.
 */

/** Dernier segment utile : `12` dans `pl-1:livecat:12`, ou l'id tel quel. */
export function categoryToken(id: string): string {
  const parts = id.split(':');
  if (
    parts.length >= 3 &&
    (parts[1] === 'livecat' ||
      parts[1] === 'm3ucat' ||
      parts[1] === 'vodcat' ||
      parts[1] === 'seriescat')
  ) {
    return parts[parts.length - 1];
  }
  return id;
}

/** Vrai si la chaîne appartient à cette catégorie, ids bruts ou scopés. */
export function channelMatchesCategory(
  channelCategoryId: string | undefined,
  categoryId: string
): boolean {
  if (!channelCategoryId) return false;
  if (channelCategoryId === categoryId) return true;
  return categoryToken(channelCategoryId) === categoryToken(categoryId);
}
