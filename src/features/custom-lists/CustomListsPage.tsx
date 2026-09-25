'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Edit2, Film, Grid2X2, Plus, Play, Radio, Search, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EmptyState } from '@/design-system/components/EmptyState';
import { ChannelCard, MovieCard, SeriesCard } from '@/design-system/components/MediaCard';
import { VirtualGrid } from '@/design-system/components/VirtualGrid';
import { useAppStore } from '@/store/useAppStore';
import { resolveProfileId } from '@/lib/profileScope';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { resolveListItems } from '@/features/custom-lists/resolveListMedia';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { ConfirmDialog } from '@/design-system/components/ConfirmDialog';
import { AppDialog } from '@/design-system/components/AppDialog';
import { AddMediaToListDialog } from '@/design-system/components/AddMediaToListDialog';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import toast from 'react-hot-toast';
import { useTranslation } from '@/i18n';

export function CustomListsPage() {
  const { t } = useTranslation();
  const {
    channels: allChannels,
    movies: allMovies,
    series: allSeries,
  } = useActiveCatalog();
  const catalogReady = useAppStore((s) => s.catalogReady);
  const customLists = useAppStore((s) => s.customLists);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const firstProfileId = useAppStore((s) => s.profiles[0]?.id);
  const updateCustomList = useAppStore((s) => s.updateCustomList);
  const deleteCustomList = useAppStore((s) => s.deleteCustomList);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'channel' | 'movie' | 'series'>('all');

  const profileId = resolveProfileId(activeProfileId, firstProfileId);
  const profileLists = customLists.filter((l) => l.profileId === profileId);
  const selectedList = profileLists.find((l) => l.id === selectedListId) ?? profileLists[0];
  const resolvedSelectedListId = selectedList?.id ?? null;

  const resolvedItems = selectedList
    ? resolveListItems(selectedList, {
        channels: allChannels,
        movies: allMovies,
        series: allSeries,
      })
    : [];
  // Une liste mono-famille n'a pas besoin d'onglets de filtre : son contenu
  // indique déjà le type de média. Pour une liste mixte, on ne propose que
  // les familles réellement présentes, avec « Tous » en tête.
  const presentFamilies = new Set(resolvedItems.map((item) => item.mediaType));
  const familyFilterIds: Array<'all' | 'channel' | 'movie' | 'series'> =
    presentFamilies.size > 1
      ? [
          'all',
          ...(['channel', 'movie', 'series'] as const).filter((family) => presentFamilies.has(family)),
        ]
      : [];
  const effectiveMediaFilter = familyFilterIds.includes(mediaFilter) ? mediaFilter : 'all';
  const filteredItems = effectiveMediaFilter === 'all'
    ? resolvedItems
    : resolvedItems.filter((item) => item.mediaType === effectiveMediaFilter);

  const hydrated = useHydrated();

  const selectList = (listId: string) => {
    setAddMediaOpen(false);
    setRenaming(false);
    setConfirmDelete(false);
    setMediaFilter('all');
    setSelectedListId(listId);
    setMobileDirectoryOpen(false);
  };

  const commitRename = () => {
    if (!selectedList) return;
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== selectedList.name) {
      updateCustomList(selectedList.id, { name: trimmed });
      toast.success(t('lists.renamed'));
    }
    setRenaming(false);
  };

  if (!hydrated || !catalogReady) return <ListPageSkeleton rows={4} />;

  return (
    <div className="lists-page min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10">
      {profileLists.length === 0 ? (
        <EmptyState
          emoji="📋"
          title={t('lists.empty')}
          description={t('lists.noListsDescription')}
          action={{ label: t('lists.create'), onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className={cn('lists-browse-layout', !mobileDirectoryOpen && 'lists-directory-collapsed')}>
          <aside className="lists-directory min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-white">{t('lists.title')}</h2>
                <p className="mt-0.5 text-xs text-white/40">
                  {t(profileLists.length === 1 ? 'lists.listCount' : 'lists.listCountPlural', { count: profileLists.length })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                aria-label={t('lists.newList')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="lists-directory-list">
              {profileLists.map((list) => {
                const active = list.id === resolvedSelectedListId;
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => selectList(list.id)}
                    aria-pressed={active}
                    className={cn(
                      'lists-directory-item flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      active
                        ? 'lists-directory-item-active border-s-2 border-accent bg-accent/15 text-white'
                        : 'text-white/70 hover:bg-surface-2 hover:text-white',
                    )}
                  >
                    <span className="lists-directory-item-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg">
                      {list.icon || '📋'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{list.name}</span>
                      <span className="block truncate text-xs text-white/40">
                        {t(list.items.length === 1 ? 'lists.itemCountSingular' : 'lists.itemCount', { count: list.items.length })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="lists-content min-w-0">
            {!selectedList ? (
              <section className="flex min-h-72 items-center justify-center rounded-3xl border border-line bg-surface-1 p-6 text-center">
                <div className="max-w-sm">
                  <Grid2X2 className="mx-auto mb-4 h-8 w-8 text-accent/70" />
                  <h2 className="text-lg font-bold text-white">{t('lists.selectList')}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">{t('lists.selectListDescription')}</p>
                </div>
              </section>
            ) : (
              <>
                <div className="lists-mobile-content-header">
                  <button
                    type="button"
                    onClick={() => setMobileDirectoryOpen(true)}
                    aria-label={t('common.back')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
                  </button>
                  <span className="lists-mobile-content-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-lg">
                    {selectedList.icon || '📋'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold text-white">{selectedList.name}</h2>
                    <p className="truncate text-xs text-white/45">
                      {t(selectedList.items.length === 1 ? 'lists.itemCountSingular' : 'lists.itemCount', { count: selectedList.items.length })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={t('lists.addContent')}
                      onClick={() => setAddMediaOpen(true)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('lists.renameList')}
                      onClick={() => {
                        setDraftName(selectedList.name);
                        setRenaming(true);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('lists.deleteList')}
                      onClick={() => setConfirmDelete(true)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-white/40 transition hover:bg-red-900/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <section className="lists-content-header lists-desktop-content-header mb-5 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-xl">
                      {selectedList.icon || '📋'}
                    </span>
                    {renaming ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        aria-label={t('lists.name')}
                        onChange={(event) => setDraftName(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitRename();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            setRenaming(false);
                          }
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-accent/50 bg-white/10 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-bold text-white">{selectedList.name}</h2>
                        <p className="text-xs text-white/45">
                          {t(selectedList.items.length === 1 ? 'lists.itemCountSingular' : 'lists.itemCount', { count: selectedList.items.length })}
                        </p>
                      </div>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAddMediaOpen(true)}
                        className="hidden min-h-11 rounded-xl bg-accent px-3 text-xs font-semibold text-white on-accent transition hover:bg-accent-hover sm:inline-flex sm:items-center sm:gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        {t('lists.addContent')}
                      </button>
                      <button
                        type="button"
                        aria-label={t('lists.renameList')}
                        onClick={() => {
                          setDraftName(selectedList.name);
                          setRenaming(true);
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/45 transition hover:bg-white/10 hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('lists.deleteList')}
                        onClick={() => setConfirmDelete(true)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/35 transition hover:bg-red-900/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>

                {familyFilterIds.length > 0 && (
                  <div className="lists-filter-bar mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label={t('lists.title')}>
                    {familyFilterIds.map((id) => {
                      const filter = id === 'all'
                        ? { label: t('common.all'), icon: Grid2X2 }
                        : id === 'channel'
                          ? { label: t('lists.channelsTab'), icon: Radio }
                          : id === 'movie'
                            ? { label: t('lists.moviesTab'), icon: Film }
                            : { label: t('lists.seriesTab'), icon: BookOpen };
                      const Icon = filter.icon;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={effectiveMediaFilter === id}
                          onClick={() => setMediaFilter(id)}
                          className={cn(
                            'lists-family-filter flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:gap-2',
                            effectiveMediaFilter === id ? 'border-accent/40 bg-accent/15 text-white' : 'border-line text-white/45 hover:bg-white/5 hover:text-white/80',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{filter.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!selectedList.items.length ? (
                  <EmptyState
                    emoji="📋"
                    title={t('lists.emptyList')}
                    description={t('lists.emptyListDescription')}
                    action={{ label: t('lists.addContent'), onClick: () => setAddMediaOpen(true) }}
                  />
                ) : filteredItems.length === 0 ? (
                  <EmptyState emoji="🔎" title={t('lists.noneFound')} description={t('lists.searchPlaceholder')} />
                ) : (
                  <VirtualGrid
                    className="lists-media-grid"
                    items={filteredItems}
                    getKey={(item) => item.itemId}
                    renderItem={(item) => {
                      if (item.status === 'missing') {
                        return (
                          <div className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border border-line bg-surface-1 p-4 text-center">
                            <Search className="mb-2 h-5 w-5 text-white/25" />
                            <p className="text-xs text-white/45">{t('lists.missingFromCatalog')}</p>
                          </div>
                        );
                      }
                      if (item.mediaType === 'channel') {
                        return <ChannelCard channel={item.data} variant="grid" className="w-full" listId={selectedList.id} />;
                      }
                      if (item.mediaType === 'movie') {
                        return <MovieCard movie={item.data} className="w-full" />;
                      }
                      return <SeriesCard series={item.data} className="w-full" />;
                    }}
                  />
                )}
              </>
            )}
          </main>
        </div>
      )}

      {selectedList && (
        <ConfirmDialog
          open={confirmDelete}
          title={t('lists.deleteTitle', { name: selectedList.name })}
          message={t('lists.deleteMessage')}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            deleteCustomList(selectedList.id);
            setSelectedListId(null);
            setConfirmDelete(false);
            toast.success(t('lists.deleted'));
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {selectedList && (
        <AddMediaToListDialog
          open={addMediaOpen}
          listId={selectedList.id}
          onClose={() => setAddMediaOpen(false)}
        />
      )}

      {showCreate && <CreateListModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); selectList(id); }} />}
    </div>
  );
}

function VodListRow({
  href,
  image,
  name,
  badge,
}: {
  href: string;
  image?: string;
  name: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/5"
    >
      <div className="w-16 h-10 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {image ? (
          <ImageWithFallback
            src={image}
            alt={name}
            className="h-full w-full object-cover"
            fallbackClassName="h-full w-full"
            fallback={<Play className="h-5 w-5 text-white/20" />}
          />
        ) : (
          <Play className="h-5 w-5 text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-white/40">{badge}</p>
      </div>
    </Link>
  );
}

function CreateListModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const addCustomList = useAppStore((s) => s.addCustomList);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const firstProfileId = useAppStore((s) => s.profiles[0]?.id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎬');

  const EMOJI_OPTIONS = ['🎬', '🍿', '📺', '⭐', '🏆', '🎭', '🎵', '🌍', '👨‍👩‍👧', '🎯'];

  const handleCreate = () => {
    if (!name.trim()) return;
    const newList = {
      id: `list-${Date.now()}`,
      profileId: resolveProfileId(activeProfileId, firstProfileId),
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addCustomList(newList);
    onCreated(newList.id);
  };

  return (
    <AppDialog
      open
      onClose={onClose}
      title={t('lists.newList')}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/8 bg-white/5 py-2.5 text-sm text-white/60 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-semibold text-white on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            {t('common.create')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-2">{t('common.icon')}</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={icon === e}
                onClick={() => setIcon(e)}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  icon === e ? 'bg-accent/20 ring-1 ring-accent' : 'bg-white/5 hover:bg-white/10',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">{t('common.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('lists.defaultName')}
            maxLength={30}
            className="w-full min-h-11 px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/40 transition-all"
          />
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
            {t('lists.description')} {t('common.optional')}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('lists.descriptionPlaceholder')}
            maxLength={60}
            className="w-full min-h-11 px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/40 transition-all"
          />
        </div>
      </div>
    </AppDialog>
  );
}
