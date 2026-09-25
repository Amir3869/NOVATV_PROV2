'use client';

import React, { useState, useMemo } from 'react';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { GridPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { HierarchicalCategoryDirectory } from '@/design-system/components/HierarchicalCategoryDirectory';
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
import {
  categoryAndDescendants,
  categoryNodesFromStored,
  type CategoryHierarchyNode,
} from '@/services/catalog/categoryHierarchy';
import { channelMatchesCategory } from '@/services/catalog/categoryMatch';
import { categoryDisplayName } from '@/lib/displayNames';

// Sentinelle interne : jamais affichée telle quelle, donc jamais traduite.
const ALL_CATEGORY = '__all__';
const FAVORITES_CATEGORY = '__favorites__';


export function SeriesListPage() {
  const { t } = useTranslation();
  const { series: allSeries, seriesCategories } = useActiveCatalog();
  const favorites = useAppStore((s) => s.favorites);
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [mobileCategoryDirectoryOpen, setMobileCategoryDirectoryOpen] = useState(true);
  const view = 'grid' as const;

  const favoriteSeriesIds = useMemo(
    () => new Set(
      favorites
        .filter((favorite) => favorite.mediaType === 'series' && favorite.profileId === activeProfileId)
        .map((favorite) => favorite.mediaId),
    ),
    [favorites, activeProfileId],
  );

  const uncategorized = t('series.uncategorized');
  const rails = useMemo(
    () => groupByName(allSeries, (item) => item.categoryName, uncategorized),
    [allSeries, uncategorized],
  );

  const categoryNodes = useMemo<CategoryHierarchyNode[]>(() => {
    const source = seriesCategories.length
      ? seriesCategories.map((category) => ({
          id: category.id,
          name: category.name,
          count: category.seriesCount,
          parentId: category.parentId,
          childIds: category.childIds,
          level: category.level,
          path: category.path,
          relation: category.relation,
          originalName: category.originalName,
          regionCode: category.regionCode,
          qualities: category.qualities,
        }))
      : Array.from(
          new Map(
            allSeries
              .filter((item) => item.categoryId && item.categoryName)
              .map((item) => [item.categoryId!, { id: item.categoryId!, name: item.categoryName! }]),
          ).values(),
        ).map((category) => ({ ...category, count: allSeries.filter((item) => item.categoryId === category.id).length }));

    const favoritesNode: CategoryHierarchyNode = {
      id: FAVORITES_CATEGORY,
      name: t('common.favorites'),
      originalName: t('common.favorites'),
      parentId: null,
      childIds: [],
      level: 0,
      path: [t('common.favorites')],
      count: allSeries.filter((item) => favoriteSeriesIds.has(item.id) || item.isFavorite).length,
      relation: 'flat',
      qualities: [],
    };

    return [favoritesNode, ...categoryNodesFromStored(source, { family: 'series' })];
  }, [allSeries, favoriteSeriesIds, seriesCategories, t]);

  const selectedCategoryIds = useMemo(() => {
    if (category === ALL_CATEGORY || category === FAVORITES_CATEGORY) return null;
    return new Set(categoryAndDescendants(categoryNodes, category).map((node) => node.id));
  }, [category, categoryNodes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allSeries.filter((s) => {
      if (category === FAVORITES_CATEGORY) {
        if (!favoriteSeriesIds.has(s.id) && !s.isFavorite) return false;
      } else if (selectedCategoryIds) {
        const matchesId = s.categoryId
          ? [...selectedCategoryIds].some((id) => channelMatchesCategory(s.categoryId!, id))
          : false;
        const matchesName = [...selectedCategoryIds]
          .map((id) => categoryNodes.find((node) => node.id === id)?.name)
          .some((name) => name === s.categoryName);
        if (!matchesId && !matchesName && !s.genre?.includes(category)) return false;
      }
      if (search && !s.name.toLowerCase().includes(q) && !s.cast?.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, category, allSeries, favoriteSeriesIds, selectedCategoryIds, categoryNodes]);

  const inProgress = allSeries.filter((s) => s.lastWatchedEpisodeId);
  const browsing = !search && category === ALL_CATEGORY;
  const selectCategory = (id: string) => {
    setCategory(id);
    setMobileCategoryDirectoryOpen(false);
  };

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <GridPageSkeleton />;

  return (
    <div className="catalog-page min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8 md:space-y-10">
      <div className={`category-browse-layout category-browse-layout-hierarchical ${!mobileCategoryDirectoryOpen ? 'category-directory-collapsed' : ''}`}>
        <HierarchicalCategoryDirectory
          title={t('liveTV.categories')}
          subtitle={t('series.count', { count: allSeries.length })}
          nodes={categoryNodes}
          allId={ALL_CATEGORY}
          allLabel={t('common.all')}
          allCount={allSeries.length}
          activeId={category}
          onSelect={selectCategory}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('series.searchPlaceholder')}
          searchLabel={t('nav.search')}
          labelForNode={(node) => categoryDisplayName(node.id, node.name, categoryRenames)}
          className="mb-4 md:mb-0"
        />
        <div className="catalog-category-content space-y-8 md:space-y-10">
          <button
            type="button"
            onClick={() => setMobileCategoryDirectoryOpen(true)}
            className="category-mobile-selection"
          >
            <ChevronLeft className="h-4 w-4 shrink-0 rtl:rotate-180" />
            <span className="truncate">
              {category === ALL_CATEGORY
                ? t('common.all')
                : category === FAVORITES_CATEGORY
                  ? t('common.favorites')
                  : categoryDisplayName(
                      category,
                      categoryNodes.find((node) => node.id === category)?.name ?? t('liveTV.categories'),
                      categoryRenames,
                    )}
            </span>
          </button>

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
                onSeeAll={() => setCategory(categoryNodes.find((node) => node.name === rail.name)?.id ?? rail.name)}
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
                className="category-inline-back flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-white/60 transition hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      </div>
    </div>
  );
}
