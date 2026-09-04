'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Heart, Star, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Badge } from '@/design-system/components/Badge';
import { GlassCard } from '@/design-system/components/GlassCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { sortedEpisodesOf } from '@/services/player/episodeQueue';
import { useHydrated } from '@/hooks/useHydrated';
import { DetailSkeleton } from '@/design-system/components/LoadingSkeleton';
import type { Season, Episode } from '@/types';
import { useTranslation } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { getPlaylistXtreamCredentials } from '@/services/xtream/xtreamCredentials';
import { fetchSeriesDetails, toSourceErrorKind } from '@/services/xtream/xtreamSync';

export function SeriesDetailPage({ seriesId }: { seriesId: string }) {
  const { t } = useTranslation();
  const allEpisodes = useAppStore((s) => s.episodes);
  const allSeasons = useAppStore((s) => s.seasons);
  const playlists = useAppStore((s) => s.playlists);
  const setSeriesDetails = useAppStore((s) => s.setSeriesDetails);
  const { series: allSeries } = useActiveCatalog();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [errorSeriesId, setErrorSeriesId] = useState<string | null>(null);
  const [fetchedSeriesId, setFetchedSeriesId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const playbackProgress = useAppStore((s) => s.playbackProgress);

  const series = allSeries.find((s) => s.id === seriesId);
  const seasons = allSeasons
    .filter((s) => s.seriesId === seriesId)
    .slice()
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const playlist = series ? playlists.find((p) => p.id === series.playlistId) : undefined;
  const xtreamSeriesId = series?.seriesId;
  const canFetchEpisodes =
    typeof xtreamSeriesId === 'number' && playlist?.type === 'xtream';
  const hasCachedEpisodes =
    seasons.length > 0 || allEpisodes.some((e) => e.seriesId === seriesId);
  const episodesError = errorSeriesId === seriesId;
  const episodesFetched = fetchedSeriesId === seriesId;

  useEffect(() => {
    if (!series || typeof xtreamSeriesId !== 'number') return;
    if (!playlist || playlist.type !== 'xtream') return;

    const alreadyLoaded = allEpisodes.some((e) => e.seriesId === series.id);
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const creds = await getPlaylistXtreamCredentials(playlist.id);
        if (!creds) {
          if (!cancelled && !alreadyLoaded) setErrorSeriesId(series.id);
          return;
        }
        const details = await fetchSeriesDetails(
          creds,
          playlist.id,
          series.id,
          xtreamSeriesId,
          { signal: controller.signal }
        );
        if (cancelled) return;
        setSeriesDetails(series.id, details);
        setFetchedSeriesId(series.id);
        setErrorSeriesId((current) => (current === series.id ? null : current));
      } catch (err) {
        if (cancelled || toSourceErrorKind(err) === 'aborted') return;
        if (!alreadyLoaded) setErrorSeriesId(series.id);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `allEpisodes` est volontairement hors dépendances : l'écrire ici
    // relancerait l'effet après chaque enregistrement, en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    series?.id,
    xtreamSeriesId,
    series?.playlistId,
    playlist,
    retryNonce,
    setSeriesDetails,
  ]);

  /**
   * Episode a lancer par le bouton principal.
   *
   * Deduit de la progression de lecture, et non du champ
   * `lastWatchedEpisodeId` de la serie : le catalogue n'est PAS
   * enregistre sur le disque (voir `partialize` dans le store), il est
   * reconstruit a chaque synchronisation. Une marque posee dessus
   * disparaitrait au premier rechargement, alors que `playbackProgress`
   * survit.
   *
   * A defaut de progression, le premier episode dans l'ordre de
   * diffusion. L'ancienne version pointait vers `ep-1-1`, un identifiant
   * herite des donnees de demonstration qui n'existe dans aucun
   * catalogue reel : le bouton ouvrait un lecteur vide.
   */
  const ordered = sortedEpisodesOf(allEpisodes, seriesId);
  const lastWatched = playbackProgress
    .filter((p) => p.mediaType === 'episode' && ordered.some((e) => e.id === p.mediaId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const resumeEpisodeId = lastWatched?.mediaId ?? ordered[0]?.id ?? null;
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(seriesId));

  // Voir useHydrated : sans ce garde, la page annonce « Série
  // introuvable » avant même d'avoir lu les données enregistrées.
  const hydrated = useHydrated();

  if (!hydrated) return <DetailSkeleton />;

  if (!series) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState emoji="📺" title={t('series.notFound')} action={{ label: t('common.back'), onClick: () => router.back() }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        {series.backdrop && !imgError ? (
          <img src={series.backdrop} alt={series.name} className="absolute inset-0 w-full h-full object-cover object-top" onError={() => setImgError(true)} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-surface-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-surface-0/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-0/70 via-transparent to-transparent" />
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="cinema absolute top-4 start-4 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 md:px-8 lg:px-10 -mt-32 relative z-10 space-y-6 pb-10">
        <div className="flex gap-6">
          {/* Cover */}
          <div className="flex-shrink-0 w-28 md:w-36">
            <ImageWithFallback
              src={series.cover}
              alt={series.name}
              className="w-full aspect-[2/3] object-cover rounded-xl shadow-2xl"
              fallbackClassName="w-full aspect-[2/3] rounded-xl bg-surface-3"
              fallback={null}
            />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0 pt-20 md:pt-24">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="genre">{series.categoryName || t('series.defaultBadge')}</Badge>
            </div>
            <h1 className="text-xl md:text-3xl font-black text-white leading-tight mb-2">{series.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              {series.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm text-amber-400 font-semibold">{series.rating}</span>
                </div>
              )}
              {series.year && <span className="text-sm text-white/40">{series.year}</span>}
              {seasons.length > 0 && (
                <span className="text-sm text-white/40">
                  {t(seasons.length > 1 ? 'series.seasonCountPlural' : 'series.seasonCount', {
                    count: seasons.length,
                  })}
                </span>
              )}
              {(series.episodeCount || allEpisodes.filter((e) => e.seriesId === seriesId).length > 0) && (
                <span className="text-sm text-white/40">
                  {t('series.episodeCount', {
                    count: series.episodeCount || allEpisodes.filter((e) => e.seriesId === seriesId).length,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {/* Doctrine Phase 4 : un bouton sans action possible est
              retire, pas grise. Sans episode au catalogue, il n'y a
              rien a lancer. */}
          {resumeEpisodeId && (
            <Link
              href={`/player?type=episode&id=${encodeURIComponent(resumeEpisodeId)}&seriesId=${encodeURIComponent(series.id)}`}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 min-h-11 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white on-accent font-bold text-sm rounded-xl transition-colors min-w-36"
            >
              <Play className="w-4 h-4 fill-white" />
              {lastWatched ? t('common.resume') : t('common.watch')}
            </Link>
          )}
          <button
            onClick={() => toggleFavorite(series.id, 'series')}
            className={cn('flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold border transition-all', isFav ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-white/70 border-white/8 hover:bg-white/10')}
          >
            <Heart className={cn('w-4 h-4', isFav && 'fill-accent')} />
            {isFav ? t('common.removed') : t('common.favorites')}
          </button>
        </div>

        {/* Synopsis */}
        {series.plot && (
          <GlassCard variant="glass">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t('common.synopsis')}</h2>
            <p className="text-sm text-white/70 leading-relaxed">{series.plot}</p>
            {series.cast && (
              <div className="mt-4">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">{t('common.cast')}</p>
                <p className="text-sm text-white/60">{series.cast}</p>
              </div>
            )}
          </GlassCard>
        )}

        {/* Seasons & Episodes */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">{t('series.episodes')}</h2>
          {canFetchEpisodes && !hasCachedEpisodes && !episodesError && !episodesFetched ? (
            <p className="text-sm text-white/50 py-6 text-center" role="status" aria-live="polite">
              {t('series.loadingEpisodes')}
            </p>
          ) : episodesError && !hasCachedEpisodes ? (
            <EmptyState
              emoji="📋"
              title={t('series.episodesLoadError')}
              size="sm"
              action={{
                label: t('common.retry'),
                onClick: () => {
                  setErrorSeriesId(null);
                  setFetchedSeriesId(null);
                  setRetryNonce((n) => n + 1);
                },
              }}
            />
          ) : seasons.length === 0 ? (
            <EmptyState emoji="📋" title={t('series.noEpisodes')} size="sm" />
          ) : (
            seasons.map((season) => (
              <SeasonAccordion
                key={season.id}
                season={season}
                episodes={allEpisodes
                  .filter((e) => e.seasonId === season.id)
                  .slice()
                  .sort((a, b) => a.episodeNumber - b.episodeNumber)}
                isExpanded={expandedSeason === season.id}
                onToggle={() => setExpandedSeason(expandedSeason === season.id ? null : season.id)}
                seriesId={seriesId}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SeasonAccordion({ season, episodes, isExpanded, onToggle, seriesId }: {
  season: Season;
  episodes: Episode[];
  isExpanded: boolean;
  onToggle: () => void;
  seriesId: string;
}) {
  const { t } = useTranslation();
  return (
    <GlassCard variant="glass" padding="none">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/3 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">
            {season.name.trim() || t('series.season', { number: season.seasonNumber })}
          </span>
          <span className="text-sm text-white/40">{t('series.episodeCount', { count: season.episodeCount })}</span>
          {season.airDate && <span className="text-xs text-white/30">{new Date(season.airDate).getFullYear()}</span>}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 border-t border-white/5">
          {episodes.length === 0 ? (
            <p className="text-sm text-white/40 p-4">{t('series.noEpisodes')}</p>
          ) : (
            episodes.map((ep) => (
              <EpisodeRow key={ep.id} episode={ep} seriesId={seriesId} />
            ))
          )}
        </div>
      )}
    </GlassCard>
  );
}

function EpisodeRow({ episode, seriesId }: { episode: Episode; seriesId: string }) {
  return (
    <Link
      href={`/player?type=episode&id=${episode.id}&seriesId=${seriesId}`}
      className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-28 aspect-video rounded-lg overflow-hidden bg-surface-3">
        <ImageWithFallback
          src={episode.image}
          alt={episode.title}
          className="w-full h-full object-cover"
          fallbackClassName="w-full h-full"
          fallback={<Play className="w-5 h-5 text-white/20" />}
        />
        {episode.watchProgress !== undefined && episode.watchProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
            <div className="h-full bg-accent" style={{ width: `${episode.watchProgress}%` }} />
          </div>
        )}
        {episode.isWatched && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500/80 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-white/40 font-medium">E{episode.episodeNumber}</span>
          {episode.duration && <span className="text-xs text-white/30">{Math.round(episode.duration / 60)}min</span>}
        </div>
        <p className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors leading-snug">{episode.title}</p>
        {episode.plot && <p className="text-xs text-white/40 mt-1 line-clamp-2">{episode.plot}</p>}
      </div>
    </Link>
  );
}
