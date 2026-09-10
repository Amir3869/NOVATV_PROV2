'use client';

/**
 * Fenêtre unique de l'application.
 *
 * Toutes les boîtes (confirmation, renommage, profil, PIN, listes)
 * passent par ici. Trois règles non négociables :
 *
 *  1. Portail vers `document.body`. Un parent `backdrop-blur` (le verre
 *     des cartes) crée un containing block : `position: fixed` y est
 *     prisonnier de la carte, et la fenêtre se retrouve collée en bas
 *     de l'écran, hors champ. Le portail sort de ce piège.
 *  2. Toujours centrée, jamais ancrée en bas. Sur téléphone le pied
 *     d'écran est déjà occupé par la navigation.
 *  3. Jetons de thème (`surface-2`, `line`, `text-white`) — jamais de
 *     hex figé. En thème clair le panneau reste lisible ; le lecteur,
 *     lui, pose `cinema` pour forcer le blanc sur la vidéo.
 *
 * Accessibilité télécommande : piège à focus, Échap, restitution du
 * focus, boutons à 44 px. Pas de `<dialog>` natif : `showModal()` est
 * absent ou cassé sur les WebView Fire OS.
 */

import React, { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/utils/cn';

function subscribeNoop(): () => void {
  return () => {};
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZE = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
} as const;

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZE;
  role?: 'dialog' | 'alertdialog';
  busy?: boolean;
  showClose?: boolean;
  closeOnOverlay?: boolean;
  /** Force le blanc cinéma (menus du lecteur). */
  cinema?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
  role = 'dialog',
  busy = false,
  showClose = true,
  closeOnOverlay = true,
  cinema = false,
  initialFocusRef,
  className,
}: AppDialogProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const handleClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    // Sur téléphone, focuser un champ ouvre le clavier tout de suite.
    // On pose le focus sur le panneau ; l'utilisateur tape le champ.
    const focusTarget = initialFocusRef?.current ?? panel;
    focusTarget?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;

      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, handleClose, initialFocusRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[300] flex items-center justify-center p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]',
        cinema && 'cinema',
      )}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={closeOnOverlay ? handleClose : undefined}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative w-full rounded-2xl bg-surface-2 border border-line shadow-2xl',
          'flex flex-col max-h-[90dvh]',
          SIZE[size],
          className,
        )}
      >
        <div className="flex items-start gap-3 px-6 pt-6 pb-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-white">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-white/60 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              aria-label={t('common.close')}
              className="w-11 h-11 -mt-1 -me-2 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {children != null && (
          <div className="px-6 py-3 overflow-y-auto min-h-0 flex-1">{children}</div>
        )}

        {footer && <div className="px-6 pb-6 pt-2 flex-shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
