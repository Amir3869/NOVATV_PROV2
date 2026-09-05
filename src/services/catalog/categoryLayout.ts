/**
 * Ordre et épinglage des catégories Live.
 *
 * Hors catalogue : une synchro Xtream réécrit les catégories, pas ces
 * listes. On ne stocke que des identifiants réels. Les ids disparus
 * sont ignorés à l'affichage ; les ids nouveaux se placent en fin.
 */

export const MAX_PINNED_CATEGORIES = 4;

/** Tableau vide stable : un `?? []` dans un sélecteur zustand recréerait une référence à chaque rendu. */
export const EMPTY_CATEGORY_IDS: readonly string[] = [];

export function layoutCategories<T extends { id: string }>(
  categories: T[],
  pinnedIds: readonly string[],
  orderIds: readonly string[]
): { pinned: T[]; rest: T[] } {
  const byId = new Map(categories.map((category) => [category.id, category]));

  const pinned: T[] = [];
  const pinnedSet = new Set<string>();
  for (const id of pinnedIds) {
    if (pinned.length >= MAX_PINNED_CATEGORIES) break;
    const category = byId.get(id);
    if (!category || pinnedSet.has(id)) continue;
    pinned.push(category);
    pinnedSet.add(id);
  }

  const restPool = categories.filter((category) => !pinnedSet.has(category.id));
  const rest: T[] = [];
  const seen = new Set<string>();
  for (const id of orderIds) {
    const category = restPool.find((item) => item.id === id);
    if (!category || seen.has(id)) continue;
    rest.push(category);
    seen.add(id);
  }
  for (const category of restPool) {
    if (seen.has(category.id)) continue;
    rest.push(category);
  }

  return { pinned, rest };
}

/** Tous les ids, épingles d'abord, pour écrire un nouvel ordre. */
export function orderedCategoryIds<T extends { id: string }>(
  categories: T[],
  pinnedIds: readonly string[],
  orderIds: readonly string[]
): string[] {
  const { pinned, rest } = layoutCategories(categories, pinnedIds, orderIds);
  return [...pinned, ...rest].map((category) => category.id);
}

export function moveIdInList(ids: string[], id: string, delta: -1 | 1): string[] {
  const index = ids.indexOf(id);
  if (index === -1) return ids;
  const next = index + delta;
  if (next < 0 || next >= ids.length) return ids;
  const copy = ids.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function dropIdsWithPrefix(
  byProfile: Record<string, string[]>,
  prefix: string
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [profileId, ids] of Object.entries(byProfile)) {
    const kept = ids.filter((id) => !id.startsWith(prefix));
    if (kept.length > 0) next[profileId] = kept;
  }
  return next;
}
