'use client';

/**
 * Sélecteur de chaînes superposé au lecteur.
 *
 * ─── Le principe ───────────────────────────────────────────────────
 *
 * Le panneau glisse par-dessus la vidéo. Il ne remplace pas l'écran du
 * lecteur, il se pose dessus : l'élément `<video>` n'est ni démonté ni
 * rechargé, **la lecture continue derrière**, son compris.
 *
 * Deux colonnes, comme sur IPTV Smarters : catégories à gauche, chaînes
 * à droite.
 *
 * ─── La télécommande ───────────────────────────────────────────────
 *
 * Le point délicat est le passage d'une colonne à l'autre. Convention
 * de Fire TV et Android TV, reprise ici :
 *
 *   haut / bas     se déplacer dans la colonne courante
 *   droite         passer des catégories aux chaînes
 *   gauche         revenir des chaînes aux catégories
 *   Entrée         lancer la chaîne
 *   Échap / Retour fermer le panneau
 *
 * Les flèches sont interceptées **en capture** : sans cela, l'écran du
 * lecteur les recevrait aussi et modifierait le volume ou la position
 * de lecture pendant qu'on parcourt la liste.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Radio, Search, X } from 'lucide-react';

import { useTranslation } from '@/i18n';
import { cn } from '@/utils/cn';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import type { LiveCategory, LiveChannel } from '@/types';
import type { ChannelEpgSummary } from '@/services/player/playerEpg';
import {
  ALL_CATEGORIES,
  UNCATEGORIZED,
  buildCategoryList,
  filterChannels,
  initialCategory,
} from '@/services/player/channelBrowser';

/**
 * Touches que l'écran du lecteur intercepte au niveau du document et
 * qu'il faut lui masquer pendant que le panneau est ouvert.
 */
const PLAYER_KEYS = new Set([
  ' ',
  'Enter',
  'MediaPlayPause',
  'MediaPlay',
  'MediaPause',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'm',
  'M',
  'f',
  'F',
]);

interface ChannelBrowserProps {
  channels: LiveChannel[];
  categories: LiveCategory[];
  /** Chaîne actuellement à l'antenne, mise en évidence dans la liste. */
  currentChannelId: string | null;
  /**
   * Programme en cours de chaque chaîne, indexé par identifiant.
   *
   * Calculé par le lecteur et transmis tout fait : ce panneau se
   * redessine à chaque frappe dans la recherche, il ne doit pas
   * relancer un parcours du guide à chaque fois. Une chaîne absente de
   * la carte n'a rien à l'antenne — le cas courant sans guide importé.
   */
  epgByChannel?: Map<string, ChannelEpgSummary>;
  onSelect: (channel: LiveChannel) => void;
  onClose: () => void;
}

export function ChannelBrowser({
  channels,
  categories,
  currentChannelId,
  epgByChannel,
  onSelect,
  onClose,
}: ChannelBrowserProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const channelListRef = useRef<HTMLDivElement>(null);
  const categoryListRef = useRef<HTMLDivElement>(null);

  const currentChannel = useMemo(
    () => channels.find((c) => c.id === currentChannelId),
    [channels, currentChannelId]
  );

  const categoryList = useMemo(
    () => buildCategoryList(channels, categories, t('player.channelListAll')),
    [channels, categories, t]
  );

  const [activeCategory, setActiveCategory] = useState(() =>
    initialCategory(currentChannel, categoryList)
  );
  const [query, setQuery] = useState('');

  const visibleChannels = useMemo(
    () => filterChannels(channels, activeCategory, query),
    [channels, activeCategory, query]
  );

  /**
   * Déplacement vertical dans une colonne, sans sortir de ses bornes.
   *
   * `useCallback` sans dépendance : la fonction ne lit que des
   * références, stables par nature. La garder identique d'un rendu à
   * l'autre évite de réinstaller l'écouteur clavier du panneau à chaque
   * frappe dans le champ de recherche.
   */
  const moveWithin = useCallback((container: HTMLElement | null, offset: number) => {
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>('button'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) {
      items[0]?.focus();
      return;
    }
    const next = items[index + offset];
    // Pas de bouclage : sur une liste de 800 entrées, revenir en tête
    // depuis la fin désoriente plus qu'il ne rend service.
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  /**
   * Navigation aux fleches, appelee depuis l'ecouteur de capture.
   *
   * Elle NE PEUT PAS vivre dans un `onKeyDown` de JSX. Le barrage plus
   * haut intercepte les fleches sur `document` en phase de capture,
   * c'est-a-dire avant qu'elles n'atteignent le moindre element : sans
   * lui, l'ecran du lecteur derriere le panneau ferait bouger le volume
   * pendant qu'on parcourt la liste. Mais `stopPropagation` arrete la
   * course de l'evenement pour tout le monde, React compris, et un
   * gestionnaire pose sur la colonne n'etait jamais appele.
   *
   * La navigation est donc traitee la ou l'evenement est encore vivant.
   * Renvoie `true` quand la touche a ete consommee, pour que l'appelant
   * annule le comportement par defaut du navigateur — sans quoi la
   * fleche ferait aussi defiler la page sous le panneau.
   */
  const handleArrowKey = useCallback((key: string, target: HTMLElement | null): boolean => {
    // Dans le champ de recherche, les fleches deplacent le curseur de
    // saisie : les detourner empecherait de corriger une faute.
    if (target?.tagName === 'INPUT') return false;

    const inChannels = channelListRef.current?.contains(target ?? null) ?? false;
    const inCategories = categoryListRef.current?.contains(target ?? null) ?? false;
    if (!inChannels && !inCategories) return false;

    const column = inChannels ? channelListRef.current : categoryListRef.current;

    if (key === 'ArrowDown') {
      moveWithin(column, 1);
      return true;
    }
    if (key === 'ArrowUp') {
      moveWithin(column, -1);
      return true;
    }
    if (key === 'ArrowRight' && inCategories) {
      channelListRef.current?.querySelector<HTMLElement>('button')?.focus();
      return true;
    }
    if (key === 'ArrowLeft' && inChannels) {
      categoryListRef.current
        ?.querySelector<HTMLElement>(`[data-active="true"]`)
        ?.focus();
      return true;
    }
    return false;
  }, [moveWithin]);

  /* Fermeture, piège à focus et restitution — même patron que TrackMenu. */
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace' || event.key === 'GoBack') {
        // Ne pas intercepter Retour arrière pendant une saisie : la
        // touche doit effacer un caractère, pas fermer le panneau.
        const target = event.target as HTMLElement | null;
        if (event.key === 'Backspace' && target?.tagName === 'INPUT') return;

        event.preventDefault();
        // Sans `stopPropagation`, l'écran du lecteur reçoit la même
        // touche et quitte la page en même temps que le panneau ferme.
        event.stopPropagation();
        onClose();
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      /*
        Tant que le panneau est ouvert, ces touches lui appartiennent.
        Sans ce barrage, l'écran du lecteur les reçoit aussi : Entrée
        mettrait la vidéo en pause au moment même où l'on valide une
        chaîne, les flèches feraient bouger le volume, F basculerait
        le plein écran. On ne coupe que ces touches-là — la saisie
        dans le champ de recherche doit rester intacte.
      */
      if (PLAYER_KEYS.has(event.key)) {
        event.stopPropagation();
      }

      /*
        La navigation est traitee ICI, et non dans un `onKeyDown` de
        JSX : le `stopPropagation` ci-dessus a deja mis fin au voyage de
        l'evenement, aucun gestionnaire React ne le verra passer.
      */
      const target = event.target as HTMLElement | null;
      if (handleArrowKey(event.key, target)) {
        event.preventDefault();
        return;
      }

      if (event.key !== 'Tab') return;

      /*
        `:not([tabindex="-1"])` exclut le voile.

        Le voile est un `<button>` volontairement hors tabulation. Sans
        cette exclusion il compterait comme extremite du piege : la
        boucle se refermerait sur un element inatteignable au clavier,
        et la tabulation s'echapperait du panneau. Sur televiseur, la
        telecommande sortirait derriere la fenetre sans retour possible.
      */
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled])'
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocusRef.current?.focus();
    };
  }, [onClose, handleArrowKey]);

  /*
    Amener la sélection sur la chaîne en cours à l'ouverture. Sur une
    liste de 800 chaînes, s'ouvrir en tête obligerait à faire défiler
    jusqu'à sa position actuelle.
  */
  useEffect(() => {
    const list = channelListRef.current;
    const active = list?.querySelector<HTMLElement>('[data-current="true"]');
    if (active) {
      active.scrollIntoView({ block: 'center' });
      active.focus();
    } else {
      list?.querySelector<HTMLElement>('button')?.focus();
    }
    // Volontairement à l'ouverture seule : refaire défiler à chaque
    // changement de filtre arracherait la sélection à l'utilisateur.
  }, []);


  const categoryLabel = (id: string, name: string) =>
    id === UNCATEGORIZED ? t('player.channelListUncategorized') : name;

  return (
    /*
      `absolute inset-0` à l'intérieur du conteneur du lecteur, et non
      `fixed` : le panneau doit rester dans le cadre en plein écran,
      où seul cet élément est affiché par le navigateur.
    */
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('player.channelListTitle')}
      className="cinema absolute inset-0 z-[120] flex"
    >
      {/*
        Le panneau est écrit AVANT le voile.

        Dans un conteneur `flex`, l'ordre du code est l'ordre à l'écran.
        Le voile portant `flex-1`, il occupe toute la place restante :
        écrit en premier, il repoussait le panneau contre le bord droit.
        Écrit en second, il repousse le panneau contre le bord gauche,
        là où l'oeil et le pouce vont le chercher.

        En arabe, `flex` suit le sens d'écriture et inverse de lui-même
        les deux enfants : le panneau repasse à droite sans code en plus.
      */}
      <div className="w-full sm:w-[min(38rem,55vw)] max-w-full h-full bg-black/95 backdrop-blur-xl border-e border-white/10 flex flex-col shadow-2xl ps-[env(safe-area-inset-left)]">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="font-bold text-white">{t('player.channelListTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-3 border-b border-white/8 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('player.channelListSearch')}
              aria-label={t('player.channelListSearch')}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>
        </div>

        {channels.length === 0 ? (
          <p className="text-sm text-white/40 py-12 text-center px-5">
            {t('player.channelListEmpty')}
          </p>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Colonne des catégories */}
            <div
              ref={categoryListRef}
              role="listbox"
              aria-label={t('player.channelListCategories')}
              className="w-2/5 overflow-y-auto border-e border-white/8 py-2"
            >
              {categoryList.map((category) => {
                const active = category.id === activeCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-active={active}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      'w-full text-start px-4 py-2.5 flex items-center justify-between gap-2 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-white',
                      active
                        ? 'bg-accent/15 text-white border-s-2 border-accent'
                        : 'text-white/60 hover:bg-white/5 hover:text-white border-s-2 border-transparent'
                    )}
                  >
                    <span className="text-sm truncate">
                      {categoryLabel(category.id, category.name)}
                    </span>
                    <span className="text-[11px] text-white/30 tabular-nums flex-shrink-0">
                      {category.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Colonne des chaînes */}
            <div
              ref={channelListRef}
              role="listbox"
              aria-label={t('player.channelListTitle')}
              className="flex-1 overflow-y-auto py-2"
            >
              {visibleChannels.length === 0 ? (
                <p className="text-sm text-white/40 py-10 text-center px-4">
                  {t('player.channelListNoMatch')}
                </p>
              ) : (
                visibleChannels.map((channel) => {
                  const isCurrent = channel.id === currentChannelId;
                  const epg = epgByChannel?.get(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      data-current={isCurrent}
                      onClick={() => onSelect(channel)}
                      className={cn(
                        'w-full text-start px-4 py-2.5 flex items-center gap-3 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-white',
                        isCurrent ? 'bg-accent/15' : 'hover:bg-white/5'
                      )}
                    >
                      {/* Un logo manquant est la règle, pas l'exception :
                          `ImageWithFallback` évite l'icône d'image cassée. */}
                      <ImageWithFallback
                        src={channel.logo}
                        alt=""
                        className="w-9 h-9 rounded-lg object-contain bg-white/5 flex-shrink-0"
                        fallbackClassName="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white/25"
                        fallback={<Radio className="w-4 h-4" />}
                      />

                      {/*
                        Nom, puis ce qui passe.

                        On choisit une chaîne sur son programme autant que
                        sur son nom. La mention et la mini-barre
                        disparaissent entièrement sans guide, plutôt que
                        de laisser un tiret ou une barre vide : la ligne
                        reprend alors exactement son allure d'origine.

                        `min-w-0` est indispensable pour que `truncate`
                        agisse : une boîte flex refuse par défaut de
                        descendre sous la largeur de son contenu.
                      */}
                      <span className="flex-1 min-w-0">
                        <span
                          className={cn(
                            'block text-sm truncate',
                            isCurrent ? 'text-white font-medium' : 'text-white/70'
                          )}
                        >
                          {channel.name}
                        </span>

                        {epg && (
                          <>
                            <span className="block text-[11px] text-white/45 truncate mt-0.5">
                              {epg.title}
                              {epg.remainingMinutes !== null && (
                                <> · {t('player.epgRemaining', { count: epg.remainingMinutes })}</>
                              )}
                            </span>
                            {/*
                              Mini-barre purement decorative : le temps
                              restant juste au-dessus dit deja la meme
                              chose en toutes lettres. La doubler d'une
                              annonce vocale allongerait la lecture de
                              chaque ligne sans rien apprendre.
                            */}
                            <span
                              aria-hidden="true"
                              className="block h-0.5 rounded-full bg-white/15 mt-1 overflow-hidden"
                            >
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{ width: `${epg.percent}%` }}
                              />
                            </span>
                          </>
                        )}
                      </span>

                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex-shrink-0">
                          {t('player.channelListCurrent')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Voile cliquable : la vidéo reste visible et audible derrière. */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-[2px] cursor-default"
        tabIndex={-1}
      />
    </div>
  );
}
