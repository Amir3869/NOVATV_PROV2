'use client';

import React, { useState, useMemo } from 'react';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { ChannelCard } from '@/design-system/components/MediaCard';
import { CatalogToolbar } from '@/design-system/components/CatalogToolbar';
import { EmptyState } from '@/design-system/components/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { resolveProfileId } from '@/lib/profileScope';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { Skeleton, ChannelCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { categoryDisplayName, channelDisplayName } from '@/lib/displayNames';
import { CategoryRenamePanel } from '@/features/categories/CategoryRenamePanel';
import { AppDialog } from '@/design-system/components/AppDialog';
import { useParental } from '@/features/parental/ParentalProvider';
import { useTranslation } from '@/i18n';
import {
  EMPTY_CATEGORY_IDS,
  layoutCategories,
} from '@/services/catalog/categoryLayout';

export function LiveTVPage() {
  const { t } = useTranslation();
  const { channels: allChannels, epgPrograms: allPrograms, liveCategories: allCategories } = useActiveCatalog();
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const catalogReady = useAppStore((s) => s.catalogReady);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showCategories, setShowCategories] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const favorites = useAppStore((s) => s.favorites);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const firstProfileId = useAppStore((s) => s.profiles[0]?.id);
  const profileId = resolveProfileId(activeProfileId, firstProfileId);
  const categoryPins = useAppStore((s) => s.categoryPins[profileId] ?? EMPTY_CATEGORY_IDS);
  const categoryOrder = useAppStore((s) => s.categoryOrder[profileId] ?? EMPTY_CATEGORY_IDS);
  // Verrou parental des catégories : une catégorie sous cadenas ne
  // s'ouvre pas tant que le code n'a pas été saisi (session).
  const { isCategoryBlocked, ensureUnlocked } = useParental();

  // Enrich channels with EPG
  const enrichedChannels = useMemo(() => {
    return allChannels.map((ch) => ({
      ...ch,
      currentProgram: allPrograms.find((p) => p.channelId === ch.id && new Date(p.start) <= new Date() && new Date(p.stop) >= new Date()),
    }));
  }, [allChannels, allPrograms]);

  const favoriteChannelIds = favorites
    .filter((f) => f.mediaType === 'channel' && f.profileId === activeProfileId)
    .map((f) => f.mediaId);

  const filtered = useMemo(() => {
    let result = enrichedChannels;
    if (activeCategory) {
      result = result.filter((ch) => ch.categoryId === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((ch) => {
        // La recherche se fait sur les noms **affichés** : un surnom
        // doit être trouvable, sinon l'utilisateur cherche « Sport » et
        // rien n'apparaît après l'avoir renommée.
        const name = channelDisplayName(ch.id, ch.name, channelRenames);
        const catName = ch.categoryId && ch.categoryName
          ? categoryDisplayName(ch.categoryId, ch.categoryName, categoryRenames)
          : ch.categoryName;
        return name.toLowerCase().includes(q) || catName?.toLowerCase().includes(q);
      });
    }
    return result;
  }, [enrichedChannels, activeCategory, search, categoryRenames, channelRenames]);

  // Tant que les données enregistrées ne sont pas relues, on affiche un
  // gabarit plutôt qu'une liste vide qui donnerait l'impression que le
  // catalogue a disparu.
  const hydrated = useHydrated();

  const laidOutCategories = useMemo(() => {
    const { pinned, rest } = layoutCategories(allCategories, categoryPins, categoryOrder);
    return [...pinned, ...rest];
  }, [allCategories, categoryPins, categoryOrder]);
  const pinnedIds = useMemo(() => new Set(categoryPins), [categoryPins]);

  const favoriteChannels = enrichedChannels.filter((ch) => favoriteChannelIds.includes(ch.id));
  const recentChannels = enrichedChannels.filter((ch) => ch.isRecent);

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

      <CatalogToolbar
        allLabel={t('liveTV.allCategories')}
        categories={laidOutCategories.map((cat) => ({
          id: cat.id,
          label: categoryDisplayName(cat.id, cat.name, categoryRenames),
          blocked: isCategoryBlocked(cat),
          pinned: pinnedIds.has(cat.id),
        }))}
        activeId={activeCategory}
        onSelect={(id) => {
          if (id) {
            const cat = allCategories.find((c) => c.id === id);
            // Une catégorie verrouillée demande le code avant de s'ouvrir.
            if (cat && isCategoryBlocked(cat)) {
              void ensureUnlocked();
              return;
            }
            setActiveCategory(id === activeCategory ? null : id);
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
      />

      {/* Favorites section */}
      {!search && !activeCategory && favoriteChannels.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('liveTV.myFavoriteChannels')} accent className="mb-3" />
          {view === 'list' ? (
            <div className="space-y-1">
              {favoriteChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="list" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {favoriteChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="grid" />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent section */}
      {!search && !activeCategory && recentChannels.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
          <SectionHeader title={t('liveTV.recent')} accent className="mb-3" />
          {view === 'list' ? (
            <div className="space-y-1">
              {recentChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="list" />
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

      {/* All channels */}
      <section className="rounded-3xl border border-line bg-surface-1 p-4 sm:p-5">
        <SectionHeader
          title={
            search || activeCategory
              ? t('common.results', { count: filtered.length })
              : t('liveTV.channelCount', { count: filtered.length })
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
        ) : view === 'list' ? (
          <div className="space-y-1">
            {filtered.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="list" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="grid" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
