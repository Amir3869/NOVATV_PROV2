'use client';

import React, { useState, useMemo } from 'react';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { GridPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { CatalogToolbar } from '@/design-system/components/CatalogToolbar';
import { CatalogRail } from '@/design-system/components/CatalogRail';
import { SeriesCard } from '@/design-system/components/MediaCard';
import { VirtualGrid } from '@/design-system/components/VirtualGrid';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { EmptyState } from '@/design-system/components/EmptyState';
import { useTranslation } from '@/i18n';
import { ChevronLeft, Tv } from 'lucide-react';
import Link from 'next/link';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { groupByName, RAIL_PREVIEW } from '@/services/catalog/groupByName';

// Sentinelle interne : jamais affichée telle quelle, donc jamais traduite.
const ALL_CATEGORY = '__all__';


export function SeriesListPage() {
  const { t } = useTranslation();
  const { series: allSeries } = useActiveCatalog();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const uncategorized = t('series.uncategorized');
  const rails = useMemo(
    () => groupByName(allSeries, (item) => item.categoryName, uncategorized),
    [allSeries, uncategorized],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allSeries.filter((s) => {
      if (category !== ALL_CATEGORY && s.categoryName !== category && !s.genre?.includes(category)) {
        return false;
      }
      if (search && !s.name.toLowerCase().includes(q) && !s.cast?.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, category, allSeries]);

  const inProgress = allSeries.filter((s) => s.lastWatchedEpisodeId);
  const browsing = !search && category === ALL_CATEGORY;

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <GridPageSkeleton />;

  return (
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8 md:space-y-10">
      <CatalogToolbar
        heading={t('series.title')}
        hideCategories
        allLabel={t('common.all')}
        categories={[]}
        activeId={null}
        onSelect={() => {}}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('series.searchPlaceholder')}
        searchLabel={t('nav.search')}
        view={view}
        onViewChange={setView}
        listLabel={t('liveTV.listView')}
        gridLabel={t('liveTV.gridView')}
      />

      {browsing && inProgress.length > 0 && (
        <CatalogRail title={t('series.inProgress')}>
          {inProgress.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </CatalogRail>
      )}

      {browsing ? (
        allSeries.length === 0 ? (
          <EmptyState emoji="📺" title={t('series.noResults')} description={t('series.noResultsDescription')} />
        ) : (
          <VirtualGrid
            items={rails}
            layout="list"
            getKey={(rail) => rail.name}
            renderItem={(rail) => (
              <CatalogRail
                title={rail.name}
                subtitle={t('series.railCount', { count: rail.items.length })}
                onSeeAll={() => setCategory(rail.name)}
                seeAllLabel={t('common.seeAll')}
              >
                {rail.items.slice(0, RAIL_PREVIEW).map((item) => (
                  <SeriesCard key={item.id} series={item} />
                ))}
              </CatalogRail>
            )}
          />
        )
      ) : (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            {category !== ALL_CATEGORY && !search && (
              <button
                type="button"
                onClick={() => setCategory(ALL_CATEGORY)}
                className="flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-white/60 transition hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                {t('common.back')}
              </button>
            )}
            <SectionHeader
              title={
                search || category !== ALL_CATEGORY
                  ? t('common.results', { count: filtered.length })
                  : t('series.allSeries')
              }
              accent
              className="mb-0 min-w-0 flex-1"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState emoji="📺" title={t('series.noResults')} description={t('series.noResultsDescription')} />
          ) : view === 'grid' ? (
            <VirtualGrid
              items={filtered}
              getKey={(s) => s.id}
              renderItem={(s) => <SeriesCard series={s} className="w-full" />}
            />
          ) : (
            <VirtualGrid
              items={filtered}
              layout="list"
              getKey={(item) => item.id}
              renderItem={(item) => (
                <Link href={`/series?id=${encodeURIComponent(item.id)}`} className="group flex gap-4 rounded-xl p-3 transition-colors hover:bg-surface-2">
                  <ImageWithFallback src={item.cover} alt={item.name} className="h-24 w-16 flex-shrink-0 rounded-lg object-cover" fallbackClassName="h-24 w-16 flex-shrink-0 rounded-lg bg-surface-3" fallback={<Tv className="h-5 w-5 text-white/20" />} />
                  <div className="min-w-0 flex-1"><h3 className="font-semibold text-white group-hover:text-white/80">{item.name}</h3><p className="mt-1 line-clamp-1 text-xs text-white/40">{item.genre || item.cast || ''}</p></div>
                </Link>
              )}
            />
          )}
        </section>
      )}
    </div>
  );
}
