'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { ChannelCard } from '@/design-system/components/MediaCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { VirtualGrid } from '@/design-system/components/VirtualGrid';
import { AppDialog } from '@/design-system/components/AppDialog';
import { HierarchicalCategoryDirectory } from '@/design-system/components/HierarchicalCategoryDirectory';
import { useAppStore } from '@/store/useAppStore';
import { resolveProfileId } from '@/lib/profileScope';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { useClock } from '@/hooks/useClock';
import { Skeleton, ChannelCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { categoryDisplayName, channelDisplayName } from '@/lib/displayNames';
import { categoryLockKey } from '@/lib/pin';
import { CategoryRenamePanel } from '@/features/categories/CategoryRenamePanel';
import { useParental } from '@/features/parental/ParentalProvider';
import { useTranslation } from '@/i18n';
import { EMPTY_CATEGORY_IDS } from '@/services/catalog/categoryLayout';
import { channelMatchesCategory } from '@/services/catalog/categoryMatch';
import {
  buildCategoryHierarchy,
  categoryAndDescendants,
  type CategoryHierarchyNode,
} from '@/services/catalog/categoryHierarchy';
import { enrichLiveChannels } from '@/services/epg/epgSync';

/** Sentinelle interne : afficher toutes les chaînes, pas la page d'arrivée. */
const ALL_CHANNELS = '__all__';

export function LiveTVPage() {
  const { t } = useTranslation();
  const { channels: allChannels, epgPrograms: allPrograms, liveCategories: allCategories } = useActiveCatalog();
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const lockedItems = useAppStore((s) => s.lockedItems);
  const sessionUnlocked = useAppStore((s) => s.sessionUnlocked);
  const catalogReady = useAppStore((s) => s.catalogReady);
  const [showCategories, setShowCategories] = useState(false);
  const [mobileCategoryDirectoryOpen, setMobileCategoryDirectoryOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const favorites = useAppStore((s) => s.favorites);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const firstProfileId = useAppStore((s) => s.profiles[0]?.id);
  const profileId = resolveProfileId(activeProfileId, firstProfileId);
  const categoryPins = useAppStore((s) => s.categoryPins[profileId] ?? EMPTY_CATEGORY_IDS);
  const categoryOrder = useAppStore((s) => s.categoryOrder[profileId] ?? EMPTY_CATEGORY_IDS);
  const { isCategoryBlocked, ensureUnlocked } = useParental();
  const nowMs = useClock();
  const effectiveActiveCategory =
    activeCategory ?? (catalogReady && allChannels.length > 0 ? ALL_CHANNELS : null);

  const enrichedChannels = useMemo(
    () => enrichLiveChannels(allChannels, allPrograms, nowMs),
    [allChannels, allPrograms, nowMs]
  );

  // Les sources anciennes peuvent ne pas encore avoir les métadonnées
  // hiérarchiques persistées. On reconstruit alors un arbre de secours
  // à partir des noms, sans modifier le catalogue d'origine.
  const categoryNodes = useMemo<CategoryHierarchyNode[]>(() => {
    const hasPersistedHierarchy = allCategories.some(
      (category) =>
        category.relation !== undefined ||
        category.childIds !== undefined ||
        category.level !== undefined,
    );

    if (hasPersistedHierarchy) {
      const visibleIds = new Set(allCategories.map((category) => category.id));
      return allCategories.map((category) => {
        // L'import Xtream peut masquer un parent technique sans flux
        // direct (`FR`) tout en conservant son parentId pour la sélection
        // des descendants et l'EPG. Dans l'annuaire, un enfant dont le
        // parent n'est plus visible doit devenir une racine : sinon la
        // colonne des parents est vide et les vraies catégories restent
        // bloquées dans un second niveau inaccessible.
        const hasVisibleParent = Boolean(
          category.parentId && visibleIds.has(category.parentId),
        );
        const parentId = hasVisibleParent ? category.parentId : undefined;
        const childIds = (category.childIds ?? []).filter((id) => visibleIds.has(id));

        return {
          id: category.id,
          sourceId: category.id,
          name: category.name,
          originalName: category.originalName ?? category.name,
          parentId: parentId ?? null,
          childIds,
          level: parentId ? category.level ?? 0 : 0,
          path: parentId ? category.path ?? [category.name] : [category.name],
          count: category.channelCount,
          relation: parentId ? category.relation ?? 'flat' : 'flat',
          regionCode: category.regionCode,
          qualities: category.qualities ?? [],
        };
      });
    }

    return buildCategoryHierarchy(
      allCategories.map((category) => ({
        id: category.id,
        name: category.name,
        count: category.channelCount,
        parentId: category.parentId,
      })),
      { family: 'live' },
    );
  }, [allCategories]);

  const selectedCategoryIds = useMemo(() => {
    if (!effectiveActiveCategory || effectiveActiveCategory === ALL_CHANNELS) return null;
    return new Set(
      categoryAndDescendants(categoryNodes, effectiveActiveCategory).map((node) => node.id),
    );
  }, [categoryNodes, effectiveActiveCategory]);

  const favoriteChannelIds = favorites
    .filter((f) => f.mediaType === 'channel' && f.profileId === activeProfileId)
    .map((f) => f.mediaId);

  const filtered = useMemo(() => {
    let result = enrichedChannels;
    if (selectedCategoryIds) {
      result = result.filter((ch) =>
        [...selectedCategoryIds].some((categoryId) =>
          channelMatchesCategory(ch.categoryId, categoryId),
        ),
      );
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((ch) => {
        const name = channelDisplayName(ch.id, ch.name, channelRenames);
        const catName = ch.categoryId && ch.categoryName
          ? categoryDisplayName(ch.categoryId, ch.categoryName, categoryRenames)
          : ch.categoryName;
        return name.toLowerCase().includes(q) || catName?.toLowerCase().includes(q);
      });
    }
    return result;
  }, [enrichedChannels, selectedCategoryIds, search, categoryRenames, channelRenames]);

  const hydrated = useHydrated();
  const managementCategories = useMemo(
    () =>
      categoryNodes.map((node) => ({
        id: node.id,
        name: node.name,
        originalName: node.originalName,
        channelCount: node.count,
        playlistId: allCategories[0]?.playlistId ?? '',
        parentId: node.parentId ?? undefined,
        childIds: node.childIds,
        level: node.level,
      })),
    [allCategories, categoryNodes],
  );

  const favoriteChannels = enrichedChannels.filter((ch) => favoriteChannelIds.includes(ch.id));
  const recentChannels = enrichedChannels.filter((ch) => ch.isRecent);
  const landing = !search && !effectiveActiveCategory;
  const showCatalog = Boolean(search) || effectiveActiveCategory != null;

  const isNodeBlocked = (node: CategoryHierarchyNode): boolean => {
    const descendants = categoryAndDescendants(categoryNodes, node.id);
    const ancestorIds = new Set<string>();
    let parentId = node.parentId;
    while (parentId) {
      ancestorIds.add(parentId);
      parentId = categoryNodes.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }

    return [...descendants, ...categoryNodes.filter((candidate) => ancestorIds.has(candidate.id))].some(
      (candidate) => {
        const category = allCategories.find((item) => item.id === candidate.id);
        if (category && isCategoryBlocked(category)) return true;
        const playlistId = category?.playlistId ?? allCategories[0]?.playlistId;
        return Boolean(
          !sessionUnlocked &&
            playlistId &&
            lockedItems.includes(categoryLockKey(playlistId, candidate.id)),
        );
      },
    );
  };

  const applyCategory = (id: string | null) => {
    if (id && id !== ALL_CHANNELS) {
      const node = categoryNodes.find((candidate) => candidate.id === id);
      if (node && isNodeBlocked(node)) {
        void ensureUnlocked();
        return;
      }
    }
    setActiveCategory(id);
    setMobileCategoryDirectoryOpen(false);
  };

  if (!hydrated || !catalogReady) {
    return (
      <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8 md:space-y-10">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="live-tv-page min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8 md:space-y-10">
      <AppDialog
        open={showCategories}
        onClose={() => setShowCategories(false)}
        title={t('liveTV.myCategories')}
        description={t('liveTV.myCategoriesHint')}
        size="lg"
      >
        <CategoryRenamePanel
          categories={managementCategories}
          profileId={profileId}
          title={t('liveTV.myCategories')}
          hint={t('liveTV.myCategoriesHint')}
        />
      </AppDialog>

      <div className={`category-browse-layout category-browse-layout-hierarchical ${!mobileCategoryDirectoryOpen ? 'category-directory-collapsed' : ''}`}>
        <HierarchicalCategoryDirectory
          title={t('liveTV.categories')}
          subtitle={t('liveTV.catalogStats', {
            categories: categoryNodes.length,
            channels: allChannels.length,
          })}
          nodes={categoryNodes}
          allId={ALL_CHANNELS}
          allLabel={t('liveTV.allCategories')}
          allCount={allChannels.length}
          activeId={effectiveActiveCategory}
          pinnedIds={categoryPins}
          orderIds={categoryOrder}
          onSelect={(id) => applyCategory(id)}
          onManage={() => setShowCategories(true)}
          manageLabel={t('liveTV.manageCategories')}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('liveTV.searchPlaceholder')}
          searchLabel={t('nav.search')}
          labelForNode={(node) => categoryDisplayName(node.id, node.name, categoryRenames)}
          isBlocked={isNodeBlocked}
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
              {effectiveActiveCategory && effectiveActiveCategory !== ALL_CHANNELS
                ? categoryDisplayName(
                    effectiveActiveCategory,
                    categoryNodes.find((node) => node.id === effectiveActiveCategory)?.name ?? t('liveTV.categories'),
                    categoryRenames,
                  )
                : t('liveTV.allCategories')}
            </span>
          </button>

      {landing && favoriteChannels.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('liveTV.myFavoriteChannels')} accent className="mb-3" />
          <div className="live-channel-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {favoriteChannels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="grid" from="favorites" />
            ))}
          </div>
        </section>
      )}

      {landing && recentChannels.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('liveTV.recent')} accent className="mb-3" />
          <div className="live-channel-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {recentChannels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="grid" />
            ))}
          </div>
        </section>
      )}

      {landing && favoriteChannels.length === 0 && recentChannels.length === 0 && (
        <EmptyState
          emoji="📡"
          title={t('liveTV.chooseCategory')}
          description={t('liveTV.chooseCategoryDescription')}
          action={{ label: t('liveTV.allChannels'), onClick: () => applyCategory(ALL_CHANNELS) }}
        />
      )}

      {showCatalog && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader
            title={
              search || (effectiveActiveCategory && effectiveActiveCategory !== ALL_CHANNELS)
                ? t('common.results', { count: filtered.length })
                : t('liveTV.catalogStats', {
                    categories: categoryNodes.length,
                    channels: allChannels.length,
                  })
            }
            accent
            className="mb-3"
          />

          {filtered.length === 0 ? (
            <EmptyState
              emoji="📡"
              title={t('liveTV.noChannelsFound')}
              description={t('liveTV.noChannelsFoundDescription')}
              action={{ label: t('liveTV.managePlaylists'), onClick: () => {} }}
            />
          ) : (
            <VirtualGrid
              items={filtered}
              layout="grid"
              className="live-channel-grid"
              getKey={(ch) => ch.id}
              renderItem={(ch) => (
                <ChannelCard
                  channel={ch}
                  variant="grid"
                  className="w-full"
                  categoryId={
                    effectiveActiveCategory && effectiveActiveCategory !== ALL_CHANNELS ? effectiveActiveCategory : undefined
                  }
                />
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
