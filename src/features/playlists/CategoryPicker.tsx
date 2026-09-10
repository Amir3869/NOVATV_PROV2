'use client';

/**
 * Écran de choix des catégories d'une source Xtream.
 *
 * ─── Pourquoi cet écran existe ─────────────────────────────────────
 *
 * Un abonnement courant déclare 15 000 chaînes réparties en 150 à 300
 * catégories, dont la plupart dans des langues que l'utilisateur ne lit
 * pas. Tout importer rend la synchronisation interminable, sature la
 * mémoire d'un Fire TV Stick et noie la recherche.
 *
 * Cet écran s'intercale entre la connexion et le téléchargement : on
 * n'a encore rapporté que les noms des catégories, quelques
 * kilo-octets. Ce qui n'est pas coché ne sera jamais demandé.
 *
 * ─── Ce que cet écran ne fait pas ──────────────────────────────────
 *
 * Il n'affiche **pas** le nombre de chaînes par catégorie. L'API Xtream
 * ne le fournit pas : le connaître exigerait de télécharger le contenu,
 * c'est-à-dire précisément ce que l'on cherche à éviter. Afficher un
 * nombre inventé serait pire que de n'en afficher aucun.
 */

import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Layers, Search, X } from 'lucide-react';

import { useTranslation, type MessageKey } from '@/i18n';
import { cn } from '@/utils/cn';
import {
  CATEGORY_KINDS,
  countSelected,
  filterCategories,
  groupCategories,
  isSelectionEmpty,
  setCategories,
  toggleCategory,
  type CategoryCatalog,
  type CategoryKind,
  type CategorySelection,
} from '@/services/xtream/categorySelection';
import type { XtreamCategory } from '@/services/xtream/xtreamService';

const KIND_LABELS = {
  live: 'playlists.categoriesLive',
  vod: 'playlists.categoriesVod',
  series: 'playlists.categoriesSeries',
} as const satisfies Record<CategoryKind, MessageKey>;

interface CategoryPickerProps {
  catalog: CategoryCatalog;
  selection: CategorySelection;
  onChange: (selection: CategorySelection) => void;
  /** Libellé du bouton de validation — « Importer » ou « Enregistrer ». */
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  /** Grise l'ensemble pendant que la synchronisation tourne. */
  busy?: boolean;
  /** Masqué si le titre est déjà porté par `AppDialog`. */
  showHeader?: boolean;
}

export function CategoryPicker({
  catalog,
  selection,
  onChange,
  submitLabel,
  onSubmit,
  onCancel,
  busy = false,
  showHeader = true,
}: CategoryPickerProps) {
  const { t } = useTranslation();
  const [activeKind, setActiveKind] = useState<CategoryKind>('live');
  const [query, setQuery] = useState('');
  /** `null` = liste des groupes ; sinon le préfixe ouvert (`__loose__` pour Autres). */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const categories = catalog[activeKind];

  /**
   * `useMemo` met un calcul en cache tant que ses dépendances ne
   * changent pas. Regrouper 300 catégories à chaque frappe au clavier
   * rendrait le champ de recherche saccadé sur un Fire TV Stick.
   */
  const visible = useMemo(
    () => filterCategories(categories, query),
    [categories, query]
  );
  const groups = useMemo(() => groupCategories(visible), [visible]);

  const total = countSelected(selection);
  const empty = isSelectionEmpty(selection);

  /** Identifiants actuellement affichés, donc concernés par « tout cocher ». */
  const visibleIds = useMemo(() => visible.map((c) => c.categoryId), [visible]);
  const allVisibleChecked =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selection[activeKind].includes(id));

  const handleToggleAll = () => {
    onChange(setCategories(selection, activeKind, visibleIds, !allVisibleChecked));
  };

  const handleToggleGroup = (groupCategories: XtreamCategory[], checked: boolean) => {
    onChange(
      setCategories(
        selection,
        activeKind,
        groupCategories.map((c) => c.categoryId),
        checked
      )
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {showHeader && (
      <header>
        <h2 className="font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          {t('playlists.categoriesTitle')}
        </h2>
        <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
          {t('playlists.categoriesSubtitle')}
        </p>
      </header>
      )}

      {/*
        Onglets des trois familles.
        `role="tablist"` annonce aux lecteurs d'écran qu'il s'agit d'un
        groupe d'onglets et non de trois boutons sans rapport.
      */}
      <div role="tablist" aria-label={t('playlists.categoriesTitle')} className="flex gap-2">
        {CATEGORY_KINDS.map((kind) => {
          const count = selection[kind].length;
          const active = kind === activeKind;
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={busy}
              onClick={() => {
                setActiveKind(kind);
                // Une recherche laissée en place masquerait presque tout
                // dans l'onglet suivant, sans que la cause soit visible.
                setQuery('');
                setOpenGroup(null);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                'disabled:opacity-40',
                active
                  ? 'bg-accent text-white'
                  : 'bg-white/5 border border-white/8 text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              {t(KIND_LABELS[kind])}
              {count > 0 && (
                <span
                  className={cn(
                    'text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
                    active ? 'bg-black/25 text-white' : 'bg-white/10 text-white/70'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-white/40 py-8 text-center">
          {t('playlists.categoriesNoneAvailable')}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-white/30 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpenGroup(null);
                }}
                placeholder={t('playlists.categoriesSearch')}
                aria-label={t('playlists.categoriesSearch')}
                disabled={busy}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 focus:bg-white/7 transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={handleToggleAll}
              disabled={busy || visibleIds.length === 0}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40 whitespace-nowrap"
            >
              {allVisibleChecked
                ? t('playlists.categoriesClearAll')
                : t('playlists.categoriesSelectAll')}
            </button>
          </div>

          {/*
            Hauteur bornée plutôt que page qui s'allonge : sur 300
            catégories, le bouton de validation se retrouverait hors
            écran, injoignable à la télécommande sans un défilement
            interminable.
          */}
          <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-line bg-surface-3">
            {visible.length === 0 ? (
              <p className="text-sm text-white/40 py-10 text-center">
                {t('playlists.categoriesNoMatch')}
              </p>
            ) : (
              <>
                {groups.length > 1 && query.trim() === '' && openGroup === null ? (
                  <ul>
                    {groups.map((group) => {
                      const key = group.prefix ?? '__loose__';
                      const groupIds = group.categories.map((c) => c.categoryId);
                      const groupChecked = groupIds.every((id) =>
                        selection[activeKind].includes(id)
                      );
                      const n = group.categories.length;
                      return (
                        <li key={key}>
                          <div className="flex items-center border-b border-line">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setOpenGroup(key)}
                              className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-3 text-start hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-white disabled:opacity-40"
                            >
                              <span className="text-sm font-semibold text-white truncate">
                                {group.prefix ?? t('playlists.categoriesOther')}
                              </span>
                              <span className="text-[11px] text-white/45 flex-shrink-0">
                                {n === 1
                                  ? t('playlists.categoriesGroupCountOne')
                                  : t('playlists.categoriesGroupCount', { count: n })}
                              </span>
                              <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleGroup(group.categories, !groupChecked)}
                              disabled={busy}
                              className="px-3 py-3 text-[11px] text-white/70 hover:text-white underline underline-offset-2 flex-shrink-0 disabled:opacity-40"
                            >
                              {groupChecked
                                ? t('playlists.categoriesClearAll')
                                : t('playlists.categoriesSelectAll')}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  groups
                    .filter((group) => {
                      if (groups.length <= 1 || query.trim() !== '') return true;
                      const key = group.prefix ?? '__loose__';
                      return key === openGroup;
                    })
                    .map((group) => {
                const groupIds = group.categories.map((c) => c.categoryId);
                const groupChecked = groupIds.every((id) =>
                  selection[activeKind].includes(id)
                );

                return (
                  <section key={group.prefix ?? '__loose__'}>
                    {(group.prefix !== null || openGroup !== null) && (
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 bg-surface-2 border-b border-line">
                        <div className="flex items-center gap-2 min-w-0">
                          {openGroup !== null && groups.length > 1 && query.trim() === '' && (
                            <button
                              type="button"
                              onClick={() => setOpenGroup(null)}
                              aria-label={t('playlists.categoriesBack')}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          )}
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
                            {group.prefix ?? t('playlists.categoriesOther')}
                          </span>
                          <span className="text-[11px] text-white/40 flex-shrink-0">
                            {group.categories.length === 1
                              ? t('playlists.categoriesGroupCountOne')
                              : t('playlists.categoriesGroupCount', { count: group.categories.length })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group.categories, !groupChecked)}
                          disabled={busy}
                          className="text-[11px] text-white/70 hover:text-white underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded disabled:opacity-40"
                        >
                          {groupChecked
                            ? t('playlists.categoriesClearAll')
                            : t('playlists.categoriesSelectAll')}
                        </button>
                      </div>
                    )}

                    <ul>
                      {group.categories.map((category) => {
                        const checked = selection[activeKind].includes(category.categoryId);
                        return (
                          <li key={category.categoryId}>
                            <button
                              type="button"
                              aria-pressed={checked}
                              disabled={busy}
                              onClick={() =>
                                onChange(
                                  toggleCategory(selection, activeKind, category.categoryId)
                                )
                              }
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors',
                                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-white',
                                'disabled:opacity-40',
                                checked ? 'bg-accent/10' : 'hover:bg-white/5'
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                  checked
                                    ? 'bg-accent border-accent'
                                    : 'border-white/20 bg-white/5'
                                )}
                              >
                                {checked && <Check className="w-3.5 h-3.5 text-white" />}
                              </span>
                              <span
                                className={cn(
                                  'text-sm truncate text-white',
                                  !checked && 'text-white/80'
                                )}
                              >
                                {category.categoryName}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
                    })
                )}
              </>
            )}
          </div>

          <p className="text-[11px] text-white/30 leading-relaxed">
            {t('playlists.categoriesCountHint')}
          </p>
        </>
      )}

      {/*
        `aria-live="polite"` fait annoncer le compte par un lecteur
        d'écran à chaque changement, sans interrompre la lecture en
        cours.
      */}
      <p
        className={cn('text-sm', empty ? 'text-amber-400' : 'text-white/60')}
        role="status"
        aria-live="polite"
      >
        {empty
          ? t('playlists.categoriesNoneSelected')
          : total === 1
            ? t('playlists.categoriesSelectedCount', { count: total })
            : t('playlists.categoriesSelectedCountPlural', { count: total })}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('playlists.categoriesBack')}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          /*
            Bloqué tant que rien n'est coché : créer une source vide
            mènerait à un écran d'accueil désert, sans explication.
          */
          disabled={busy || empty}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/** En-tête réutilisable des deux usages de l'écran. */
export function CategoryPickerHeader({
  title,
  onClose,
  closeLabel,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-bold text-white flex items-center gap-2">
        <Layers className="w-4 h-4 text-accent" />
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="text-white/40 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
