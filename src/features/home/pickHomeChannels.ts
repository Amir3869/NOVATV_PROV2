/**
 * Rangée chaînes de l'accueil.
 *
 * Priorité : chaînes déjà mises dans une liste perso, puis favoris.
 * Si les deux sont vides, on reprend le début du catalogue — c'est
 * le bandeau « X chaînes disponibles » d'avant.
 */

export function pickHomeChannels<T extends { id: string }>(
  catalog: readonly T[],
  listChannelIds: readonly string[],
  favoriteChannelIds: readonly string[],
  limit = 20
): { items: T[]; source: 'personal' | 'catalog' } {
  const byId = new Map<string, T>();
  for (const channel of catalog) {
    byId.set(channel.id, channel);
  }

  const seen = new Set<string>();
  const personal: T[] = [];

  const push = (id: string) => {
    if (seen.has(id)) return;
    const channel = byId.get(id);
    if (!channel) return;
    seen.add(id);
    personal.push(channel);
  };

  for (const id of listChannelIds) push(id);
  for (const id of favoriteChannelIds) push(id);

  if (personal.length > 0) {
    return { items: personal.slice(0, limit), source: 'personal' };
  }

  return { items: catalog.slice(0, limit) as T[], source: 'catalog' };
}
