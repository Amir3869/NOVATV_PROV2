'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Plus, Info, Star, Clock, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from './Badge';
import { formatDuration } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import type { Movie, Series } from '@/types';

type FeaturedItem = (Movie | Series) & { mediaType: 'movie' | 'series' };

interface HeroBannerProps {
  items: FeaturedItem[];
  className?: string;
}

export function HeroBanner({ items, className }: HeroBannerProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  /**
   * On mémorise QUEL visuel a échoué, pas un simple oui/non.
   *
   * Avant : un booléen `imgError` remis à false par un `useEffect` à
   * chaque changement de diapositive. Ce schéma déclenche un second
   * rendu en cascade juste après le premier — l'image correcte
   * pouvait clignoter, et React 19 le signale comme une erreur.
   *
   * Maintenant la valeur est simplement comparée pendant le rendu :
   * aucun effet, aucun rendu supplémentaire.
   */
  const [erroredIndex, setErroredIndex] = useState<number | null>(null);
  const imgError = erroredIndex === activeIndex;
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(items[activeIndex]?.id ?? ''));

  const item = items[activeIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!item) return null;

  const backdrop = 'backdrop' in item ? item.backdrop : undefined;
  const rating = item.rating;
  const plot = item.plot;
  const href = item.mediaType === 'movie' ? `/movies?id=${encodeURIComponent(item.id)}` : `/series?id=${encodeURIComponent(item.id)}`;
  const duration = 'duration' in item ? item.duration : undefined;
  const watchProgress = 'watchProgress' in item && typeof item.watchProgress === 'number' ? item.watchProgress : undefined;

  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      {/* Background */}
      <div className="relative w-full min-h-[430px] h-[62vh] max-h-[760px] md:h-[68vh] lg:h-[72vh]">
        {backdrop && !imgError ? (
          <img
            src={backdrop}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
            onError={() => setErroredIndex(activeIndex)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A0000] via-surface-2 to-surface-0" />
        )}

        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-surface-0/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-0/90 via-surface-0/30 to-transparent" />
        {/* Subtle red accent gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-accent/5 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pb-10 sm:p-8 sm:pb-12 md:p-10 lg:p-14 lg:pb-16">
          {/* Type badge */}
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="live" size="sm" pulse>
              {item.mediaType === 'movie' ? t('common.badgeMovie') : t('common.badgeSeries')}
            </Badge>
            {item.genre && (
              <span className="text-xs text-white/50 font-medium">{item.genre.split(',')[0]}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="max-w-xl text-3xl font-black leading-[1.05] text-white drop-shadow-2xl sm:text-4xl md:text-5xl lg:text-6xl">
            {item.name}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 mb-4">
            {rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-sm text-amber-400 font-semibold">{rating}</span>
              </div>
            )}
            {item.year && <span className="text-sm text-white/50">{item.year}</span>}
            {duration && <span className="text-sm text-white/50">{formatDuration(duration)}</span>}
          </div>

          {/* Plot */}
          {plot && (
            <p className="text-sm text-white/70 leading-relaxed max-w-lg mb-6 line-clamp-2 md:line-clamp-3">
              {plot}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Ce bouton est posé sur l'affiche du contenu, pas sur le fond de
                l'application : il reste blanc sur noir dans les deux thèmes.
                Les valeurs sont figées volontairement — `bg-white` suit le
                thème et deviendrait presque noir en clair, sur un visuel qui,
                lui, reste sombre. */}
            <Link
              href={href}
              className="flex items-center gap-2 px-6 py-3 bg-[#ffffff] text-[#0b0b0c] text-sm font-bold rounded-xl hover:bg-[#ffffff]/90 transition-all duration-200 shadow-lg"
            >
              <Play className="w-4 h-4 fill-[#0b0b0c]" />
              {watchProgress && watchProgress > 0 ? t('common.resume') : t('common.watch')}
            </Link>

            <button
              type="button"
              aria-pressed={isFav}
              onClick={() => toggleFavorite(item.id, item.mediaType)}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-xl hover:bg-white/15 border border-white/10 transition-all duration-200"
            >
              <Heart className={cn('w-4 h-4', isFav ? 'fill-accent text-accent' : '')} />
              {isFav ? t('common.removed') : t('common.myList')}
            </button>

            <Link
              href={href}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-xl hover:bg-white/15 border border-white/10 transition-all duration-200"
            >
              <Info className="w-4 h-4" />
              {t('common.details')}
            </Link>
          </div>

          {/* Progress bar for watching */}
          {watchProgress !== undefined && watchProgress > 0 && (
            <div className="mt-4 max-w-xs">
              <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${watchProgress}%` }} />
              </div>
              <p className="text-xs text-white/30 mt-1">{t('movies.watchedPercent', { percent: watchProgress })}</p>
            </div>
          )}
        </div>

        {/* Navigation dots */}
        {items.length > 1 && (
          <div className="absolute bottom-4 right-6 md:right-10 flex items-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={t('common.showContent', { index: i + 1, total: items.length })}
                aria-current={i === activeIndex}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === activeIndex ? 'w-5 h-1.5 bg-accent' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                )}
              />
            ))}
          </div>
        )}

        {/* Arrow navigation */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              aria-label={t('common.previousContent')}
              onClick={() => setActiveIndex((i) => (i - 1 + items.length) % items.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/50 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label={t('common.nextContent')}
              onClick={() => setActiveIndex((i) => (i + 1) % items.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/50 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
