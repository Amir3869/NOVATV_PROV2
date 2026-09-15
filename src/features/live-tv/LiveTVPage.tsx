'use client';

import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { ChannelCard } from '@/design-system/components/MediaCard';
import { BroadcastChannelCard } from '@/design-system/components/BroadcastChannelCard';
import { CatalogToolbar } from '@/design-system/components/CatalogToolbar';
import { EmptyState } from '@/design-system/components/EmptyState';
import { VirtualGrid } from '@/design-system/components/VirtualGrid';
import { SearchBar } from '@/design-system/components/SearchBar';
import { AppDialog } from '@/design-system/components/AppDialog';
import { useAppStore } from '@/store/useAppStore';
import { resolveProfileId } from '@/lib/profileScope';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { useClock } from '@/hooks/useClock';
import { Skeleton, ChannelCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { categoryDisplayName, channelDisplayName } from '@/lib/displayNames';
import { CategoryRenamePanel } from '@/features/categories/CategoryRenamePanel';
import { useParental } from '@/features/parental/ParentalProvider';
import { useTranslation } from '@/i18n';
import { cn } from '@/utils/cn';
import {
  EMPTY_CATEGORY_IDS,
  layoutCategories,
} from '@/services/catalog/categoryLayout';
import { channelMatchesCategory } from '@/services/catalog/categoryMatch';
import { enrichLiveChannels } from '@/services/epg/epgSync';

/** Sentinelle interne : afficher toutes les chaînes, pas la page d'arrivée. */
const ALL_CHANNELS = '__all__';

export function LiveTVPage() {
  const { t } = useTranslation();
  const { channels: allChannels, epgPrograms: allPrograms, liveCategories: allCategories } = useActiveCatalog();
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const catalogReady = useAppStore((s) => s.catalogReady);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showCategories, setShowCategories] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickSearch, setPickSearch] = useState('');
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

  const enrichedChannels = useMemo(
    () => enrichLiveChannels(allChannels, allPrograms, nowMs),
    [allChannels, allPrograms, nowMs]
  );

  const favoriteChannelIds = favorites
    .filter((f) => f.mediaType === 'channel' && f.profileId === activeProfileId)
    .map((f) => f.mediaId);

  const filtered = useMemo(() => {
    let result = enrichedChannels;
    if (activeCategory && activeCategory !== ALL_CHANNELS) {
      result = result.filter((ch) => channelMatchesCategory(ch.categoryId, activeCategory));
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
  }, [enrichedChannels, activeCategory, search, categoryRenames, channelRenames]);

  const hydrated = useHydrated();

  const laidOutCategories = useMemo(() => {
    const { pinned, rest } = layoutCategories(allCategories, categoryPins, categoryOrder);
    return [...pinned, ...rest].filter((cat) =>
      allChannels.some((ch) => channelMatchesCategory(ch.categoryId, cat.id))
    );
  }, [allCategories, categoryPins, categoryOrder, allChannels]);
  const pinnedIds = useMemo(() => new Set(categoryPins), [categoryPins]);

  const toolbarCategories = useMemo(
    () =>
      laidOutCategories.map((cat) => ({
        id: cat.id,
        label: categoryDisplayName(cat.id, cat.name, categoryRenames),
        blocked: isCategoryBlocked(cat),
        pinned: pinnedIds.has(cat.id),
      })),
    [laidOutCategories, categoryRenames, isCategoryBlocked, pinnedIds],
  );

  const extraCategory = useMemo(() => {
    if (!activeCategory || activeCategory === ALL_CHANNELS) return null;
    return toolbarCategories.find((cat) => cat.id === activeCategory && !cat.pinned) ?? null;
  }, [activeCategory, toolbarCategories]);

  const restCount = toolbarCategories.filter((cat) => !cat.pinned).length;

  const channelCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const ch of allChannels) {
      if (!ch.categoryId) continue;
      map.set(ch.categoryId, (map.get(ch.categoryId) ?? 0) + 1);
    }
    return map;
  }, [allChannels]);

  const pickerCategories = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    if (!q) return toolbarCategories;
    return toolbarCategories.filter((cat) => cat.label.toLowerCase().includes(q));
  }, [toolbarCategories, pickSearch]);

  const favoriteChannels = enrichedChannels.filter((ch) => favoriteChannelIds.includes(ch.id));
  const recentChannels = enrichedChannels.filter((ch) => ch.isRecent);
  const landing = !search && !activeCategory;
  const showCatalog = Boolean(search) || activeCategory != null;

  const applyCategory = (id: string | null, toggleIfSame: boolean) => {
    if (id && id !== ALL_CHANNELS) {
      const cat = allCategories.find((c) => c.id === id);
      if (cat && isCategoryBlocked(cat)) {
        void ensureUnlocked();
        return;
      }
    }
    setActiveCategory(toggleIfSame && id === activeCategory ? null : id);
    setShowPicker(false);
    setPickSearch('');
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
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8 md:space-y-10">
      <AppDialog
        open={showCategories}
        onClose={() => setShowCategories(false)}
        title={t('liveTV.myCategories')}
        description={t('liveTV.myCategoriesHint')}
        size="lg"
      >
        <CategoryRenamePanel
          categories={laidOutCategories}
          title={t('liveTV.myCategories')}
          hint={t('liveTV.myCategoriesHint')}
        />
      </AppDialog>

      <AppDialog
        open={showPicker}
        onClose={() => {
          setShowPicker(false);
          setPickSearch('');
        }}
        title={t('liveTV.pickCategory')}
        size="md"
      >
        <SearchBar
          value={pickSearch}
          onChange={setPickSearch}
          placeholder={t('liveTV.pickCategorySearch')}
          className="mb-3"
        />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => applyCategory(ALL_CHANNELS, false)}
            className={cn(
              'flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeCategory === ALL_CHANNELS
                ? 'bg-accent text-white'
                : 'text-white/80 hover:bg-surface-3',
            )}
          >
            <span>{t('liveTV.allChannels')}</span>
            <span className="text-xs opacity-70">{allChannels.length}</span>
          </button>
          {pickerCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => applyCategory(cat.id, false)}
              className={cn(
                'flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                cat.id === activeCategory
                  ? 'bg-accent text-white'
                  : 'text-white/80 hover:bg-surface-3',
                cat.blocked && 'opacity-70',
              )}
            >
              {cat.blocked && <Lock className="h-3.5 w-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate text-start">{cat.label}</span>
              <span className="shrink-0 text-xs opacity-70">
                {t('liveTV.categoryChannelCount', {
                  count: channelCountByCategory.get(cat.id) ?? 0,
                })}
              </span>
            </button>
          ))}
          {pickerCategories.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-white/40">{t('playlists.categoriesNoMatch')}</p>
          )}
        </div>
      </AppDialog>

      <CatalogToolbar
        allLabel={t('liveTV.allCategories')}
        categories={toolbarCategories}
        activeId={activeCategory && activeCategory !== ALL_CHANNELS ? activeCategory : null}
        onSelect={(id) => {
          if (id) {
            applyCategory(id, true);
            return;
          }
          setActiveCategory(null);
        }}
        onManage={() => setShowCategories(true)}
        manageLabel={t('liveTV.manageCategories')}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('liveTV.searchPlaceholder')}
        searchLabel={t('nav.search')}
        view={view}
        onViewChange={setView}
        listLabel={t('liveTV.listView')}
        gridLabel={t('liveTV.gridView')}
        pinsPlus
        extraCategory={extraCategory}
        moreLabel={t('liveTV.moreCategories')}
        moreCount={restCount}
        onMore={() => setShowPicker(true)}
        moreOpen={showPicker}
      />

      {landing && favoriteChannels.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('liveTV.myFavoriteChannels')} accent className="mb-3" />
          {view === 'list' ? (
            <div className="space-y-1">
              {favoriteChannels.map((ch) => (
                <BroadcastChannelCard key={ch.id} channel={ch} from="favorites" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {favoriteChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="grid" from="favorites" />
              ))}
            </div>
          )}
        </section>
      )}

      {landing && recentChannels.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('liveTV.recent')} accent className="mb-3" />
          {view === 'list' ? (
            <div className="space-y-1">
              {recentChannels.map((ch) => (
                <BroadcastChannelCard key={ch.id} channel={ch} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {recentChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="grid" />
              ))}
            </div>
          )}
        </section>
      )}

      {landing && favoriteChannels.length === 0 && recentChannels.length === 0 && (
        <EmptyState
          emoji="📡"
          title={t('liveTV.chooseCategory')}
          description={t('liveTV.chooseCategoryDescription')}
          action={{ label: t('liveTV.moreCategories'), onClick: () => setShowPicker(true) }}
        />
      )}

      {showCatalog && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader
            title={
              search || (activeCategory && activeCategory !== ALL_CHANNELS)
                ? t('common.results', { count: filtered.length })
                : t('liveTV.catalogStats', {
                    categories: laidOutCategories.length,
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
              layout={view === 'list' ? 'list' : 'grid'}
              getKey={(ch) => ch.id}
              renderItem={(ch) =>
                view === 'list' ? (
                  <BroadcastChannelCard
                    channel={ch}
                    categoryId={
                      activeCategory && activeCategory !== ALL_CHANNELS ? activeCategory : undefined
                    }
                  />
                ) : (
                  <ChannelCard
                    channel={ch}
                    variant="grid"
                    className="w-full"
                    categoryId={
                      activeCategory && activeCategory !== ALL_CHANNELS ? activeCategory : undefined
                    }
                  />
                )
              }
            />
          )}
        </section>
      )}
    </div>
  );
}
