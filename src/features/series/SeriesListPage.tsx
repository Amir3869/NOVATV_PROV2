'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { GridPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { SearchBar } from '@/design-system/components/SearchBar';
import { SeriesCard } from '@/design-system/components/MediaCard';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { EmptyState } from '@/design-system/components/EmptyState';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';

// Sentinelle interne : jamais affichée telle quelle, donc jamais traduite.
const ALL_CATEGORY = '__all__';


export function SeriesListPage() {
  const { t } = useTranslation();
  const allSeries = useAppStore((s) => s.series);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORY);

  // Catégories dérivées du catalogue réel, jamais d'une liste figée.
  const CATEGORIES = useMemo(() => {
    const names = new Set<string>();
    for (const item of allSeries) {
      if (item.categoryName) names.add(item.categoryName);
    }
    return [ALL_CATEGORY, ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [allSeries]);

  const filtered = useMemo(() => {
    let series = [...allSeries];
    if (category !== ALL_CATEGORY) {
      series = series.filter((s) => s.categoryName === category || s.genre?.includes(category));
    }
    if (search) {
      const q = search.toLowerCase();
      series = series.filter((s) => s.name.toLowerCase().includes(q) || s.cast?.toLowerCase().includes(q));
    }
    return series;
  }, [search, category, allSeries]);

  const favorites = allSeries.filter((s) => s.isFavorite);
  const inProgress = allSeries.filter((s) => s.lastWatchedEpisodeId);

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <GridPageSkeleton />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">{t('series.title')}</h1>
        <p className="text-sm text-white/40 mt-0.5">{t('series.count', { count: allSeries.length })}</p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder={t('series.searchPlaceholder')} />

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

      {/* In Progress */}
      {!search && category === ALL_CATEGORY && inProgress.length > 0 && (
        <section>
          <SectionHeader title={t('series.inProgress')} accent className="mb-4" />
          <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
            {inProgress.map((s) => <SeriesCard key={s.id} series={s} />)}
          </div>
        </section>
      )}

      {/* Favorites */}
      {!search && category === ALL_CATEGORY && favorites.length > 0 && (
        <section>
          <SectionHeader title={t('series.myFavoriteSeries')} accent className="mb-4" />
          <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
            {favorites.map((s) => <SeriesCard key={s.id} series={s} />)}
          </div>
        </section>
      )}

      {/* All */}
      <section>
        <SectionHeader title={
            search || category !== ALL_CATEGORY
              ? t('common.results', { count: filtered.length })
              : t('series.allSeries')
          } accent className="mb-4" />
        {filtered.length === 0 ? (
          <EmptyState emoji="📺" title={t('series.noResults')} description={t('series.noResultsDescription')} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {filtered.map((s) => <SeriesCard key={s.id} series={s} />)}
          </div>
        )}
      </section>
    </div>
  );
}
