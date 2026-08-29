'use client';

import React, { useState, useMemo } from 'react';
import { LayoutGrid, List, Lock, Settings2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { ChannelCard } from '@/design-system/components/MediaCard';
import { SearchBar } from '@/design-system/components/SearchBar';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Badge } from '@/design-system/components/Badge';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { Skeleton, ChannelCardSkeleton } from '@/design-system/components/LoadingSkeleton';
import { categoryDisplayName, channelDisplayName } from '@/lib/displayNames';
import { CategoryRenamePanel } from '@/features/categories/CategoryRenamePanel';
import { useParental } from '@/features/parental/ParentalProvider';
import Link from 'next/link';
import { useTranslation } from '@/i18n';

export function LiveTVPage() {
  const { t } = useTranslation();
  const allChannels = useAppStore((s) => s.channels);
  const allPrograms = useAppStore((s) => s.epgPrograms);
  const allCategories = useAppStore((s) => s.liveCategories);
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showCategories, setShowCategories] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const favorites = useAppStore((s) => s.favorites);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
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

  const favoriteChannels = enrichedChannels.filter((ch) => favoriteChannelIds.includes(ch.id));
  const recentChannels = enrichedChannels.filter((ch) => ch.isRecent);

  if (!hydrated) {
    return (
      <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-8">
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
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">{t('liveTV.title')}</h1>
          <p className="text-sm text-white/40 mt-0.5">{t('liveTV.channelCount', { count: allChannels.length })}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCategories((v) => !v)}
            aria-expanded={showCategories}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              showCategories
                ? 'bg-accent text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/8'
            )}
          >
            <Settings2 className="w-4 h-4" />
            {t('liveTV.manageCategories')}
          </button>
          <Badge variant="live" size="md" pulse>{t('common.live')}</Badge>
        </div>
      </div>

      {showCategories && (
        <CategoryRenamePanel
          categories={allCategories}
          title={t('liveTV.myCategories')}
          hint={t('liveTV.myCategoriesHint')}
        />
      )}

      {/* Search & Controls */}
      <div className="flex gap-3 flex-wrap">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('liveTV.searchPlaceholder')}
          className="flex-1 min-w-48"
        />
        <div className="flex rounded-xl border border-white/8 overflow-hidden">
          <button
            onClick={() => setView('list')}
            aria-label={t('liveTV.listView')}
            className={cn('px-3 py-2.5 transition-colors', view === 'list' ? 'bg-accent text-white' : 'text-white/40 hover:text-white hover:bg-white/5')}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            aria-label={t('liveTV.gridView')}
            className={cn('px-3 py-2.5 transition-colors', view === 'grid' ? 'bg-accent text-white' : 'text-white/40 hover:text-white hover:bg-white/5')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
            !activeCategory ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/8'
          )}
        >
          {t('liveTV.allCategories')}
        </button>
        {allCategories.map((cat) => {
          const blocked = isCategoryBlocked(cat);
          return (
            <button
              key={cat.id}
              onClick={() => {
                // Une catégorie verrouillée demande le code avant de
                // s'ouvrir. Le code déjà saisi ceci fait permet.
                if (blocked) {
                  void ensureUnlocked();
                  return;
                }
                setActiveCategory(cat.id === activeCategory ? null : cat.id);
              }}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                cat.id === activeCategory ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/8',
                blocked && 'opacity-70'
              )}
            >
              {blocked && <Lock className="w-3 h-3 mr-1.5 inline -mt-0.5" />}
              {categoryDisplayName(cat.id, cat.name, categoryRenames)}
            </button>
          );
        })}
      </div>

      {/* Favorites section */}
      {!search && !activeCategory && favoriteChannels.length > 0 && (
        <section>
          <SectionHeader title={t('liveTV.myFavoriteChannels')} accent className="mb-3" />
          {view === 'list' ? (
            <div className="space-y-1">
              {favoriteChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="list" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {favoriteChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="grid" />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent section */}
      {!search && !activeCategory && recentChannels.length > 0 && (
        <section>
          <SectionHeader title={t('liveTV.recent')} accent className="mb-3" />
          {view === 'list' ? (
            <div className="space-y-1">
              {recentChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="list" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {recentChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} variant="grid" />
              ))}
            </div>
          )}
        </section>
      )}

      {/* All channels */}
      <section>
        <SectionHeader
          title={
            search || activeCategory
              ? t('common.results', { count: filtered.length })
              : t('liveTV.allChannels')
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="grid" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
