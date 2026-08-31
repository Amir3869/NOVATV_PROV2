'use client';

import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import toast from 'react-hot-toast';
import type { Favorite } from '@/types';

interface Props { open: boolean; listId: string; onClose: () => void; }
type Family = Favorite['mediaType'];

export function AddMediaToListDialog({ open, listId, onClose }: Props) {
  const { t } = useTranslation();
  const channels = useAppStore((s) => s.channels);
  const movies = useAppStore((s) => s.movies);
  const series = useAppStore((s) => s.series);
  const customLists = useAppStore((s) => s.customLists);
  const addToList = useAppStore((s) => s.addToList);
  const current = customLists.find((l) => l.id === listId);
  const [family, setFamily] = useState<Family>('channel');
  const [category, setCategory] = useState('__all__');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const source = family === 'channel' ? channels : family === 'movie' ? movies : series;
  const categories = useMemo(() => ['__all__', ...Array.from(new Set(source.map((item) => item.categoryName).filter(Boolean) as string[])).sort()], [source]);
  const existing = new Set(current?.items.filter((i) => i.mediaType === family).map((i) => i.mediaId));
  const visible = source.filter((item) => {
    const text = `${item.name} ${item.categoryName ?? ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (category === '__all__' || item.categoryName === category);
  });

  const toggle = (id: string) => setSelected((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const addSelected = () => {
    [...selected].filter((id) => !existing.has(id)).forEach((id) => addToList(listId, id, family));
    toast.success(`${selected.size} élément${selected.size > 1 ? 's' : ''} ajouté${selected.size > 1 ? 's' : ''}`);
    onClose();
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold text-white">Ajouter du contenu</h2><button onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-2 text-white/50 hover:bg-surface-3 hover:text-white"><X className="h-4 w-4" /></button></div>
        <div className="flex gap-1 border-b border-line p-2">{(['channel', 'movie', 'series'] as Family[]).map((type) => <button key={type} onClick={() => { setFamily(type); setCategory('__all__'); setSelected(new Set()); }} className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-medium', family === type ? 'bg-accent text-white' : 'text-white/60 hover:bg-surface-3 hover:text-white')}>{type === 'channel' ? 'Chaînes' : type === 'movie' ? 'Films' : 'Séries'}</button>)}</div>
        <div className="space-y-3 border-b border-line p-3"><div className="flex items-center gap-2 rounded-xl border border-line bg-surface-1 px-3"><Search className="h-4 w-4 text-white/40" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par titre" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/40" /></div><div className="flex gap-2 overflow-x-auto scrollbar-none">{categories.map((cat) => <button key={cat} onClick={() => setCategory(cat)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs', category === cat ? 'bg-accent text-white' : 'bg-surface-1 text-white/60 hover:bg-surface-3')}>{cat === '__all__' ? 'Toutes' : cat}</button>)}</div><button onClick={() => setSelected(new Set(visible.filter((item) => !existing.has(item.id)).map((item) => item.id)))} className="text-xs font-medium text-accent hover:text-accent-hover">Sélectionner tout</button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{visible.length === 0 ? <p className="py-10 text-center text-sm text-white/50">Aucun contenu trouvé</p> : <div className="space-y-1">{visible.map((item) => { const disabled = existing.has(item.id); const checked = selected.has(item.id); return <button key={item.id} disabled={disabled} onClick={() => toggle(item.id)} className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors', disabled ? 'opacity-40' : checked ? 'bg-accent/15' : 'hover:bg-surface-3')}><span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', checked ? 'border-accent bg-accent text-white' : 'border-line text-transparent')}><Check className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1 truncate text-sm text-white">{item.name}</span><span className="text-xs text-white/40">{disabled ? 'Déjà ajouté' : item.categoryName ?? ''}</span></button>; })}</div>}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-1 p-3"><span className="text-sm text-white/60">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span><div className="flex gap-2"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-white/60 hover:bg-surface-3">Annuler</button><button disabled={selected.size === 0} onClick={addSelected} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Ajouter à la liste</button></div></div>
      </div>
    </div>
  );
}
