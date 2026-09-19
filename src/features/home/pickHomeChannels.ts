/**
 * Choisit la rangée de chaînes de l'accueil.
 *
 * L'ordre exprime une intention utilisateur claire :
 *   1. sa liste personnelle ;
 *   2. ses favoris ;
 *   3. ses dernières chaînes regardées ;
 *   4. le catalogue disponible, en secours.
 *
 * Une source vide à un niveau ne bloque jamais le suivant : une liste
 * personnelle sans chaîne ne doit pas masquer les favoris, par exemple.
 */

export type HomeChannelSource = 'personal' | 'favorites' | 'recent' | 'catalog';

export function pickHomeChannels<T extends { id: string }>(
  catalog: readonly T[],
  listChannelIds: readonly string[],
  favoriteChannelIds: readonly string[],
  limit = 20,
  recentChannelIds: readonly string[] = [],
): { items: T[]; source: HomeChannelSource } {
  const byId = new Map<string, T>();
  for (const channel of catalog) {
    byId.set(channel.id, channel);
  }

  const pick = (ids: readonly string[]): T[] => {
    const seen = new Set<string>();
    const items: T[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const channel = byId.get(id);
      if (!channel) continue;
      seen.add(id);
      items.push(channel);
      if (items.length >= limit) break;
    }
    return items;
  };

  const personal = pick(listChannelIds);
  if (personal.length > 0) {
    return { items: personal, source: 'personal' };
  }

  const favorites = pick(favoriteChannelIds);
  if (favorites.length > 0) {
    return { items: favorites, source: 'favorites' };
  }

  const recent = pick(recentChannelIds);
  if (recent.length > 0) {
    return { items: recent, source: 'recent' };
  }

  return { items: catalog.slice(0, limit) as T[], source: 'catalog' };
}
