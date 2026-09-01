'use client';

import React, { useState } from 'react';
import { LayoutGrid, List, Lock, Pencil, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SearchBar } from '@/design-system/components/SearchBar';

export type CatalogView = 'list' | 'grid';

export function CatalogToolbar({
  allLabel,
  categories,
  activeId,
  onSelect,
  onManage,
  manageLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  view,
  onViewChange,
  listLabel,
  gridLabel,
}: {
  allLabel: string;
  categories: ReadonlyArray<{ id: string; label: string; blocked?: boolean }>;
  /** `null` = puce « Toutes ». */
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /** Absent : pas de crayon (Films / Séries n'ont pas de gestion). */
  onManage?: () => void;
  manageLabel?: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
  listLabel: string;
  gridLabel: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const showField = searchOpen || search.length > 0;

  return (
    <div className="flex items-center gap-2">
      {onManage && (
        <button
          type="button"
          onClick={onManage}
          aria-label={manageLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {showField ? (
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          autoFocus={searchOpen}
          className="min-w-0 flex-1"
        />
      ) : (
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              'h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeId === null
                ? 'bg-accent text-white'
                : 'border border-line bg-surface-2 text-white/60 hover:bg-surface-3 hover:text-white'
            )}
          >
            {allLabel}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                'flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                cat.id === activeId
                  ? 'bg-accent text-white'
                  : 'border border-line bg-surface-2 text-white/60 hover:bg-surface-3 hover:text-white',
                cat.blocked && 'opacity-70'
              )}
            >
              {cat.blocked && <Lock className="mr-1.5 h-3 w-3" />}
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            if (showField) {
              setSearchOpen(false);
              onSearchChange('');
            } else {
              setSearchOpen(true);
            }
          }}
          aria-label={searchLabel}
          aria-expanded={showField}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            showField
              ? 'bg-accent text-white'
              : 'border border-line bg-surface-2 text-white/60 hover:bg-surface-3 hover:text-white'
          )}
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange(view === 'list' ? 'grid' : 'list')}
          aria-label={view === 'list' ? gridLabel : listLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {view === 'list' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
