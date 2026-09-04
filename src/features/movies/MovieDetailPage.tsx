'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Heart, Star, Clock, User, Film, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Badge } from '@/design-system/components/Badge';
import { GlassCard } from '@/design-system/components/GlassCard';
import { ProgressBar } from '@/design-system/components/ProgressBar';
import { MovieCard } from '@/design-system/components/MediaCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { DetailSkeleton } from '@/design-system/components/LoadingSkeleton';
import { AddToListDialog } from '@/design-system/components/AddToListDialog';
import { formatDuration } from '@/utils/cn';
import { useTranslation } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { getPlaylistXtreamCredentials } from '@/services/xtream/xtreamCredentials';
import { fetchVodDetails, toSourceErrorKind } from '@/services/xtream/xtreamSync';

export function MovieDetailPage({ movieId }: { movieId: string }) {
  const { t } = useTranslation();
  const { movies: allMovies } = useActiveCatalog();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const movie = allMovies.find((m) => m.id === movieId);
  const playlists = useAppStore((s) => s.playlists);
  const updateMovieDetails = useAppStore((s) => s.updateMovieDetails);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(movieId));

  useEffect(() => {
    if (!movie || typeof movie.streamId !== 'number') return;
    // La liste `get_vod_streams` n'embarque pas le synopsis. S'il est
    // déjà là, un passage précédent a déjà interrogé le serveur.
    if (movie.plot) return;
    const playlist = playlists.find((p) => p.id === movie.playlistId);
    if (!playlist || playlist.type !== 'xtream') return;

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const creds = await getPlaylistXtreamCredentials(playlist.id);
        if (!creds || cancelled) return;
        const patch = await fetchVodDetails(creds, movie, { signal: controller.signal });
        if (cancelled || Object.keys(patch).length === 0) return;
        updateMovieDetails(movie.id, patch);
      } catch (err) {
        if (cancelled || toSourceErrorKind(err) === 'aborted') return;
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id, movie?.streamId, movie?.playlistId, movie?.plot, playlists, updateMovieDetails]);

  // Voir useHydrated : le catalogue est vide tant que les données
  // enregistrées ne sont pas relues. Sans ce garde, la page annonce
  // « Film introuvable » pour un film qui existe.
  const hydrated = useHydrated();

  if (!hydrated) return <DetailSkeleton />;

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState emoji="🎬" title={t('movies.notFound')} action={{ label: t('common.back'), onClick: () => router.back() }} />
      </div>
    );
  }

  const similar = allMovies.filter((m) => m.id !== movieId && m.categoryId === movie.categoryId).slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* Hero backdrop */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        {movie.backdrop && !imgError ? (
          <img src={movie.backdrop} alt={movie.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-surface-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-surface-0/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-0/80 via-transparent to-transparent" />

        {/* Back : `.cinema` garde l'icône blanche sur l'affiche. */}
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
          {/* Poster */}
          <div className="flex-shrink-0 w-28 md:w-36">
            <ImageWithFallback
              src={movie.logo}
              alt={movie.name}
              className="w-full aspect-[2/3] object-cover rounded-xl shadow-2xl"
              fallbackClassName="w-full aspect-[2/3] rounded-xl bg-surface-3"
              fallback={<Film className="w-8 h-8 text-white/20" />}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-20 md:pt-24">
            {movie.genre && <p className="text-xs text-white/40 mb-2">{movie.genre.split(',')[0]}</p>}
            <h1 className="text-xl md:text-3xl font-black text-white leading-tight mb-2">{movie.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {movie.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm text-amber-400 font-semibold">{movie.rating}</span>
                </div>
              )}
              {movie.year && <span className="text-sm text-white/40">{movie.year}</span>}
              {movie.duration && (
                <div className="flex items-center gap-1 text-white/40">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm">{formatDuration(movie.duration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/player?type=movie&id=${movie.id}`}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 min-h-11 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white on-accent font-bold text-sm rounded-xl transition-colors shadow-lg shadow-red-900/20 min-w-36"
          >
            <Play className="w-4 h-4 fill-white" />
            {movie.watchProgress && movie.watchProgress > 0 ? t('common.resume') : t('common.watch')}
          </Link>

          <button
            onClick={() => toggleFavorite(movie.id, 'movie')}
            className={cn('flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all border', isFav ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-white/70 border-white/8 hover:bg-white/10')}
          >
            <Heart className={cn('w-4 h-4', isFav && 'fill-accent')} />
            {isFav ? t('common.removed') : t('common.favorites')}
          </button>

          {/* Ce bouton ne faisait rien. Il ouvre desormais le selecteur
              de liste : « Ma liste » n'est pas un endroit unique, il faut
              choisir laquelle parmi celles du profil. */}
          <button
            type="button"
            onClick={() => setShowAddToList(true)}
            className="flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold bg-white/5 text-white/70 border border-white/8 hover:bg-white/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('common.myList')}
          </button>

          <AddToListDialog
            open={showAddToList}
            mediaId={movie.id}
            mediaType="movie"
            onClose={() => setShowAddToList(false)}
          />
        </div>

        {/* Progress */}
        {movie.watchProgress !== undefined && movie.watchProgress > 0 && (
          <div className="space-y-1">
            <ProgressBar value={movie.watchProgress} />
            <p className="text-xs text-white/30">{t('movies.watchedPercent', { percent: movie.watchProgress })}</p>
          </div>
        )}

        {/* Details */}
        <GlassCard variant="glass" padding="lg">
          {movie.plot && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t('common.synopsis')}</h2>
              <p className="text-sm text-white/70 leading-relaxed">{movie.plot}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {movie.director && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">{t('movies.director')}</p>
                <p className="text-sm text-white/70 font-medium">{movie.director}</p>
              </div>
            )}
            {movie.genre && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">{t('movies.genre')}</p>
                <p className="text-sm text-white/70 font-medium">{movie.genre}</p>
              </div>
            )}
            {movie.cast && (
              <div className="col-span-2">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">{t('common.cast')}</p>
                <p className="text-sm text-white/70">{movie.cast}</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Similar */}
        {similar.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4">{t('movies.similarMovies')}</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {similar.map((m) => <MovieCard key={m.id} movie={m} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
