'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, Grid2X2, Lock, Pencil, Search, Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SearchBar } from './SearchBar';
import { useTranslation } from '@/i18n';
import type { CategoryHierarchyNode } from '@/services/catalog/categoryHierarchy';

export interface HierarchicalCategoryDirectoryProps {
  title: string;
  subtitle?: string;
  nodes: readonly CategoryHierarchyNode[];
  allId: string;
  allLabel: string;
  allCount?: number;
  activeId: string | null;
  pinnedIds?: readonly string[];
  orderIds?: readonly string[];
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  onSelect: (id: string) => void;
  onManage?: () => void;
  manageLabel?: string;
  labelForNode?: (node: CategoryHierarchyNode) => string;
  isBlocked?: (node: CategoryHierarchyNode) => boolean;
  className?: string;
}

/**
 * Annuaire parent/enfant sans fenêtre modale.
 *
 * Portrait mobile : toutes les catégories sont directement visibles dans
 * une grille compacte de deux colonnes, comme Films et Séries. Il n'y a
 * pas d'accordéon et les enfants restent sélectionnables immédiatement.
 *
 * Tablette / TV / desktop : les racines sont à gauche et les enfants du
 * parent sélectionné à droite, mais uniquement si ce parent possède de
 * vrais enfants utilisables.
 */
export function HierarchicalCategoryDirectory({
  title,
  subtitle,
  nodes,
  allId,
  allLabel,
  allCount,
  activeId,
  pinnedIds = [],
  orderIds = [],
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  onSelect,
  onManage,
  manageLabel,
  labelForNode,
  isBlocked,
  className,
}: HierarchicalCategoryDirectoryProps) {
  const { t } = useTranslation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(Boolean(search));

  const hasSearch = search !== undefined && onSearchChange !== undefined;
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const categoryRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    let rank = 0;
    for (const id of pinnedIds) {
      if (!ranks.has(id)) ranks.set(id, rank++);
    }
    for (const id of orderIds) {
      if (!ranks.has(id)) ranks.set(id, rank++);
    }
    return ranks;
  }, [orderIds, pinnedIds]);
  const sourceRanks = useMemo(
    () => new Map(nodes.map((node, index) => [node.id, index])),
    [nodes],
  );

  const { roots, childrenByParent, flatNodes } = useMemo(() => {
    const sortNodes = (items: readonly CategoryHierarchyNode[]) =>
      [...items].sort((left, right) => {
        const leftRank = categoryRanks.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = categoryRanks.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return (sourceRanks.get(left.id) ?? 0) - (sourceRanks.get(right.id) ?? 0);
      });
    const children = new Map<string, CategoryHierarchyNode[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const list = children.get(node.parentId) ?? [];
      list.push(node);
      children.set(node.parentId, list);
    }
    for (const [parentId, list] of children) {
      children.set(parentId, sortNodes(list));
    }
    return {
      roots: sortNodes(nodes.filter((node) => !node.parentId)),
      childrenByParent: children,
      // Le mobile affiche volontairement parents et enfants sur le même
      // niveau : aucune catégorie n'est cachée derrière un accordéon.
      flatNodes: sortNodes(nodes),
    };
  }, [categoryRanks, nodes, sourceRanks]);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const activeNode = activeId ? byId.get(activeId) : undefined;
  const activeChildren = activeNode ? childrenByParent.get(activeNode.id) ?? [] : [];
  const showDesktopChildren = activeChildren.length > 0;

  const renderCount = (count: number) => (
    <span className="shrink-0 text-xs text-white/40">{count}</span>
  );

  const renderAllButton = (className?: string) => (
    <button
      type="button"
      role="option"
      aria-selected={activeId === allId}
      onClick={() => onSelect(allId)}
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        activeId === allId
          ? 'border-s-2 border-accent bg-accent/15 text-white'
          : 'border-s-2 border-transparent text-white/75 hover:bg-surface-2 hover:text-white',
        className,
      )}
    >
      <Grid2X2 className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{allLabel}</span>
      {allCount !== undefined && renderCount(allCount)}
    </button>
  );

  const renderNodeButton = (
    node: CategoryHierarchyNode,
    options: { mobile?: boolean } = {},
  ) => {
    const active = node.id === activeId;
    const blocked = isBlocked?.(node) ?? false;
    const hasChildren = (childrenByParent.get(node.id)?.length ?? 0) > 0;
    const label = labelForNode?.(node) ?? node.name;

    return (
      <div
        key={node.id}
        className={cn(
          'hierarchical-category-row hierarchical-category-item flex min-w-0 items-center gap-1 rounded-xl',
          active ? 'hierarchical-category-item-active bg-accent/15 text-white' : 'text-white/70 hover:bg-surface-2 hover:text-white',
          blocked && !active && 'opacity-60',
        )}
      >
        <button
          type="button"
          role="option"
          aria-selected={active}
          aria-disabled={blocked}
          onClick={() => {
            if (!blocked) onSelect(node.id);
          }}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-start text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            active && 'border-s-2 border-accent',
          )}
        >
          <span className="hierarchical-category-node-icon flex h-5 w-5 shrink-0 items-center justify-center text-white/55" aria-hidden>
            {node.level === 0 ? <Grid2X2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          {pinnedSet.has(node.id) && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-accent" aria-hidden />}
          {blocked && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {renderCount(node.count)}
        </button>

        {/* Le chevron est réservé aux colonnes tablette/TV. En portrait,
            les enfants sont déjà visibles dans la grille deux colonnes. */}
        {hasChildren && !options.mobile && (
          <ChevronRight className="me-2 h-4 w-4 shrink-0 text-white/35 rtl:rotate-180" aria-hidden />
        )}
      </div>
    );
  };

  return (
    <aside className={cn('hierarchical-category-directory min-w-0', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="hierarchical-category-subtitle mt-0.5 truncate text-xs text-white/40">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasSearch && !mobileSearchOpen && (
            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              aria-label={searchLabel ?? t('common.search')}
              aria-expanded={mobileSearchOpen}
              className="category-directory-search-trigger flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          {onManage && (
            <button
              type="button"
              onClick={onManage}
              aria-label={manageLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-white/60 transition hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {hasSearch && (
        <div className={cn('category-directory-search', mobileSearchOpen && 'category-directory-search-open')}>
          <SearchBar
            value={search ?? ''}
            onChange={(value) => onSearchChange?.(value)}
            placeholder={searchPlaceholder}
            autoFocus={mobileSearchOpen}
            className="mb-3"
          />
        </div>
      )}

      <div
        className="hierarchical-category-mobile"
        role="listbox"
        aria-label={title}
      >
        {renderAllButton()}
        {flatNodes.map((node) => renderNodeButton(node, { mobile: true }))}
      </div>

      <div
        className={cn(
          'hierarchical-category-desktop',
          !showDesktopChildren && 'hierarchical-category-desktop-single',
        )}
        role="group"
        aria-label={title}
      >
        <div className="hierarchical-category-column" role="listbox" aria-label={t('common.categoryDirectoryFamilies')}>
          {renderAllButton()}
          {roots.map((node) => renderNodeButton(node))}
        </div>

        {showDesktopChildren && activeNode && (
          <div className="hierarchical-category-column hierarchical-category-children" role="listbox" aria-label={t('common.categoryDirectorySubcategories')}>
            <p className="mb-2 truncate px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {labelForNode?.(activeNode) ?? activeNode.name}
            </p>
            {activeChildren.map((node) => renderNodeButton(node))}
          </div>
        )}
      </div>
    </aside>
  );
}
