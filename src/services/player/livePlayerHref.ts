/**
 * Lien d'ouverture du lecteur Live, avec le contexte de zapping.
 *
 * `trailingSlash: true` : `/player/` (pas `/player`), sinon Next peut
 * rediriger et, selon les cas, mal garder la query.
 *
 * `encodeURIComponent` plutôt que `URLSearchParams` : ce dernier
 * encode aussi en `+` / formes que `useSearchParams` ne décode pas
 * toujours pareil. Les ids Xtream sont du `source:live:123`.
 *
 * Un seul contexte à la fois : liste > favoris > catégorie.
 */
export function livePlayerHref(
  channelId: string,
  context?: {
    listId?: string | null;
    from?: string | null;
    catId?: string | null;
  },
): string {
  const parts = [`type=live`, `id=${encodeURIComponent(channelId)}`];
  if (context?.listId) {
    parts.push(`listId=${encodeURIComponent(context.listId)}`);
  } else if (context?.from === 'favorites') {
    parts.push('from=favorites');
  } else if (context?.catId) {
    parts.push(`catId=${encodeURIComponent(context.catId)}`);
  }
  return `/player/?${parts.join('&')}`;
}

/** Id lu dans l'URL, éventuellement encore percent-encodé. */
export function decodePlayerMediaId(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.includes('%')) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
