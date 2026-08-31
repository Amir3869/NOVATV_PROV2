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
import { LayoutGrid, List, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';

// Sentinelle interne : jamais affichée telle quelle, donc jamais traduite.
const ALL_CATEGORY = '__all__';


export function SeriesListPage() {
  const { t } = useTranslation();
  const allSeries = useAppStore((s) => s.series);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showSeriesSearch, setShowSeriesSearch] = useState(false);

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
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-10 md:space-y-12">
      <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface-1 p-3 sm:p-4">
        {showSeriesSearch && (
          <SearchBar value={search} onChange={setSearch} placeholder={t('series.searchPlaceholder')} className="min-w-0 flex-1" />
        )}
        <div className="ml-auto flex shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-2">
          <button type="button" onClick={() => setShowSeriesSearch((v) => !v)} aria-label={t('nav.search')} aria-expanded={showSeriesSearch} className={cn('px-3 py-2.5 transition-colors', showSeriesSearch ? 'bg-accent text-white' : 'text-white/50 hover:bg-surface-3 hover:text-white')}><Search className="h-4 w-4" /></button>
          <button type="button" onClick={() => setView('list')} aria-label={t('liveTV.listView')} className={cn('px-3 py-2.5 transition-colors', view === 'list' ? 'bg-accent text-white' : 'text-white/40 hover:bg-surface-3 hover:text-white')}><List className="h-4 w-4" /></button>
          <button type="button" onClick={() => setView('grid')} aria-label={t('liveTV.gridView')} className={cn('px-3 py-2.5 transition-colors', view === 'grid' ? 'bg-accent text-white' : 'text-white/40 hover:bg-surface-3 hover:text-white')}><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'flex-shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
              cat === category ? 'bg-accent text-white' : 'bg-surface-2 text-white/60 hover:bg-surface-3 hover:text-white border border-line'
            )}
          >
            {cat === ALL_CATEGORY ? t('common.all') : cat}
          </button>
        ))}
      </div>

      {/* In Progress */}
      {!search && category === ALL_CATEGORY && inProgress.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('series.inProgress')} accent className="mb-4" />
          <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
            {inProgress.map((s) => <SeriesCard key={s.id} series={s} />)}
          </div>
        </section>
      )}


      {/* All */}
      <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
        <SectionHeader title={
            search || category !== ALL_CATEGORY
              ? t('common.results', { count: filtered.length })
              : t('series.allSeries')
          } accent className="mb-4" />
        {filtered.length === 0 ? (
          <EmptyState emoji="📺" title={t('series.noResults')} description={t('series.noResultsDescription')} />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-x-4 md:gap-y-10">
            {filtered.map((s) => <SeriesCard key={s.id} series={s} />)}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <Link key={item.id} href={`/series?id=${encodeURIComponent(item.id)}`} className="group flex gap-4 rounded-xl p-3 transition-colors hover:bg-surface-2">
                <ImageWithFallback src={item.cover} alt={item.name} className="h-24 w-16 flex-shrink-0 rounded-lg object-cover" fallbackClassName="h-24 w-16 flex-shrink-0 rounded-lg bg-surface-3" fallback={<Tv className="h-5 w-5 text-white/20" />} />
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-white group-hover:text-white/80">{item.name}</h3><p className="mt-1 line-clamp-1 text-xs text-white/40">{item.genre || item.cast || ''}</p></div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
