'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';
import { qualityLabel, AUTO_LEVEL } from '@/services/player/qualityLadder';
import type { QualityState } from './useVideoPlayer';

interface QualityMenuProps {
  quality: QualityState;
  /** `-1` rend la main à l'adaptation automatique. */
  onSelect: (index: number) => void;
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
 * Menu de sélection de la qualité vidéo.
 *
 * Les qualités proposées sont celles que le flux déclare réellement,
 * lues dans son manifeste. Rien n'est inventé : sur une chaîne qui ne
 * publie que du 576p et du 240p, le menu n'affiche que ces deux lignes.
 *
 * Rendu dans un portail vers `document.body`. Le lecteur applique un
 * `backdrop-blur`, qui crée un contexte d'empilement CSS : un `z-index`
 * élevé n'y suffirait pas, le menu resterait prisonnier de son parent.
 * Même correctif que pour `ConfirmDialog`.
 */
export function QualityMenu({ quality, onSelect, onClose }: QualityMenuProps) {
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

    // En capture : le lecteur écoute les touches sur `document`. Sans
    // cela, Espace mettrait la vidéo en pause pendant la navigation.
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  if (!mounted) return null;

  const { levels, currentLevel, autoMode } = quality;

  return createPortal(
    <div
      className="cinema fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('player.qualityTitle')}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-80 max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-1 border border-line shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-surface-1">
          <h2 className="font-bold text-white">{t('player.qualityTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="px-5 py-4 space-y-1">
          {/* « Auto » en tête : c'est le choix recommandé et le plus
              fréquent, il doit être atteignable en un cran de
              télécommande. Il indique la variante réellement diffusée
              pour que l'utilisateur sache ce qu'il regarde. */}
          <li>
            <QualityRow
              label={t('player.qualityAuto')}
              hint={
                autoMode && currentLevel >= 0 && levels[currentLevel]
                  ? qualityLabel(levels[currentLevel], currentLevel)
                  : undefined
              }
              selected={autoMode}
              onSelect={() => {
                onSelect(AUTO_LEVEL);
                onClose();
              }}
            />
          </li>

          {levels.map((level, index) => (
            <li key={`${level.height ?? 0}-${level.bitrate ?? 0}-${index}`}>
              <QualityRow
                label={qualityLabel(level, index)}
                selected={!autoMode && index === currentLevel}
                onSelect={() => {
                  onSelect(index);
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

function QualityRow({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  /** Précision affichée en gris, par exemple la variante active. */
  hint?: string;
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
        'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1',
        selected
          ? 'bg-accent/15 text-white font-medium'
          : 'text-white/70 hover:bg-white/5 hover:text-white'
      )}
    >
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="truncate">{label}</span>
        {hint && <span className="text-xs text-white/40 flex-shrink-0">{hint}</span>}
      </span>
      {selected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
    </button>
  );
}
