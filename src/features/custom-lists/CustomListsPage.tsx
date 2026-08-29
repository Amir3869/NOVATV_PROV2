'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Play, Film, Tv, BookOpen, GripVertical, X, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from '@/design-system/components/GlassCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { MovieCard, SeriesCard } from '@/design-system/components/MediaCard';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { ConfirmDialog } from '@/design-system/components/ConfirmDialog';
import toast from 'react-hot-toast';
import type { CustomList } from '@/types';
import { useTranslation } from '@/i18n';

export function CustomListsPage() {
  const { t } = useTranslation();
  const allMovies = useAppStore((s) => s.movies);
  const allSeries = useAppStore((s) => s.series);
  const customLists = useAppStore((s) => s.customLists);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const addCustomList = useAppStore((s) => s.addCustomList);
  const updateCustomList = useAppStore((s) => s.updateCustomList);
  const deleteCustomList = useAppStore((s) => s.deleteCustomList);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(customLists[0]?.id ?? null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profileLists = customLists.filter((l) => l.profileId === activeProfileId);
  const selectedList = profileLists.find((l) => l.id === selectedListId);

  const getMediaForList = (list: CustomList) => {
    return list.items.map((item) => {
      if (item.mediaType === 'movie') {
        return { ...allMovies.find((m) => m.id === item.mediaId), mediaType: 'movie' as const, itemId: item.id };
      }
      if (item.mediaType === 'series') {
        return { ...allSeries.find((s) => s.id === item.mediaId), mediaType: 'series' as const, itemId: item.id };
      }
      return null;
    }).filter(Boolean);
  };

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton rows={4} />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">{t('lists.title')}</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {t(profileLists.length > 1 ? 'lists.listCountPlural' : 'lists.listCount', { count: profileLists.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors"
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
        <div className="flex gap-6 flex-col md:flex-row">
          {/* List sidebar */}
          <div className="flex-shrink-0 md:w-56 space-y-1">
            {profileLists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                  list.id === selectedListId ? 'bg-accent/15 border border-accent/20' : 'hover:bg-white/5 border border-transparent'
                )}
              >
                <span className="text-lg flex-shrink-0">{list.icon || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{list.name}</p>
                  <p className="text-xs text-white/40">
                    {t(list.items.length > 1 ? 'lists.itemCount' : 'lists.itemCountSingular', { count: list.items.length })}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* List content */}
          {selectedList && (
            <div className="flex-1 min-w-0">
              <GlassCard variant="glass" padding="none" className="overflow-hidden">
                {/* List header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xl">{selectedList.icon || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      {renaming ? (
                        /* Renommage sur place : Entrée valide, Échap
                           abandonne, la perte du focus vaut validation. */
                        <input
                          type="text"
                          value={draftName}
                          autoFocus
                          aria-label={t('lists.name')}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => {
                            const trimmed = draftName.trim();
                            // Un nom vide rendrait la liste
                            // impossible à retrouver dans la colonne.
                            if (trimmed && trimmed !== selectedList.name) {
                              updateCustomList(selectedList.id, { name: trimmed });
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
                          className="w-full px-2 py-1 rounded-lg bg-white/10 border border-accent/50 text-sm font-bold text-white focus:outline-none"
                        />
                      ) : (
                        <h2 className="font-bold text-white truncate">{selectedList.name}</h2>
                      )}
                      {selectedList.description && !renaming && (
                        <p className="text-xs text-white/40 truncate">{selectedList.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      aria-label={t('lists.renameList')}
                      disabled={renaming}
                      onClick={() => {
                        setDraftName(selectedList.name);
                        setRenaming(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('lists.deleteList')}
                      onClick={() => setConfirmDelete(true)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* La suppression était immédiate, sans le moindre
                    avertissement : un clic de travers effaçait une
                    liste patiemment constituée, sans retour possible. */}
                <ConfirmDialog
                  open={confirmDelete}
                  title={t('lists.deleteTitle', { name: selectedList.name })}
                  message={t('lists.deleteMessage')}
                  confirmLabel={t('common.delete')}
                  onConfirm={() => {
                    deleteCustomList(selectedList.id);
                    setSelectedListId(
                      profileLists.find((l) => l.id !== selectedList.id)?.id ?? null
                    );
                    setConfirmDelete(false);
                    toast.success(t('lists.deleted'));
                  }}
                  onCancel={() => setConfirmDelete(false)}
                />

                {/* Items */}
                <div className="p-4">
                  {selectedList.items.length === 0 ? (
                    <EmptyState emoji="➕" title={t('lists.emptyList')} description={t('lists.emptyListDescription')} size="sm" />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {getMediaForList(selectedList).map((item) => {
                        if (!item || !item.id) return null;
                        return item.mediaType === 'movie' ? (
                          <MovieCard key={item.itemId} movie={item as typeof allMovies[0]} />
                        ) : (
                          <SeriesCard key={item.itemId} series={item as typeof allSeries[0]} />
                        );
                      })}
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && <CreateListModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); setSelectedListId(id); }} />}
    </div>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassCard variant="dark" padding="lg" className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{t('lists.newList')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-2">{t('common.icon')}</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={icon === e}
                  onClick={() => setIcon(e)}
                  className={cn('w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all', icon === e ? 'bg-accent/20 ring-1 ring-accent' : 'bg-white/5 hover:bg-white/10')}
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
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">{t('lists.description')} {t('common.optional')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('lists.descriptionPlaceholder')}
              maxLength={60}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 transition-all">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {t('common.create')}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
