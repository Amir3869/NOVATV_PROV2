'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Lock, Pencil, RotateCcw, Search, Tv } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { GlassCard } from '@/design-system/components/GlassCard';
import { Badge } from '@/design-system/components/Badge';
import { useAppStore } from '@/store/useAppStore';
import { categoryDisplayName, channelDisplayName } from '@/lib/displayNames';
import { CategoryRenameDialog } from './CategoryRenameDialog';
import { ChannelRenameDialog } from '@/features/live-tv/ChannelRenameDialog';
import { useParental } from '@/features/parental/ParentalProvider';
import { categoryLockKey, channelLockKey } from '@/lib/pin';
import type { LiveCategory, LiveChannel } from '@/types';
import { useTranslation } from '@/i18n';

/**
 * Gestion du catalogue d'une source : un seul écran, navigable.
 *
 * ── Pourquoi remplacer les deux panneaux ? ─────────────────────
 * Avant, « catégories » et « chaînes » étaient deux blocs séparés,
 * dupliqués et démesurés (impossible de retrouver une chaîne parmi
 * 30 000). Ici on navigue par niveau dans un **accordéon** :
 *
 *   Source → Catégorie (chevron) → chaînes de la catégorie
 *
 * On clique sur le chevron d'une catégorie pour déplier **ses** chaînes
 * juste en dessous. On peut alors verrouiller / renommer la catégorie
 * entière, ou bien une chaîne isolée.
 *
 * ── Verrouillage ────────────────────────────────────────────────
 * Le cadenas d'une catégorie verrouille toute la catégorie ; le nom
 * affiche une pastille « verrouillée ». Le cadenas d'une chaîne ne
 * verrouille que cette chaîne. Les deux passent par le code PIN
 * (`useParental`), et l'élément verrouillé est légèrement estompé.
 */
export function CatalogManager({
  categories,
  channels,
  title,
  hint,
}: {
  /** Catégories de la source (déjà filtrées par l'appelant). */
  categories: LiveCategory[];
  /** Toutes les chaînes de la source (pour déplier une catégorie). */
  channels: LiveChannel[];
  /** Titre du panneau, traduit par l'appelant. */
  title: string;
  /** Texte d'introduction, traduit par l'appelant. */
  hint: string;
}) {
  const { t } = useTranslation();
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const renameCategory = useAppStore((s) => s.renameCategory);
  const renameChannel = useAppStore((s) => s.renameChannel);
  const lockedItems = useAppStore((s) => s.lockedItems);
  const { toggleLock } = useParental();
  const [query, setQuery] = useState('');
  const [editingCat, setEditingCat] = useState<LiveCategory | null>(null);
  const [editingChannel, setEditingChannel] = useState<LiveChannel | null>(null);
  // Quelles catégories sont dépliées (clés `categoryLockKey`).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return categories;
    const q = query.toLowerCase();
    return categories.filter((c) => {
      const display = categoryDisplayName(c.id, c.name, categoryRenames);
      return display.toLowerCase().includes(q);
    });
  }, [categories, query, categoryRenames]);

  const channelsOf = useMemo(() => {
    const map = new Map<string, LiveChannel[]>();
    for (const ch of channels) {
      // Une chaîne sans catégorie (groupe vide) est rangée sous ''.
      const key = ch.categoryId ?? '';
      const list = map.get(key) ?? [];
      list.push(ch);
      map.set(key, list);
    }
    return map;
  }, [channels]);

  const renameCategoryRow = (cat: LiveCategory, name: string) => {
    renameCategory(cat.id, name);
    if (name.trim()) {
      toast.success(t('liveTV.renamedCategory', { name: name.trim() }));
    } else {
      toast.success(t('liveTV.restoredCategory', { name: cat.name }));
    }
  };

  const renameChannelRow = (ch: LiveChannel, name: string) => {
    renameChannel(ch.id, name);
    if (name.trim()) {
      toast.success(t('liveTV.renamedChannel', { name: name.trim() }));
    } else {
      toast.success(t('liveTV.restoredChannel', { name: ch.name }));
    }
  };

  const isCatLocked = (cat: LiveCategory) =>
    lockedItems.includes(categoryLockKey(cat.playlistId, cat.id));

  const isChannelLocked = (ch: LiveChannel) =>
    lockedItems.includes(channelLockKey(ch.id));

  const toggleExpand = (cat: LiveCategory) => {
    const key = categoryLockKey(cat.playlistId, cat.id);
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <GlassCard variant="dark" padding="md" className="mb-6">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm text-white/40 mt-0.5">{hint}</p>
      </div>

      <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 mb-3">
        <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('playlists.sourceCategoriesSearch')}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none min-w-0"
        />
      </div>

      {filteredCategories.length === 0 ? (
        <p className="text-sm text-white/40">{t('liveTV.noCategories')}</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {filteredCategories.map((cat) => {
            const catDisplay = categoryDisplayName(cat.id, cat.name, categoryRenames);
            const catRenamed = catDisplay !== cat.name;
            const catLocked = isCatLocked(cat);
            const catKey = categoryLockKey(cat.playlistId, cat.id);
            const isOpen = Boolean(expanded[catKey]);
            const catChannels = channelsOf.get(String(cat.id)) ?? [];

            return (
              <li key={cat.id}>
                {/* ── Ligne catégorie : nom + pastille + actions ── */}
                <div className="flex items-center gap-3 py-2.5">
                  {/* Chevron dépliant les chaînes de la catégorie. */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? t('parental.collapseCategory') : t('parental.expandCategory')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-180')} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate flex items-center gap-2',
                        catRenamed ? 'text-white' : 'text-white/85',
                        catLocked && 'opacity-60'
                      )}
                    >
                      {catDisplay}
                      {catLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent/10 px-2 py-0.5 rounded-full flex-shrink-0">
                          <Lock className="w-3 h-3" />
                          {t('parental.locked')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/35">{t('liveTV.categoryChannelCount', { count: cat.channelCount })}</p>
                  </div>

                  {/* Cadenas catégorie : verrouille toute la catégorie. */}
                  <button
                    type="button"
                    onClick={() => toggleLock(catKey)}
                    aria-label={catLocked ? t('parental.unlock') : t('parental.lock')}
                    aria-pressed={catLocked}
                    title={catLocked ? t('parental.unlock') : t('parental.lock')}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      catLocked
                        ? 'bg-accent/15 text-accent hover:bg-accent/25'
                        : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'
                    )}
                  >
                    <Lock className="w-4 h-4" />
                  </button>

                  {catRenamed && (
                    <button
                      type="button"
                      onClick={() => renameCategoryRow(cat, '')}
                      aria-label={t('liveTV.restoreCategoryName')}
                      title={t('liveTV.restoreCategoryName')}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors flex-shrink-0"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setEditingCat(cat)}
                    aria-label={t('liveTV.renameCategory')}
                    title={t('liveTV.renameCategory')}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Chaînes de la catégorie (dépliées) ── */}
                {isOpen && (
                  <div className="pb-2 pl-11">
                    {catChannels.length === 0 ? (
                      <p className="text-xs text-white/30 py-2">{t('liveTV.noChannels')}</p>
                    ) : (
                      <ul className="divide-y divide-white/5">
                        {catChannels.map((ch) => {
                          const chDisplay = channelDisplayName(ch.id, ch.name, channelRenames);
                          const chRenamed = chDisplay !== ch.name;
                          const chLocked = isChannelLocked(ch);
                          return (
                            <li key={ch.id} className="flex items-center gap-3 py-2">
                              <div className="w-12 h-8 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {ch.logo ? (
                                  <img
                                    src={ch.logo}
                                    alt={chDisplay}
                                    className="max-h-6 max-w-11 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Tv className="w-4 h-4 text-white/25" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p
                                  className={cn(
                                    'text-sm font-medium truncate flex items-center gap-1.5',
                                    chRenamed ? 'text-white' : 'text-white/80',
                                    chLocked && 'opacity-60'
                                  )}
                                >
                                  {chDisplay}
                                  {chLocked && <Lock className="w-3 h-3 text-accent flex-shrink-0" />}
                                </p>
                              </div>

                              {/* Cadenas chaîne : ne verrouille que cette chaîne. */}
                              <button
                                type="button"
                                onClick={() => toggleLock(channelLockKey(ch.id))}
                                aria-label={chLocked ? t('parental.unlock') : t('parental.lock')}
                                aria-pressed={chLocked}
                                title={chLocked ? t('parental.unlock') : t('parental.lock')}
                                className={cn(
                                  'w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                                  chLocked
                                    ? 'bg-accent/15 text-accent hover:bg-accent/25'
                                    : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'
                                )}
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>

                              {chRenamed && (
                                <button
                                  type="button"
                                  onClick={() => renameChannelRow(ch, '')}
                                  aria-label={t('liveTV.restoreChannelName')}
                                  title={t('liveTV.restoreChannelName')}
                                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors flex-shrink-0"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setEditingChannel(ch)}
                                aria-label={t('liveTV.renameChannel')}
                                title={t('liveTV.renameChannel')}
                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors flex-shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editingCat && (
        <CategoryRenameDialog
          initialName={categoryDisplayName(editingCat.id, editingCat.name, categoryRenames)}
          onSubmit={(name) => renameCategoryRow(editingCat, name)}
          onClose={() => setEditingCat(null)}
        />
      )}

      {editingChannel && (
        <ChannelRenameDialog
          initialName={channelDisplayName(editingChannel.id, editingChannel.name, channelRenames)}
          onSubmit={(name) => renameChannelRow(editingChannel, name)}
          onClose={() => setEditingChannel(null)}
        />
      )}
    </GlassCard>
  );
}
