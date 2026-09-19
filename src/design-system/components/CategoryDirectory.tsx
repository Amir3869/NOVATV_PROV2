'use client';

import React, { useState } from 'react';
import { Grid2X2, Lock, Pencil, Search, Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SearchBar } from '@/design-system/components/SearchBar';

export interface CategoryDirectoryItem {
  id: string;
  label: string;
  count?: number;
  blocked?: boolean;
  pinned?: boolean;
  icon?: React.ReactNode;
}

/**
 * Annuaire de catégories toujours visible.
 *
 * Les catégories IPTV peuvent être très nombreuses. Une rangée de puces
 * horizontale devient illisible dès que la source en contient plusieurs
 * dizaines : elle cache les éléments derrière un défilement latéral et
 * concurrence les boutons de recherche et d'affichage. Ce composant garde
 * donc la liste dans le flux de la page sur téléphone portrait, puis la
 * transforme en colonne permanente sur les écrans plus larges.
 *
 * La sélection ne passe pas par une fenêtre modale : chaque bouton est
 * immédiatement visible, focusable et utilisable au toucher ou à la
 * télécommande.
 */
export function CategoryDirectory({
  title,
  subtitle,
  categories,
  activeId,
  onSelect,
  onManage,
  manageLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  className,
}: {
  title: string;
  subtitle?: string;
  categories: ReadonlyArray<CategoryDirectoryItem>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onManage?: () => void;
  manageLabel?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  className?: string;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(Boolean(search));
  const hasSearch = search !== undefined && onSearchChange !== undefined;

  return (
    <aside className={cn('category-directory', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="category-directory-subtitle mt-0.5 truncate text-xs text-white/40">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasSearch && !mobileSearchOpen && (
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-label={searchLabel ?? 'Rechercher'}
              aria-expanded={mobileSearchOpen}
              className="category-directory-search-trigger flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          {onManage && (
            <button
              type="button"
              onClick={onManage}
              aria-label={manageLabel}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {hasSearch && (
        <div className={cn('category-directory-search', mobileSearchOpen && 'category-directory-search-open')}>
          <SearchBar
            key={mobileSearchOpen ? 'mobile-open' : 'mobile-closed'}
            value={search ?? ''}
            onChange={(value) => onSearchChange?.(value)}
            placeholder={searchPlaceholder}
            autoFocus={mobileSearchOpen}
            className="mb-3"
          />
        </div>
      )}

      <div className="category-directory-list" role="listbox" aria-label={title}>
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(category.id)}
              className={cn(
                'category-directory-item group flex min-w-0 items-center gap-2 rounded-xl px-3 text-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'border-s-2 border-accent bg-accent/15 text-white'
                  : 'border-s-2 border-transparent text-white/70 hover:bg-surface-2 hover:text-white',
                category.blocked && !active && 'opacity-70',
              )}
            >
              <span className="category-directory-item-icon flex h-5 w-5 shrink-0 items-center justify-center text-white/60" aria-hidden>
                {category.icon ?? (category.id === '__all__' ? <Grid2X2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />)}
              </span>
              {category.pinned && <Star className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden />}
              {category.blocked && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{category.label}</span>
              {category.count !== undefined && (
                <span className={cn('shrink-0 text-xs', active ? 'text-white/80' : 'text-white/35')}>
                  {category.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
