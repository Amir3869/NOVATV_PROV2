'use client';

import React, { useState, useMemo } from 'react';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { Skeleton, MediaCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { Star, Film, ChevronLeft } from 'lucide-react';
import { HierarchicalCategoryDirectory } from '@/design-system/components/HierarchicalCategoryDirectory';
import { CatalogRail } from '@/design-system/components/CatalogRail';
import { MovieCard } from '@/design-system/components/MediaCard';
import { VirtualGrid } from '@/design-system/components/VirtualGrid';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { EmptyState } from '@/design-system/components/EmptyState';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { groupByName, RAIL_PREVIEW } from '@/services/catalog/groupByName';
import {
  categoryAndDescendants,
  categoryNodesFromStored,
  type CategoryHierarchyNode,
} from '@/services/catalog/categoryHierarchy';
import { channelMatchesCategory } from '@/services/catalog/categoryMatch';
import { categoryDisplayName } from '@/lib/displayNames';

// La valeur « ALL_CATEGORY » sert de sentinelle interne (jamais affichée) :
// elle ne doit pas être traduite, sinon le filtre casse au changement de langue.
const ALL_CATEGORY = '__all__';
const FAVORITES_CATEGORY = '__favorites__';

export function MoviesPage() {
  const { t } = useTranslation();
  const { movies: allMovies, movieCategories } = useActiveCatalog();
  const favorites = useAppStore((s) => s.favorites);
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const [search, setSearch] = useState('');
  const view = 'grid' as const;
  const [category, setCategory] = useState(ALL_CATEGORY);

  const favoriteMovieIds = useMemo(
    () => new Set(
      favorites
        .filter((favorite) => favorite.mediaType === 'movie' && favorite.profileId === activeProfileId)
        .map((favorite) => favorite.mediaId),
    ),
    [favorites, activeProfileId],
  );

  const uncategorized = t('movies.uncategorized');
  const rails = useMemo(
    () => groupByName(allMovies, (m) => m.categoryName, uncategorized),
    [allMovies, uncategorized],
  );

  const categoryNodes = useMemo<CategoryHierarchyNode[]>(() => {
    const source = movieCategories.length
      ? movieCategories.map((category) => ({
          id: category.id,
          name: category.name,
          count: category.movieCount,
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
            allMovies
              .filter((movie) => movie.categoryId && movie.categoryName)
              .map((movie) => [movie.categoryId!, { id: movie.categoryId!, name: movie.categoryName! }]),
          ).values(),
        ).map((category) => ({ ...category, count: allMovies.filter((movie) => movie.categoryId === category.id).length }));

    const favoritesNode: CategoryHierarchyNode = {
      id: FAVORITES_CATEGORY,
      name: t('common.favorites'),
      originalName: t('common.favorites'),
      parentId: null,
      childIds: [],
      level: 0,
      path: [t('common.favorites')],
      count: allMovies.filter((movie) => favoriteMovieIds.has(movie.id) || movie.isFavorite).length,
      relation: 'flat',
      qualities: [],
    };

    return [favoritesNode, ...categoryNodesFromStored(source, { family: 'movie' })];
  }, [allMovies, favoriteMovieIds, movieCategories, t]);

  const selectedCategoryIds = useMemo(() => {
    if (category === ALL_CATEGORY || category === FAVORITES_CATEGORY) return null;
    return new Set(categoryAndDescendants(categoryNodes, category).map((node) => node.id));
  }, [category, categoryNodes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allMovies.filter((m) => {
      if (category === FAVORITES_CATEGORY) {
        if (!favoriteMovieIds.has(m.id) && !m.isFavorite) return false;
      } else if (selectedCategoryIds) {
        const matchingNode = categoryNodes.find((node) => selectedCategoryIds.has(node.id) && node.id === m.categoryId);
        const matchesId = m.categoryId
          ? [...selectedCategoryIds].some((id) => channelMatchesCategory(m.categoryId, id))
          : false;
        const matchesName = matchingNode ? m.categoryName === matchingNode.name : false;
        if (!matchesId && !matchesName && !m.genre?.includes(category)) return false;
      }
      if (
        search &&
        !m.name.toLowerCase().includes(q) &&
        !m.director?.toLowerCase().includes(q) &&
        !m.cast?.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [search, category, allMovies, favoriteMovieIds, selectedCategoryIds, categoryNodes]);

  // Voir useHydrated : ne pas annoncer « aucun film » avant d'avoir lu
  // les données enregistrées.
  const hydrated = useHydrated();

  const browsing = !search && category === ALL_CATEGORY;

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
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8 md:space-y-10">
      <div className="category-browse-layout category-browse-layout-hierarchical">
        <HierarchicalCategoryDirectory
          title={t('liveTV.categories')}
          subtitle={t('movies.count', { count: allMovies.length })}
          nodes={categoryNodes}
          allId={ALL_CATEGORY}
          allLabel={t('common.all')}
          allCount={allMovies.length}
          activeId={category}
          onSelect={setCategory}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('movies.searchPlaceholder')}
          searchLabel={t('nav.search')}
          labelForNode={(node) => categoryDisplayName(node.id, node.name, categoryRenames)}
          className="mb-4 md:mb-0"
        />
        <div className="catalog-category-content space-y-8 md:space-y-10">

      {browsing ? (
        allMovies.length === 0 ? (
          <EmptyState emoji="🎬" title={t('movies.noResults')} description={t('movies.noResultsDescription')} />
        ) : (
          <VirtualGrid
            items={rails}
            layout="list"
            getKey={(rail) => rail.name}
            renderItem={(rail) => (
              <CatalogRail
                title={rail.name}
                subtitle={t('movies.railCount', { count: rail.items.length })}
                onSeeAll={() => setCategory(categoryNodes.find((node) => node.name === rail.name)?.id ?? rail.name)}
                seeAllLabel={t('common.seeAll')}
              >
                {rail.items.slice(0, RAIL_PREVIEW).map((movie) => (
                  <MovieCard key={movie.id} movie={movie} size="md" />
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
                  : t('movies.allMovies')
              }
              accent
              className="mb-0 min-w-0 flex-1"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState emoji="🎬" title={t('movies.noResults')} description={t('movies.noResultsDescription')} />
          ) : view === 'grid' ? (
            <VirtualGrid
              items={filtered}
              getKey={(movie) => movie.id}
              renderItem={(movie) => <MovieCard movie={movie} size="md" className="w-full" />}
            />
          ) : (
            <VirtualGrid
              items={filtered}
              layout="list"
              getKey={(movie) => movie.id}
              renderItem={(movie) => (
                <Link href={`/movies?id=${encodeURIComponent(movie.id)}`} className="flex gap-4 p-3 rounded-xl hover:bg-white/4 transition-colors group">
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
