/**
 * Liens et filtres de l'historique.
 *
 * Accueil et page Historique doivent pointer vers les mêmes écrans.
 * Un épisode n'a pas de fiche propre : on ouvre sa série.
 */

import type { Episode, WatchHistoryEntry } from '@/types';

/** Identifiant de profil utilisé à l'écriture et à la lecture. */
export function historyProfileId(activeProfileId: string | null): string {
  return activeProfileId ?? 'profile-1';
}

/** Série d'un épisode, lue dans `mediaData` posé à l'enregistrement. */
export function historyEpisodeSeriesId(entry: WatchHistoryEntry): string | undefined {
  if (entry.mediaType !== 'episode') return undefined;
  const seriesId = (entry.mediaData as Partial<Episode> | undefined)?.seriesId;
  return seriesId || undefined;
}

export function historyEntryHref(entry: WatchHistoryEntry): string {
  if (entry.mediaType === 'movie') {
    return `/movies?id=${encodeURIComponent(entry.mediaId)}`;
  }
  if (entry.mediaType === 'episode') {
    const seriesId = historyEpisodeSeriesId(entry);
    return seriesId ? `/series?id=${encodeURIComponent(seriesId)}` : '/series';
  }
  if (entry.mediaType === 'live') {
    return `/live?id=${encodeURIComponent(entry.mediaId)}`;
  }
  return '/';
}
