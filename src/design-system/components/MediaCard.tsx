'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Heart, Star, Clock, Info, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ImageWithFallback } from './ImageWithFallback';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';
import { formatDuration } from '@/utils/cn';
import type { Movie, Series, LiveChannel, Episode } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useLongPress } from '@/hooks/useLongPress';
import { useParental } from '@/features/parental/ParentalProvider';
import { channelDisplayName } from '@/lib/displayNames';

// ─── Movie Card ──────────────────────────────
interface MovieCardProps {
  movie: Movie;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MovieCard({ movie, size = 'md', className }: MovieCardProps) {
  const [imgError, setImgError] = useState(false);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(movie.id));

  const widthClass = size === 'sm' ? 'w-28' : size === 'md' ? 'w-36 md:w-40' : 'w-44 md:w-52';

  return (
    <div className={cn('group relative flex-shrink-0', widthClass, className)}>
      <Link href={`/movies?id=${encodeURIComponent(movie.id)}`}>
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-3">
          {movie.logo && !imgError ? (
            <img
              src={movie.logo}
              alt={movie.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-1">
              <Play className="w-8 h-8 text-white/20" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity duration-300" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Rating */}
          {movie.rating && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-amber-400 font-medium">{movie.rating}</span>
            </div>
          )}

          {/* Progress */}
          {movie.watchProgress !== undefined && movie.watchProgress > 0 && movie.watchProgress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
              <div
                className="h-full bg-accent"
                style={{ width: `${movie.watchProgress}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="mt-2 px-0.5">
        <h3 className="text-xs font-semibold text-white/90 truncate leading-tight">{movie.name}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          {movie.year && <span className="text-[10px] text-white/40">{movie.year}</span>}
          {movie.duration && (
            <span className="text-[10px] text-white/40">{formatDuration(movie.duration)}</span>
          )}
        </div>
      </div>

      {/* Favorite */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); toggleFavorite(movie.id, 'movie'); }}
        aria-label={isFav ? `Retirer ${movie.name} des favoris` : `Ajouter ${movie.name} aux favoris`}
        aria-pressed={isFav}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
      >
        <Heart className={cn('w-3.5 h-3.5', isFav ? 'fill-accent text-accent' : 'text-white')} />
      </button>
    </div>
  );
}

// ─── Series Card ──────────────────────────────
interface SeriesCardProps {
  series: Series;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SeriesCard({ series, size = 'md', className }: SeriesCardProps) {
  const [imgError, setImgError] = useState(false);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(series.id));
  const widthClass = size === 'sm' ? 'w-28' : size === 'md' ? 'w-36 md:w-40' : 'w-44 md:w-52';

  return (
    <div className={cn('group relative flex-shrink-0', widthClass, className)}>
      <Link href={`/series?id=${encodeURIComponent(series.id)}`}>
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-3">
          {series.cover && !imgError ? (
            <img
              src={series.cover}
              alt={series.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-1">
              <Play className="w-8 h-8 text-white/20" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>

          {series.rating && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-amber-400 font-medium">{series.rating}</span>
            </div>
          )}
        </div>
      </Link>

      <div className="mt-2 px-0.5">
        <h3 className="text-xs font-semibold text-white/90 truncate leading-tight">{series.name}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          {series.year && <span className="text-[10px] text-white/40">{series.year}</span>}
          {series.episodeCount && (
            <span className="text-[10px] text-white/40">{series.episodeCount} épisodes</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.preventDefault(); toggleFavorite(series.id, 'series'); }}
        aria-label={isFav ? `Retirer ${series.name} des favoris` : `Ajouter ${series.name} aux favoris`}
        aria-pressed={isFav}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
      >
        <Heart className={cn('w-3.5 h-3.5', isFav ? 'fill-accent text-accent' : 'text-white')} />
      </button>
    </div>
  );
}

// ─── Channel Card ─────────────────────────────
interface ChannelCardProps {
  channel: LiveChannel;
  className?: string;
  variant?: 'list' | 'grid';
}

export function ChannelCard({ channel, className, variant = 'list' }: ChannelCardProps) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(channel.id));
  const channelRenames = useAppStore((s) => s.channelRenames);
  const { isTV } = useDeviceType();
  const { isChannelBlocked, ensureUnlocked } = useParental();

  // Verrou parental : une chaîne sous cadenas est grisée et son
  // ouverture demande d'abord le code. `isChannelBlocked` devient
  // `false` dès que la session est déverrouillée, donc la carte
  // redevient normale sans recharger la page.
  const blocked = isChannelBlocked(channel);

  // Nom affiché : un surnom éventuel remplace le nom d'origine. Règle
  // globale (section E) : si la chaîne a été renommée, son surnom la
  // suit partout (liste, grille, favoris, récents, recherche). On lit
  // le store ici pour que la carte soit toujours à jour sans rien
  // passer en prop d'une page à l'autre.
  const displayName = channelDisplayName(channel.id, channel.name, channelRenames);

  // Cliquer une chaîne la LANCE. Auparavant on ouvrait sa fiche, et il
  // fallait un second clic sur « Regarder en direct » : deux gestes pour
  // une intention évidente.
  const playHref = `/player?type=live&id=${encodeURIComponent(channel.id)}`;
  const infoHref = `/live?id=${encodeURIComponent(channel.id)}`;

  // La fiche reste joignable, par un chemin adapté à l'appareil :
  //   - souris et tactile : un bouton « i » ;
  //   - télécommande : un appui long sur OK, car un bouton de 24 px
  //     placé dans chaque vignette obligerait le focus à le traverser
  //     pour atteindre la chaîne suivante.
  const longPress = useLongPress(infoHref, isTV);

  if (variant === 'grid') {
    return (
      <div className={cn('group relative', className)}>
        <Link
          href={playHref}
          className="block"
          {...longPress}
          onClick={(e) => {
            if (blocked) {
              e.preventDefault();
              ensureUnlocked();
            }
          }}
        >
          <div className={cn('relative bg-surface-3 hover:bg-surface-3 rounded-xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-200', blocked && 'opacity-60')}>
            <div className="aspect-video flex items-center justify-center p-4">
              {channel.logo && !imgError ? (
                <img
                  src={channel.logo}
                  alt={displayName}
                  className="max-h-12 max-w-full object-contain filter drop-shadow-lg"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-12 h-8 rounded bg-white/5 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-white/20" />
                </div>
              )}
              {blocked && (
                <span className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/80">
                  <Lock className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
            <div className="px-3 pb-3">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              {channel.currentProgram && (
                <p className="text-[10px] text-white/40 truncate mt-0.5">{channel.currentProgram.title}</p>
              )}
            </div>
            <Badge variant="live" size="xs" pulse className="absolute top-2 right-2">{t('common.liveShort')}</Badge>
          </div>
        </Link>
        {/* Bouton d'information : frère du lien, jamais son enfant — un
            <a> imbriqué dans un <a> est du HTML invalide. Masqué sur
            téléviseur, où l'appui long prend le relais. */}
        {!isTV && (
          <Link
            href={infoHref}
            aria-label={t('liveTV.channelInfo')}
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Info className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  // List variant
  // Le bouton favori est un frère du lien, pas un enfant : un <button>
  // imbriqué dans un <a> est du HTML invalide et se comporte de façon
  // imprévisible à la télécommande.
  return (
    <div className={cn('group flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/5', className)}>
      <Link
        href={playHref}
        className="flex items-center gap-3 flex-1 min-w-0"
        {...longPress}
        onClick={(e) => {
          if (blocked) {
            e.preventDefault();
            ensureUnlocked();
          }
        }}
      >
      <div className={cn('w-16 h-10 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0 overflow-hidden', blocked && 'opacity-50')}>
        {channel.logo && !imgError ? (
          <img
            src={channel.logo}
            alt={displayName}
            className="max-h-8 max-w-14 object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <Tv className="w-5 h-5 text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm font-semibold text-white truncate', blocked && 'opacity-60')}>{displayName}</p>
          {blocked && <Lock className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
          <Badge variant="live" size="xs" pulse>{t('common.liveShort')}</Badge>
        </div>
        {channel.currentProgram && (
          <>
            <p className="text-xs text-white/50 truncate">{channel.currentProgram.title}</p>
            {channel.currentProgram.progressPercent !== undefined && (
              <ProgressBar value={channel.currentProgram.progressPercent} size="xs" className="mt-1.5" />
            )}
          </>
        )}
      </div>
      </Link>
      {!isTV && (
        <Link
          href={infoHref}
          aria-label={t('liveTV.channelInfo')}
          className="flex-shrink-0 text-white/30 hover:text-white transition-colors p-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
        >
          <Info className="w-4 h-4" />
        </Link>
      )}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); toggleFavorite(channel.id, 'channel'); }}
        aria-label={isFav ? `Retirer ${displayName} des favoris` : `Ajouter ${displayName} aux favoris`}
        aria-pressed={isFav}
        className="flex-shrink-0 text-white/30 hover:text-accent transition-colors p-1"
      >
        <Heart className={cn('w-4 h-4', isFav ? 'fill-accent text-accent' : '')} />
      </button>
    </div>
  );
}

// Need Tv import
import { Tv } from 'lucide-react';

// ─── Continue Watching Card ────────────────────
interface ContinueWatchingCardProps {
  title: string;
  thumbnail?: string;
  percent: number;
  href: string;
  subtitle?: string;
}

export function ContinueWatchingCard({ title, thumbnail, percent, href, subtitle }: ContinueWatchingCardProps) {
  return (
    <Link href={href} className="group relative flex-shrink-0 w-56 md:w-64">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-3">
        <ImageWithFallback
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          fallbackClassName="w-full h-full bg-gradient-to-br from-surface-3 to-surface-1"
          fallback={<Play className="w-8 h-8 text-white/20" />}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-semibold text-white/90 truncate">{title}</p>
        {subtitle && <p className="text-[10px] text-white/40 truncate">{subtitle}</p>}
        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-white/30" />
          <span className="text-[10px] text-white/40">{percent}% vu</span>
        </div>
      </div>
    </Link>
  );
}
