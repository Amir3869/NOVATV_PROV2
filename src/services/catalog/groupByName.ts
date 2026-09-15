/**
 * Regroupe des titres par nom de catégorie, pour les rails Films / Séries.
 *
 * Un nom vide ou absent tombe dans `fallback` (ex. « Autres ») : on ne
 * crée pas une rangée sans titre.
 */

export type NamedGroup<T> = {
  name: string;
  items: T[];
};

export const RAIL_PREVIEW = 12;

export function groupByName<T>(
  items: readonly T[],
  nameOf: (item: T) => string | undefined,
  fallback: string,
): NamedGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const raw = nameOf(item)?.trim();
    const name = raw ? raw : fallback;
    const list = map.get(name);
    if (list) list.push(item);
    else map.set(name, [item]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, grouped]) => ({ name, items: grouped }));
}
