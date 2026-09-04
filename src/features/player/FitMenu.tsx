'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';
import { VIDEO_FIT_MODES, type VideoFitMode } from '@/services/player/videoFit';

interface FitMenuProps {
  /** Mode actuellement appliqué à la balise vidéo. */
  current: VideoFitMode;
  onSelect: (mode: VideoFitMode) => void;
  onClose: () => void;
}

/**
 * Abonnement vide : la valeur ne change jamais après le montage.
 *
 * Sert uniquement à distinguer le rendu serveur du rendu navigateur,
 * `document` n'existant pas côté serveur.
 */
const subscribeNoop = () => () => {};

/**
 * Menu d'ajustement de l'image.
 *
 * Trois modes seulement, tous toujours proposés : contrairement à la
 * qualité, l'ajustement ne dépend pas de ce que le flux publie. Le
 * bouton qui ouvre ce menu n'a donc jamais besoin d'être retiré.
 *
 * Rendu dans un portail vers `document.body`. Le lecteur applique un
 * `backdrop-blur`, qui crée un contexte d'empilement CSS : un `z-index`
 * élevé n'y suffirait pas, le menu resterait prisonnier de son parent.
 * Même correctif que pour `QualityMenu` et `ConfirmDialog`.
 */
export function FitMenu({ current, onSelect, onClose }: FitMenuProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // `useSyncExternalStore` plutôt que `useState` + `useEffect` : ce
  // dernier déclenche la règle `react-hooks/set-state-in-effect`.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Sans `stopPropagation`, le lecteur reçoit aussi la touche et
        // quitte la page en même temps que le menu se ferme.
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      // Piège à focus : à la télécommande comme au clavier, la
      // tabulation ne doit pas sortir du menu vers les contrôles du
      // lecteur restés derrière.
      const focusables = panel?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusables || focusables.length === 0) return;

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

    // Écoute en capture : le lecteur pose son propre gestionnaire sur
    // `document`, et sans la capture il traiterait la touche avant nous.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Rendre le focus là où il était évite de le voir repartir en
      // haut de page — invisible à la souris, bloquant à la télécommande.
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  if (!mounted) return null;

  const LABELS: Record<VideoFitMode, { label: string; hint: string }> = {
    contain: {
      label: t('player.fitContain'),
      hint: t('player.fitContainDescription'),
    },
    cover: {
      label: t('player.fitCover'),
      hint: t('player.fitCoverDescription'),
    },
    fill: {
      label: t('player.fitFill'),
      hint: t('player.fitFillDescription'),
    },
  };

  return createPortal(
    <div
      className="cinema fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-3"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('player.fitTitle')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-black border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-bold text-white text-sm">{t('player.fitTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="px-3 py-2 space-y-0.5">
          {VIDEO_FIT_MODES.map((mode) => (
            <li key={mode}>
              <FitRow
                label={LABELS[mode].label}
                hint={LABELS[mode].hint}
                selected={mode === current}
                onSelect={() => {
                  onSelect(mode);
                  onClose();
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}

function FitRow({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  /** Phrase expliquant ce que le mode fait réellement à l'image. */
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      // `aria-pressed` : un lecteur d'écran doit annoncer l'état, pas
      // seulement le libellé.
      aria-pressed={selected}
      className={cn(
        'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1',
        selected
          ? 'bg-accent/15 text-white'
          : 'text-white/70 hover:bg-white/5 hover:text-white'
      )}
    >
      <span className="min-w-0">
        <span className={cn('block text-sm truncate', selected && 'font-medium')}>
          {label}
        </span>
        {/* La description compte autant que le libellé : « Remplir »
            seul ne dit pas qu'on perd les bords de l'image. */}
        <span className="block text-xs text-white/40 mt-0.5">{hint}</span>
      </span>
      {selected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
    </button>
  );
}
