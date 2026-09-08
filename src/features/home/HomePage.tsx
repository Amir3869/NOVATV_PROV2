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
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { HeroSkeleton, SectionSkeleton } from '@/design-system/components/LoadingSkeleton';
import { useTranslation } from '@/i18n';
import { pickFeatured } from '@/features/home/pickFeatured';
import { historyEntryHref, historyEpisodeSeriesId, historyProfileId } from '@/features/history/historyLinks';
import { useClock } from '@/hooks/useClock';
import { enrichLiveChannels } from '@/services/epg/epgSync';

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

  const { channels, movies, series, epgPrograms, activePlaylistId } = useActiveCatalog();
  const nowMs = useClock();
  const homeChannels = React.useMemo(
    () => enrichLiveChannels(channels.slice(0, 20), epgPrograms, nowMs),
    [channels, epgPrograms, nowMs]
  );
  const playlists = useAppStore((s) => s.playlists);
  const watchHistory = useAppStore((s) => s.watchHistory);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const catalogReady = useAppStore((s) => s.catalogReady);
  const profileId = historyProfileId(activeProfileId);

  // Les données enregistrées sont relues après le premier rendu.
  // Tant que ce n'est pas fait, on ne sait pas si l'utilisateur a une
  // source : annoncer « aucune source » serait faux.
  const hydrated = useHydrated();

  const hasSource = playlists.length > 0;
  const hasContent = channels.length > 0 || movies.length > 0 || series.length > 0;

  const catalogIds = React.useMemo(() => {
    const ids = new Set<string>();
    channels.forEach((c) => ids.add(c.id));
    movies.forEach((m) => ids.add(m.id));
    series.forEach((s) => ids.add(s.id));
    return ids;
  }, [channels, movies, series]);

  // Reprises de lecture : contenus commencés de la source active seulement.
  const continueWatching = watchHistory
    .filter((h) => {
      if (h.profileId !== profileId) return false;
      if (!(h.percent > 0 && h.percent < 100)) return false;
      if (h.mediaType === 'episode') {
        const seriesId = historyEpisodeSeriesId(h);
        return Boolean(seriesId && catalogIds.has(seriesId));
      }
      return catalogIds.has(h.mediaId);
    })
    .slice(0, 12)
    .map((h) => ({
      ...h,
      href: historyEntryHref(h),
    }));

  const favoriteMovies = movies.filter((m) => isFavorite(m.id));
  const favoriteSeries = series.filter((s) => isFavorite(s.id));

  // Visuel d'abord, puis les plus récemment ajoutés (voir pickFeatured).
  const featured = pickFeatured(movies, series, 5);

  // ── Lecture des données enregistrées en cours ──
  // Même attente que TV en direct : sans le catalogue IndexedDB,
  // Accueil affichait encore les chaînes de l'ancienne source.
  if (!hydrated || !catalogReady) {
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
    <div key={activePlaylistId} className="min-h-screen">
      {featured.length > 0 && <HeroBanner items={featured} />}

      <div className="px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-12 md:space-y-14">
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
              title={t('liveTV.channelCount', { count: channels.length })}
              accent
              onSeeAll={() => router.push('/live')}
              className="mb-4"
            />
            <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {homeChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  variant="grid"
                  className="w-40 shrink-0 sm:w-44 md:w-48"
                />
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
