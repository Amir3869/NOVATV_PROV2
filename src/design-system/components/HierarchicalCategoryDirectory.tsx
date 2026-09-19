'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Grid2X2, Lock, Pencil, Search, Star } from 'lucide-react';
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
 * Mobile : un arbre inline, où toucher un parent le sélectionne et
 * ouvre ses enfants sous lui.
 *
 * Tablette / TV : deux colonnes permanentes dans l'annuaire : parents
 * à gauche, enfants du parent actif à droite. Le contenu reste dans la
 * colonne principale de la page.
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
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(activeId === allId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [focusedParentId, setFocusedParentId] = useState<string | null>(null);

  const hasSearch = search !== undefined && onSearchChange !== undefined;
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, CategoryHierarchyNode[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const children = map.get(node.parentId) ?? [];
      children.push(node);
      map.set(node.parentId, children);
    }
    return map;
  }, [nodes]);
  const roots = useMemo(
    () => nodes.filter((node) => !node.parentId),
    [nodes],
  );

  const activeNode = activeId ? byId.get(activeId) : undefined;
  const activeRoot = useMemo(() => {
    if (!activeNode) return null;
    let current = activeNode;
    const visited = new Set<string>();
    while (current.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }, [activeNode, byId]);

  const desktopParent =
    (focusedParentId && byId.get(focusedParentId)) || activeRoot || null;
  const desktopChildren = desktopParent ? childrenByParent.get(desktopParent.id) ?? [] : [];
  const showDesktopChildren = desktopChildren.length > 0;
  const activeCategoryLabel = activeId === allId || !activeNode
    ? allLabel
    : labelForNode?.(activeNode) ?? activeNode.name;
  const activeCategoryCount = activeId === allId || !activeNode ? allCount : activeNode.count;

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectNode = (node: CategoryHierarchyNode) => {
    if (isBlocked?.(node)) return;
    onSelect(node.id);
    setMobileCategoriesOpen(false);
    if (childrenByParent.has(node.id)) {
      setFocusedParentId(node.id);
      setExpandedIds((current) => new Set(current).add(node.id));
    } else if (node.parentId) {
      let parent = byId.get(node.parentId);
      while (parent?.parentId) parent = byId.get(parent.parentId);
      if (parent) setFocusedParentId(parent.id);
    } else {
      setFocusedParentId(null);
    }
  };

  const renderCount = (count: number) => (
    <span className="shrink-0 text-xs text-white/40">{count}</span>
  );

  const renderNodeButton = (
    node: CategoryHierarchyNode,
    options: { mobile?: boolean; depth?: number } = {},
  ) => {
    const active = node.id === activeId;
    const blocked = isBlocked?.(node) ?? false;
    const hasChildren = (childrenByParent.get(node.id)?.length ?? 0) > 0;
    const expanded = expandedIds.has(node.id);
    const label = labelForNode?.(node) ?? node.name;
    const depth = options.depth ?? 0;

    return (
      <div
        key={node.id}
        className={cn(
          'hierarchical-category-row flex min-w-0 items-center gap-1 rounded-xl',
          active ? 'bg-accent/15 text-white' : 'text-white/70 hover:bg-surface-2 hover:text-white',
          blocked && !active && 'opacity-60',
        )}
        style={options.mobile ? { marginInlineStart: `${Math.min(depth, 4) * 0.75}rem` } : undefined}
      >
        <button
          type="button"
          role="option"
          aria-selected={active}
          aria-disabled={blocked}
          onClick={() => selectNode(node)}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-start text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            active && 'border-s-2 border-accent',
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/55" aria-hidden>
            {node.level === 0 ? <Grid2X2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          {pinnedSet.has(node.id) && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-accent" aria-hidden />}
          {blocked && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {renderCount(node.count)}
        </button>

        {hasChildren && (
          <button
            type="button"
            aria-label={expanded
              ? t('common.categoryDirectoryCollapse', { name: label })
              : t('common.categoryDirectoryExpand', { name: label })}
            aria-expanded={expanded}
            onClick={() => {
              setFocusedParentId(node.id);
              toggleExpanded(node.id);
            }}
            className="me-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
          </button>
        )}
      </div>
    );
  };

  const renderMobileTree = (parentId: string | null = null, depth = 0): React.ReactNode[] => {
    const list = parentId
      ? childrenByParent.get(parentId) ?? []
      : roots;
    const output: React.ReactNode[] = [];
    for (const node of list) {
      output.push(renderNodeButton(node, { mobile: true, depth }));
      if (expandedIds.has(node.id)) {
        output.push(...renderMobileTree(node.id, depth + 1));
      }
    }
    return output;
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
            value={search ?? ''}
            onChange={(value) => onSearchChange?.(value)}
            placeholder={searchPlaceholder}
            autoFocus={mobileSearchOpen}
            className="mb-3"
          />
        </div>
      )}

      <div className="hierarchical-category-mobile-current">
        <button
          type="button"
          onClick={() => setMobileCategoriesOpen((open) => !open)}
          aria-expanded={mobileCategoriesOpen}
          aria-controls="mobile-category-list"
          className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface-1/95 px-3 text-start shadow-lg shadow-black/10 backdrop-blur-md transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Grid2X2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {mobileCategoriesOpen
                ? t('common.categoryDirectoryClose')
                : t('common.categoryDirectoryOpen')}
            </span>
            <span className="block truncate text-sm font-semibold text-white">{activeCategoryLabel}</span>
          </span>
          {activeCategoryCount !== undefined && renderCount(activeCategoryCount)}
          {mobileCategoriesOpen
            ? <ChevronDown className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
            : <ChevronRight className="h-4 w-4 shrink-0 text-white/50 rtl:rotate-180" aria-hidden />}
        </button>
      </div>

      <div
        id="mobile-category-list"
        className={cn('hierarchical-category-mobile', mobileCategoriesOpen && 'hierarchical-category-mobile-open')}
        role="listbox"
        aria-label={title}
      >
        <button
          type="button"
          role="option"
          aria-selected={activeId === allId}
          onClick={() => {
            setFocusedParentId(null);
            setMobileCategoriesOpen(true);
            onSelect(allId);
          }}
          className={cn(
            'mb-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            activeId === allId ? 'border-s-2 border-accent bg-accent/15 text-white' : 'text-white/75 hover:bg-surface-2 hover:text-white',
          )}
        >
          <Grid2X2 className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
          {allCount !== undefined && renderCount(allCount)}
        </button>
        {renderMobileTree()}
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
          <button
            type="button"
            role="option"
            aria-selected={activeId === allId}
            onClick={() => {
              setFocusedParentId(null);
              setMobileCategoriesOpen(true);
              onSelect(allId);
            }}
            className={cn(
              'mb-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeId === allId ? 'border-s-2 border-accent bg-accent/15 text-white' : 'text-white/75 hover:bg-surface-2 hover:text-white',
            )}
          >
            <Grid2X2 className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{allLabel}</span>
            {allCount !== undefined && renderCount(allCount)}
          </button>
          {roots.map((node) => renderNodeButton(node))}
        </div>

        {showDesktopChildren && desktopParent && (
          <div className="hierarchical-category-column hierarchical-category-children" role="listbox" aria-label={t('common.categoryDirectorySubcategories')}>
            <p className="mb-2 truncate px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {labelForNode?.(desktopParent) ?? desktopParent.name}
            </p>
            {desktopChildren.map((node) => renderNodeButton(node))}
          </div>
        )}
      </div>
    </aside>
  );
}
