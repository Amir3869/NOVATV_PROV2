'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { Skeleton, MediaCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { Star, Film } from 'lucide-react';
import { CatalogToolbar } from '@/design-system/components/CatalogToolbar';
import { MovieCard } from '@/design-system/components/MediaCard';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { EmptyState } from '@/design-system/components/EmptyState';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';

// La valeur « ALL_CATEGORY » sert de sentinelle interne (jamais affichée) :
// elle ne doit pas être traduite, sinon le filtre casse au changement de langue.
const ALL_CATEGORY = '__all__';

export function MoviesPage() {
  const { t } = useTranslation();
  const allMovies = useAppStore((s) => s.movies);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [category, setCategory] = useState(ALL_CATEGORY);

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
    return movies;
  }, [search, category, allMovies]);

  // Voir useHydrated : ne pas annoncer « aucun film » avant d'avoir lu
  // les données enregistrées.
  const hydrated = useHydrated();


  if (!hydrated) {
    return (
      <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-10 md:space-y-12">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-10 md:space-y-12">
      <CatalogToolbar
        allLabel={t('common.all')}
        categories={CATEGORIES.filter((cat) => cat !== ALL_CATEGORY).map((cat) => ({
          id: cat,
          label: cat,
        }))}
        activeId={category === ALL_CATEGORY ? null : category}
        onSelect={(id) => setCategory(id ?? ALL_CATEGORY)}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('movies.searchPlaceholder')}
        searchLabel={t('nav.search')}
        view={view}
        onViewChange={setView}
        listLabel={t('liveTV.listView')}
        gridLabel={t('liveTV.gridView')}
      />


      {/* Grid / List */}
      <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
        <SectionHeader title={
            search || category !== ALL_CATEGORY
              ? t('common.results', { count: filtered.length })
              : t('movies.allMovies')
          } accent className="mb-4" />

        {filtered.length === 0 ? (
          <EmptyState emoji="🎬" title={t('movies.noResults')} description={t('movies.noResultsDescription')} />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-x-4 md:gap-y-10">
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
