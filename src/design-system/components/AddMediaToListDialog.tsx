'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import toast from 'react-hot-toast';
import type { Favorite } from '@/types';
import { AppDialog } from './AppDialog';

interface Props {
  open: boolean;
  listId: string;
  onClose: () => void;
}

type Family = Favorite['mediaType'];

export function AddMediaToListDialog({ open, listId, onClose }: Props) {
  const { t } = useTranslation();
  const channels = useAppStore((s) => s.channels);
  const movies = useAppStore((s) => s.movies);
  const series = useAppStore((s) => s.series);
  const customLists = useAppStore((s) => s.customLists);
  const addToList = useAppStore((s) => s.addToList);
  const removeFromList = useAppStore((s) => s.removeFromList);
  const current = customLists.find((l) => l.id === listId);
  const [family, setFamily] = useState<Family>('channel');
  const [category, setCategory] = useState('__all__');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existingIds = useMemo(
    () => new Set(current?.items.filter((i) => i.mediaType === family).map((i) => i.mediaId) ?? []),
    [current, family],
  );

  useEffect(() => {
    if (!open) return;
    setFamily('channel');
    setCategory('__all__');
    setQuery('');
  }, [open, listId]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(existingIds));
  }, [open, listId, family, existingIds]);

  const source = family === 'channel' ? channels : family === 'movie' ? movies : series;
  const categories = useMemo(
    () => ['__all__', ...Array.from(new Set(source.map((item) => item.categoryName).filter(Boolean) as string[])).sort()],
    [source],
  );
  const visible = source.filter((item) => {
    const text = `${item.name} ${item.categoryName ?? ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (category === '__all__' || item.categoryName === category);
  });

  const toAdd = [...selected].filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !selected.has(id));
  const dirty = toAdd.length > 0 || toRemove.length > 0;

  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const apply = () => {
    toAdd.forEach((id) => addToList(listId, id, family));
    toRemove.forEach((id) => removeFromList(listId, id));
    toast.success(t('lists.updated'));
    onClose();
  };

  const tabs: { type: Family; label: string }[] = [
    { type: 'channel', label: t('lists.channelsTab') },
    { type: 'movie', label: t('lists.moviesTab') },
    { type: 'series', label: t('lists.seriesTab') },
  ];

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={t('lists.addContent')}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white/60">{t('lists.selectedCount', { count: selected.size })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-line px-4 py-2 text-sm text-white/60 hover:bg-white/10"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!dirty}
              onClick={apply}
              className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white on-accent disabled:opacity-40"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex gap-1 mb-3">
        {tabs.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setFamily(type);
              setCategory('__all__');
            }}
            className={cn(
              'flex-1 min-h-11 rounded-xl px-3 py-2 text-sm font-medium',
              family === type ? 'bg-accent text-white on-accent' : 'text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-1 px-3 min-h-11">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lists.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                'shrink-0 min-h-11 rounded-full px-3 py-1.5 text-xs',
                category === cat ? 'bg-accent text-white on-accent' : 'bg-surface-1 text-white/60 hover:bg-white/10',
              )}
            >
              {cat === '__all__' ? t('lists.allCategories') : cat}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSelected(new Set(visible.map((item) => item.id)))}
          className="text-xs font-medium text-accent hover:text-accent-hover min-h-11"
        >
          {t('lists.selectAll')}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/50">{t('lists.noneFound')}</p>
      ) : (
        <div className="space-y-1">
          {visible.map((item) => {
            const checked = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'flex w-full min-h-11 items-center gap-3 rounded-xl p-2 text-left transition-colors',
                  checked ? 'bg-accent/15' : 'hover:bg-white/5',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-accent bg-accent text-white' : 'border-line text-transparent',
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{item.name}</span>
                <span className="text-xs text-white/40">{item.categoryName ?? ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </AppDialog>
  );
}
