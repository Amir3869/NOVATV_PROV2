'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Edit2, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EmptyState } from '@/design-system/components/EmptyState';
import { ChannelCard } from '@/design-system/components/MediaCard';
import { useAppStore } from '@/store/useAppStore';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { ConfirmDialog } from '@/design-system/components/ConfirmDialog';
import { AppDialog } from '@/design-system/components/AppDialog';
import { AddMediaToListDialog } from '@/design-system/components/AddMediaToListDialog';
import toast from 'react-hot-toast';
import type { CustomList, LiveChannel, Movie, Series } from '@/types';
import { useTranslation } from '@/i18n';

type ListMedia =
  | { mediaType: 'movie'; itemId: string; mediaId: string; data: Movie }
  | { mediaType: 'series'; itemId: string; mediaId: string; data: Series }
  | { mediaType: 'channel'; itemId: string; mediaId: string; data: LiveChannel };

export function CustomListsPage() {
  const { t } = useTranslation();
  const { movies: allMovies, series: allSeries, channels: allChannels } = useActiveCatalog();
  const customLists = useAppStore((s) => s.customLists);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const updateCustomList = useAppStore((s) => s.updateCustomList);
  const deleteCustomList = useAppStore((s) => s.deleteCustomList);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addMediaOpen, setAddMediaOpen] = useState(false);

  const profileLists = customLists.filter((l) => l.profileId === activeProfileId);
  const selectedList = profileLists.find((l) => l.id === selectedListId);

  const getMediaForList = (list: CustomList): ListMedia[] => {
    const resolved: ListMedia[] = [];
    for (const item of list.items) {
      if (item.mediaType === 'movie') {
        const movie = allMovies.find((m) => m.id === item.mediaId);
        if (movie) resolved.push({ mediaType: 'movie', itemId: item.id, mediaId: item.mediaId, data: movie });
      } else if (item.mediaType === 'series') {
        const seriesItem = allSeries.find((s) => s.id === item.mediaId);
        if (seriesItem) resolved.push({ mediaType: 'series', itemId: item.id, mediaId: item.mediaId, data: seriesItem });
      } else if (item.mediaType === 'channel') {
        const channel = allChannels.find((c) => c.id === item.mediaId);
        if (channel) resolved.push({ mediaType: 'channel', itemId: item.id, mediaId: item.mediaId, data: channel });
      }
    }
    return resolved;
  };

  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton rows={4} />;

  return (
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 min-h-11 px-4 py-2.5 bg-accent text-white on-accent text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('lists.newList')}
        </button>
      </div>

      {profileLists.length === 0 ? (
        <EmptyState
          emoji="📋"
          title={t('lists.empty')}
          description={t('lists.noListsDescription')}
          action={{ label: t('lists.create'), onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="space-y-3">
          {profileLists.map((list) => {
            const open = list.id === selectedListId;
            const listHasItems = list.items.length > 0;
            return (
              <div
                key={list.id}
                className="rounded-2xl border border-line bg-surface-1"
              >
                <div className="flex items-center gap-2 px-2 py-1">
                  {open && renaming ? (
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-1 py-1.5">
                      <span className="text-lg flex-shrink-0">{list.icon || '📋'}</span>
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        aria-label={t('lists.name')}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => {
                          const trimmed = draftName.trim();
                          if (trimmed && trimmed !== list.name) {
                            updateCustomList(list.id, { name: trimmed });
                            toast.success(t('lists.renamed'));
                          }
                          setRenaming(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenaming(false);
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white/10 border border-accent/50 text-sm font-medium text-white focus:outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddMediaOpen(false);
                        setRenaming(false);
                        setConfirmDelete(false);
                        setSelectedListId((current) => (current === list.id ? null : list.id));
                      }}
                      className="flex-1 min-w-0 flex items-center gap-3 px-1 py-1.5 text-left"
                    >
                      <span className="text-lg flex-shrink-0">{list.icon || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{list.name}</p>
                        <p className="text-xs text-white/40">
                          {t(list.items.length > 1 ? 'lists.itemCount' : 'lists.itemCountSingular', { count: list.items.length })}
                        </p>
                      </div>
                    </button>
                  )}
                  {open && (
                    <div className="flex gap-1 flex-shrink-0">
                      {listHasItems && (
                        <button
                          type="button"
                          onClick={() => setAddMediaOpen((v) => !v)}
                          className="min-h-11 px-3 rounded-xl bg-accent text-white on-accent text-xs font-semibold hover:bg-accent-hover transition-colors"
                        >
                          {t('lists.manage')}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t('lists.renameList')}
                        disabled={renaming}
                        onClick={() => {
                          setDraftName(list.name);
                          setRenaming(true);
                        }}
                        className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('lists.deleteList')}
                        onClick={() => setConfirmDelete(true)}
                        className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {open && (
                  <div className="border-t border-line px-2 pb-2 pt-1">
                    {!listHasItems ? (
                      <div className="flex justify-center py-6">
                        <button
                          type="button"
                          onClick={() => setAddMediaOpen(true)}
                          className="flex items-center gap-2 min-h-11 px-5 rounded-xl bg-accent text-white on-accent text-sm font-semibold hover:bg-accent-hover transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {t('lists.addContent')}
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-line bg-surface-2 divide-y divide-line">
                        {getMediaForList(list).map((item) => {
                          if (item.mediaType === 'channel') {
                            return (
                              <ChannelCard
                                key={item.itemId}
                                channel={item.data}
                                variant="list"
                                className="rounded-none border-0"
                                listId={list.id}
                              />
                            );
                          }
                          if (item.mediaType === 'movie') {
                            return (
                              <VodListRow
                                key={item.itemId}
                                href={`/movies?id=${encodeURIComponent(item.data.id)}`}
                                image={item.data.logo}
                                name={item.data.name}
                                badge={t('common.badgeMovie')}
                              />
                            );
                          }
                          return (
                            <VodListRow
                              key={item.itemId}
                              href={`/series?id=${encodeURIComponent(item.data.id)}`}
                              image={item.data.cover}
                              name={item.data.name}
                              badge={t('common.badgeSeries')}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

      {showCreate && <CreateListModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); setSelectedListId(id); }} />}
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
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Play className="w-5 h-5 text-white/20" />
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎬');

  const EMOJI_OPTIONS = ['🎬', '🍿', '📺', '⭐', '🏆', '🎭', '🎵', '🌍', '👨‍👩‍👧', '🎯'];

  const handleCreate = () => {
    if (!name.trim()) return;
    const newList = {
      id: `list-${Date.now()}`,
      profileId: activeProfileId ?? 'profile-1',
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
            className="flex-1 min-h-11 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 min-h-11 py-2.5 rounded-xl bg-accent text-white on-accent text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
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
                  'w-11 h-11 rounded-xl text-lg flex items-center justify-center transition-all',
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
            className="w-full min-h-11 px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
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
            className="w-full min-h-11 px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
      </div>
    </AppDialog>
  );
}
