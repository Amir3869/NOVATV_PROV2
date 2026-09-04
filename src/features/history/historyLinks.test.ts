import { describe, it, expect } from 'vitest';
import {
  historyEntryHref,
  historyEpisodeSeriesId,
  historyProfileId,
} from './historyLinks';
import type { WatchHistoryEntry } from '@/types';

function entry(overrides: Partial<WatchHistoryEntry>): WatchHistoryEntry {
  return {
    id: 'h1',
    profileId: 'profile-1',
    mediaId: 'm1',
    mediaType: 'movie',
    title: 'Titre',
    position: 10,
    duration: 100,
    percent: 10,
    watchedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('historyProfileId', () => {
  it('retombe sur profile-1 quand aucun profil n’est actif', () => {
    expect(historyProfileId(null)).toBe('profile-1');
    expect(historyProfileId('p2')).toBe('p2');
  });
});

describe('historyEntryHref', () => {
  it('ouvre la fiche film', () => {
    expect(historyEntryHref(entry({ mediaType: 'movie', mediaId: 'pl:movie:7' }))).toBe(
      '/movies?id=pl%3Amovie%3A7'
    );
  });

  it('ouvre la série d’un épisode, pas l’épisode lui-même', () => {
    expect(
      historyEntryHref(
        entry({
          mediaType: 'episode',
          mediaId: 'pl:series:5:episode:205',
          mediaData: { seriesId: 'pl:series:5' },
        })
      )
    ).toBe('/series?id=pl%3Aseries%3A5');
  });

  it('retombe sur /series si l’épisode n’a pas de seriesId', () => {
    expect(historyEntryHref(entry({ mediaType: 'episode', mediaId: 'ep-1' }))).toBe('/series');
  });
});

describe('historyEpisodeSeriesId', () => {
  it('lit seriesId dans mediaData', () => {
    expect(
      historyEpisodeSeriesId(
        entry({ mediaType: 'episode', mediaData: { seriesId: 'pl:series:5' } })
      )
    ).toBe('pl:series:5');
  });

  it('ignore un film', () => {
    expect(historyEpisodeSeriesId(entry({ mediaType: 'movie' }))).toBeUndefined();
  });
});
