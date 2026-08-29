'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HeroBanner } from '@/design-system/components/HeroBanner';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { EmptyState } from '@/design-system/components/EmptyState';
import {
  MovieCard,
  SeriesCard,
  ChannelCard,
  ContinueWatchingCard,
} from '@/design-system/components/MediaCard';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { HeroSkeleton, SectionSkeleton } from '@/design-system/components/LoadingSkeleton';
import { useTranslation } from '@/i18n';
import type { Movie, Series } from '@/types';

/**
 * Écran d'accueil.
 *
 * Toutes les données proviennent du store, alimenté par les sources de
 * l'utilisateur (Xtream ou M3U). Tant qu'aucune source n'est
 * configurée, l'application n'a **rien** à afficher : c'est l'état
 * normal au premier lancement, pas une erreur. On oriente donc vers
 * l'ajout d'une source plutôt que de laisser une page vide.
 */
export function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();

  const channels = useAppStore((s) => s.channels);
  const movies = useAppStore((s) => s.movies);
  const series = useAppStore((s) => s.series);
  const playlists = useAppStore((s) => s.playlists);
  const watchHistory = useAppStore((s) => s.watchHistory);
  const isFavorite = useAppStore((s) => s.isFavorite);

  // Les données enregistrées sont relues après le premier rendu.
  // Tant que ce n'est pas fait, on ne sait pas si l'utilisateur a une
  // source : annoncer « aucune source » serait faux.
  const hydrated = useHydrated();

  const hasSource = playlists.length > 0;
  const hasContent = channels.length > 0 || movies.length > 0 || series.length > 0;

  // Reprises de lecture : uniquement les contenus commencés et non finis.
  const continueWatching = watchHistory
    .filter((h) => h.percent > 0 && h.percent < 100)
    .slice(0, 12)
    .map((h) => ({
      ...h,
      href:
        h.mediaType === 'movie'
          ? `/movies?id=${encodeURIComponent(h.mediaId)}`
          : h.mediaType === 'episode'
            ? `/series?id=${encodeURIComponent(h.mediaId)}`
            : `/live?id=${encodeURIComponent(h.mediaId)}`,
    }));

  const favoriteMovies = movies.filter((m) => isFavorite(m.id));
  const favoriteSeries = series.filter((s) => isFavorite(s.id));

  // Le bandeau met en avant les contenus les mieux notés disponibles.
  // `rating` est une chaîne côté API : on la convertit pour trier, et
  // une note absente ou illisible vaut 0 plutôt que de fausser l'ordre.
  const ratingOf = (item: Movie | Series): number => {
    const value = Number.parseFloat(item.rating ?? '');
    return Number.isFinite(value) ? value : 0;
  };

  const featured: Array<(Movie | Series) & { mediaType: 'movie' | 'series' }> = [
    ...movies.map((m) => ({ ...m, mediaType: 'movie' as const })),
    ...series.map((s) => ({ ...s, mediaType: 'series' as const })),
  ]
    .sort((a, b) => ratingOf(b) - ratingOf(a))
    .slice(0, 5);

  // ── Lecture des données enregistrées en cours ──
  if (!hydrated) {
    return (
      <div className="min-h-screen">
        <HeroSkeleton />
        <div className="px-4 md:px-8 lg:px-10 py-8 space-y-10">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      </div>
    );
  }

  // ── Aucune source configurée ──
  if (!hasSource) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <EmptyState
          emoji="📡"
          size="lg"
          title={t('home.noSourceTitle')}
          description={t('home.noSourceDescription')}
          action={{
            label: t('home.noSourceAction'),
            onClick: () => router.push('/playlists'),
          }}
        />
      </div>
    );
  }

  // ── Source configurée mais aucun contenu chargé ──
  if (!hasContent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <EmptyState
          emoji="🗂️"
          size="lg"
          title={t('home.noContentTitle')}
          description={t('home.noContentDescription')}
          action={{
            label: t('home.noContentAction'),
            onClick: () => router.push('/playlists'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {featured.length > 0 && <HeroBanner items={featured} />}

      <div className="px-4 md:px-8 lg:px-10 py-8 space-y-10">
        {continueWatching.length > 0 && (
          <section>
            <SectionHeader
              title={t('home.continueWatching')}
              accent
              onSeeAll={() => router.push('/history')}
              className="mb-4"
            />
            <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {continueWatching.map((item) => (
                <ContinueWatchingCard
                  key={item.id}
                  title={item.title}
                  thumbnail={item.thumbnail}
                  percent={item.percent}
                  href={item.href}
                />
              ))}
            </div>
          </section>
        )}

        {channels.length > 0 && (
          <section>
            <SectionHeader
              title={t('home.liveChannels')}
              accent
              onSeeAll={() => router.push('/live')}
              className="mb-4"
            />
            <div className="space-y-1">
              {channels.slice(0, 6).map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
          </section>
        )}

        {movies.length > 0 && (
          <section>
            <SectionHeader
              title={t('nav.movies')}
              accent
              onSeeAll={() => router.push('/movies')}
              className="mb-4"
            />
            <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {movies.slice(0, 20).map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </section>
        )}

        {series.length > 0 && (
          <section>
            <SectionHeader
              title={t('nav.series')}
              accent
              onSeeAll={() => router.push('/series')}
              className="mb-4"
            />
            <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {series.slice(0, 20).map((item) => (
                <SeriesCard key={item.id} series={item} />
              ))}
            </div>
          </section>
        )}

        {(favoriteMovies.length > 0 || favoriteSeries.length > 0) && (
          <section>
            <SectionHeader
              title={t('home.myFavorites')}
              accent
              onSeeAll={() => router.push('/favorites')}
              className="mb-4"
            />
            <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {favoriteMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
              {favoriteSeries.map((item) => (
                <SeriesCard key={item.id} series={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
