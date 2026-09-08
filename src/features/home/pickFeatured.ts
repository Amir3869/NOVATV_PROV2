/**
 * Choix des contenus du grand bandeau Accueil.
 *
 * Avant : uniquement la note Xtream, top 5. Beaucoup de notes vides
 * valent 0, et l'affiche large (`backdrop`) n'arrive souvent qu'à
 * l'ouverture de la fiche — le hero montrait un poster minuscule
 * ou rien.
 *
 * Ordre : un visuel d'abord (backdrop / cover / logo), puis la date
 * d'ajout (plus récent en premier). La note n'entre plus dans le tri.
 */

import type { Movie, Series } from '@/types';

export type FeaturedItem = (Movie | Series) & { mediaType: 'movie' | 'series' };

export function hasHeroVisual(item: Movie | Series): boolean {
  if ('backdrop' in item && item.backdrop) return true;
  if ('cover' in item && item.cover) return true;
  if ('logo' in item && item.logo) return true;
  return false;
}

export function addedMs(item: { addedAt?: string }): number {
  if (!item.addedAt) return 0;
  const parsed = Date.parse(item.addedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickFeatured(
  movies: readonly Movie[],
  series: readonly Series[],
  limit = 5
): FeaturedItem[] {
  const all: FeaturedItem[] = [
    ...movies.map((movie) => ({ ...movie, mediaType: 'movie' as const })),
    ...series.map((item) => ({ ...item, mediaType: 'series' as const })),
  ];
  return all
    .sort((a, b) => {
      const visual = Number(hasHeroVisual(b)) - Number(hasHeroVisual(a));
      if (visual !== 0) return visual;
      return addedMs(b) - addedMs(a);
    })
    .slice(0, limit);
}
