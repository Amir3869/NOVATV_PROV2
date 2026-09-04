'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { EPGProgram, LiveCategory, LiveChannel, Movie, Series } from '@/types';

/**
 * Catalogue **affiché** : uniquement la source active.
 *
 * Le store garde le contenu de toutes les sources (une resynchronisation
 * ou un changement de source ne doit pas tout retélécharger). Les écrans
 * de lecture, eux, ne doivent montrer qu'un abonnement à la fois —
 * sinon les mêmes chaînes et films apparaissent en double.
 *
 * Filtrer à la lecture, et non à l'écriture, laisse la page Sources
 * continuer d'agir sur *sa* source (guide, catégories, suppression).
 */
export function ofActivePlaylist<T extends { id?: string; playlistId?: string }>(
  items: T[],
  activePlaylistId: string | null
): T[] {
  if (!activePlaylistId) return [];
  const prefix = `${activePlaylistId}:`;
  return items.filter((item) => {
    // Les identifiants sont préfixés à la création (`source:live:…`,
    // `source:m3u:…`). Ce préfixe est plus fiable que `playlistId` :
    // un catalogue relu d'IndexedDB peut avoir un champ `playlistId`
    // manquant ou recopié sur la mauvaise source, alors que l'id, lui,
    // n'est jamais réécrit.
    if (typeof item.id === 'string' && item.id.includes(':')) {
      return item.id.startsWith(prefix);
    }
    return item.playlistId === activePlaylistId;
  });
}

/**
 * Le guide n'a pas de `playlistId` : la source est le préfixe de l'id
 * (`playlistId:epg:…`). Le séparateur `:epg:` évite qu'une source `a`
 * n'englobe le guide d'une source `ab`.
 */
export function ofActiveEpg(
  programs: EPGProgram[],
  activePlaylistId: string | null
): EPGProgram[] {
  if (!activePlaylistId) return [];
  const prefix = `${activePlaylistId}:epg:`;
  return programs.filter((p) => p.id.startsWith(prefix));
}

export interface ActiveCatalog {
  activePlaylistId: string | null;
  channels: LiveChannel[];
  liveCategories: LiveCategory[];
  movies: Movie[];
  series: Series[];
  epgPrograms: EPGProgram[];
}

export function useActiveCatalog(): ActiveCatalog {
  // Zustand + React 19 : le sélecteur doit renvoyer la **même
  // référence** tant que le store n'a pas changé. Filtrer ici
  // (`ofActivePlaylist(...)`) créait un tableau neuf à chaque appel
  // et déclenchait « getServerSnapshot should be cached ».
  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const channels = useAppStore((s) => s.channels);
  const liveCategories = useAppStore((s) => s.liveCategories);
  const movies = useAppStore((s) => s.movies);
  const series = useAppStore((s) => s.series);
  const epgPrograms = useAppStore((s) => s.epgPrograms);

  return useMemo(
    () => ({
      activePlaylistId,
      channels: ofActivePlaylist(channels, activePlaylistId),
      liveCategories: ofActivePlaylist(liveCategories, activePlaylistId),
      movies: ofActivePlaylist(movies, activePlaylistId),
      series: ofActivePlaylist(series, activePlaylistId),
      epgPrograms: ofActiveEpg(epgPrograms, activePlaylistId),
    }),
    [activePlaylistId, channels, liveCategories, movies, series, epgPrograms]
  );
}
