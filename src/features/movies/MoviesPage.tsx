'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { Skeleton, MediaCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { LayoutGrid, List, SlidersHorizontal, Star, Film } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SearchBar } from '@/design-system/components/SearchBar';
import { MovieCard } from '@/design-system/components/MediaCard';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { EmptyState } from '@/design-system/components/EmptyState';
import Link from 'next/link';
import { useTranslation, type MessageKey } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';

// La valeur « ALL_CATEGORY » sert de sentinelle interne (jamais affichée) :
// elle ne doit pas être traduite, sinon le filtre casse au changement de langue.
const ALL_CATEGORY = '__all__';

const SORT_OPTIONS = [
  { value: 'default', labelKey: 'movies.sortDefault' },
  { value: 'rating', labelKey: 'movies.sortRating' },
  { value: 'year', labelKey: 'movies.sortYear' },
  { value: 'name', labelKey: 'movies.sortTitle' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: MessageKey }>;

export function MoviesPage() {
  const { t } = useTranslation();
  const allMovies = useAppStore((s) => s.movies);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [sort, setSort] = useState('default');

  // Les catégories proviennent du catalogue de l'utilisateur : proposer
  // des genres figés afficherait des filtres sans aucun résultat.
  const CATEGORIES = useMemo(() => {
    const names = new Set<string>();
    for (const m of allMovies) {
      if (m.categoryName) names.add(m.categoryName);
    }
    return [ALL_CATEGORY, ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [allMovies]);

  const filtered = useMemo(() => {
    let movies = [...allMovies];
    if (category !== ALL_CATEGORY) {
      movies = movies.filter((m) => m.categoryName === category || m.genre?.includes(category));
    }
    if (search) {
      const q = search.toLowerCase();
      movies = movies.filter((m) => m.name.toLowerCase().includes(q) || m.director?.toLowerCase().includes(q) || m.cast?.toLowerCase().includes(q));
    }
    if (sort === 'rating') movies.sort((a, b) => parseFloat(b.rating ?? '0') - parseFloat(a.rating ?? '0'));
    if (sort === 'year') movies.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    if (sort === 'name') movies.sort((a, b) => a.name.localeCompare(b.name));
    return movies;
  }, [search, category, sort, allMovies]);

  // Voir useHydrated : ne pas annoncer « aucun film » avant d'avoir lu
  // les données enregistrées.
  const hydrated = useHydrated();

  const favorites = allMovies.filter((m) => m.isFavorite);

  if (!hydrated) {
    return (
      <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-8">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">{t('movies.title')}</h1>
        <p className="text-sm text-white/40 mt-0.5">{t('movies.count', { count: allMovies.length })}</p>
      </div>

      {/* Search & View */}
      <div className="flex gap-3 flex-wrap">
        <SearchBar value={search} onChange={setSearch} placeholder={t('movies.searchPlaceholder')} className="flex-1 min-w-48" />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white/6 border border-white/8 text-sm text-white/70 focus:outline-none focus:border-accent/50 cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface-3">{t(o.labelKey)}</option>
          ))}
        </select>

        <div className="flex rounded-xl border border-white/8 overflow-hidden">
          <button onClick={() => setView('grid')} aria-label={t('liveTV.gridView')} className={cn('px-3 py-2.5 transition-colors', view === 'grid' ? 'bg-accent text-white' : 'text-white/40 hover:text-white hover:bg-white/5')}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')} aria-label={t('liveTV.listView')} className={cn('px-3 py-2.5 transition-colors', view === 'list' ? 'bg-accent text-white' : 'text-white/40 hover:text-white hover:bg-white/5')}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              cat === category ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/8'
            )}
          >
            {cat === ALL_CATEGORY ? t('common.all') : cat}
          </button>
        ))}
      </div>

      {/* Favorites */}
      {!search && category === ALL_CATEGORY && favorites.length > 0 && (
        <section>
          <SectionHeader title={t('movies.myFavorites')} accent className="mb-4" />
          <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
            {favorites.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}

      {/* Grid / List */}
      <section>
        <SectionHeader title={
            search || category !== ALL_CATEGORY
              ? t('common.results', { count: filtered.length })
              : t('movies.allMovies')
          } accent className="mb-4" />

        {filtered.length === 0 ? (
          <EmptyState emoji="🎬" title={t('movies.noResults')} description={t('movies.noResultsDescription')} />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {filtered.map((movie) => (
              <MovieCard key={movie.id} movie={movie} size="md" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((movie) => (
              <Link key={movie.id} href={`/movies?id=${encodeURIComponent(movie.id)}`} className="flex gap-4 p-3 rounded-xl hover:bg-white/4 transition-colors group">
                <ImageWithFallback
                  src={movie.logo}
                  alt={movie.name}
                  className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                  fallbackClassName="w-16 h-24 rounded-lg flex-shrink-0 bg-surface-3"
                  fallback={<Film className="w-5 h-5 text-white/20" />}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-white/80 transition-colors">{movie.name}</h3>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {movie.year && <span className="text-xs text-white/40">{movie.year}</span>}
                    {movie.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs text-amber-400">{movie.rating}</span>
                      </div>
                    )}
                    {movie.genre && <span className="text-xs text-white/40">{movie.genre.split(',')[0]}</span>}
                  </div>
                  {movie.plot && <p className="text-xs text-white/50 mt-2 line-clamp-2">{movie.plot}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
