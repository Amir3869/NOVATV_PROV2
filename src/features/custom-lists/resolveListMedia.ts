/**
 * Résout les ids d'une liste perso vers le catalogue.
 *
 * Le compte (`items.length`) vit dans localStorage. Les chaînes, elles,
 * sont dans IndexedDB. Au redémarrage la page s'ouvrait trop tôt : le
 * compte était là, le find `id === id` ne trouvait rien, la liste
 * paraissait vide.
 *
 * On compare d'abord à l'identique, puis au dernier segment
 * (`12` dans `pl-1:live:12`) pour les ids recréés après une synchro.
 */

import type { CustomList, CustomListItem, LiveChannel, Movie, Series } from '@/types';

export type ResolvedListItem =
  | { status: 'ok'; itemId: string; mediaId: string; mediaType: 'channel'; data: LiveChannel }
  | { status: 'ok'; itemId: string; mediaId: string; mediaType: 'movie'; data: Movie }
  | { status: 'ok'; itemId: string; mediaId: string; mediaType: 'series'; data: Series }
  | { status: 'missing'; itemId: string; mediaId: string; mediaType: CustomListItem['mediaType'] };

export function catalogIdMatches(storedId: string, catalogId: string): boolean {
  if (storedId === catalogId) return true;
  const storedParts = storedId.split(':');
  const catalogParts = catalogId.split(':');
  const storedTail = storedParts[storedParts.length - 1];
  const catalogTail = catalogParts[catalogParts.length - 1];
  if (!storedTail || storedTail !== catalogTail) return false;
  if (storedParts.length >= 3 && catalogParts.length >= 3) {
    return storedParts[1] === catalogParts[1];
  }
  return true;
}

export function findCatalogItem<T extends { id: string }>(
  storedId: string,
  items: readonly T[]
): T | undefined {
  const exact = items.find((item) => item.id === storedId);
  if (exact) return exact;
  return items.find((item) => catalogIdMatches(storedId, item.id));
}

export function resolveListItems(
  list: CustomList,
  catalog: {
    channels: readonly LiveChannel[];
    movies: readonly Movie[];
    series: readonly Series[];
  }
): ResolvedListItem[] {
  return list.items.map((item) => {
    if (item.mediaType === 'movie') {
      const data = findCatalogItem(item.mediaId, catalog.movies);
      if (data) return { status: 'ok', itemId: item.id, mediaId: item.mediaId, mediaType: 'movie', data };
    } else if (item.mediaType === 'series') {
      const data = findCatalogItem(item.mediaId, catalog.series);
      if (data) return { status: 'ok', itemId: item.id, mediaId: item.mediaId, mediaType: 'series', data };
    } else if (item.mediaType === 'channel') {
      const data = findCatalogItem(item.mediaId, catalog.channels);
      if (data) return { status: 'ok', itemId: item.id, mediaId: item.mediaId, mediaType: 'channel', data };
    }
    return {
      status: 'missing',
      itemId: item.id,
      mediaId: item.mediaId,
      mediaType: item.mediaType,
    };
  });
}
