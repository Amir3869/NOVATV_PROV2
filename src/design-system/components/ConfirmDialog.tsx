'use client';

/**
 * Boîte de confirmation pour une action irréversible.
 *
 * Écrite à la main plutôt qu'avec `<dialog>` natif : sur les WebView
 * anciennes de Fire OS, `showModal()` est absent ou se comporte mal, et
 * la cible principale du projet est justement le Firestick.
 *
 * Trois exigences d'accessibilité, indispensables à la télécommande :
 *
 *  1. Le focus entre dans la boîte à l'ouverture, sinon un utilisateur
 *     à la télécommande ne peut atteindre aucun bouton.
 *  2. Le focus reste prisonnier tant qu'elle est ouverte (« piège à
 *     focus ») : sans cela, la navigation part dans la page du dessous,
 *     invisible, et l'utilisateur croit l'application bloquée.
 *  3. Le focus retourne d'où il venait à la fermeture.
 *
 * La boîte est rendue dans `<body>` par un « portail » React, et non à
 * l'endroit du code où on l'écrit. Raison : une propriété comme
 * `backdrop-blur` (l'effet de verre) crée ce que CSS appelle un
 * « contexte d'empilement ». À l'intérieur d'un tel parent, `z-50` ne
 * classe la boîte que par rapport à ses frères — jamais au-dessus du
 * reste de la page. La boîte passait donc DERRIÈRE les cartes de la
 * page Mes sources. Un portail la sort de tout parent flouté : elle est
 * alors comparée aux éléments de `<body>`, et son `z-index` compte
 * vraiment. Le comportement React (état, événements) est inchangé.
 */

import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/utils/cn';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Conséquence concrète de l'action, en une phrase. */
  message: string;
  /** Précision secondaire : ce qui sera effacé, ce qui est conservé. */
  detail?: string;
  confirmLabel: string;
  /** Rouge pour une suppression, accent pour une action ordinaire. */
  tone?: 'danger' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Éléments capables de recevoir le focus, dans l'ordre du document. */
/**
 * Abonnement vide : la valeur « on est dans le navigateur » ne change
 * jamais après le montage, il n'y a donc rien à écouter.
 */
function subscribeNoop(): () => void {
  return () => {};
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Mémorise l'élément actif AVANT l'ouverture, pour y revenir ensuite.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleCancel = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    // Le focus va sur Confirmer, mais ce n'est PAS le bouton par défaut
    // de la touche Entrée : l'utilisateur doit viser volontairement.
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Tabulation circulaire : on referme la boucle aux deux bouts.
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Le focus revient à son point de départ, sinon il retombe sur
      // `<body>` et la navigation à la télécommande repart du haut de
      // la page.
      previousFocusRef.current?.focus?.();
    };
  }, [open, handleCancel]);

  // `document` n'existe pas au rendu serveur : on n'ouvre le portail
  // qu'une fois le composant monté dans le navigateur. `useSyncExternalStore`
  // répond exactement à cette question — « suis-je côté client ? » — sans
  // appeler setState depuis un effet, ce que le linter React interdit.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Voile d'arrière-plan. `aria-hidden` : c'est une décoration, il
          n'a rien à annoncer. Le clic ferme, comme un appui sur Échap. */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={handleCancel}
      />

      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-md rounded-2xl bg-[#12141a] border border-white/10 shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              tone === 'danger' ? 'bg-red-500/15' : 'bg-accent/15'
            )}
          >
            <AlertTriangle
              className={cn('w-5 h-5', tone === 'danger' ? 'text-red-400' : 'text-accent')}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="font-bold text-white">
              {title}
            </h2>
            <p id="confirm-message" className="text-sm text-white/60 mt-1">
              {message}
            </p>
            {detail && <p className="text-xs text-white/40 mt-2">{detail}</p>}
          </div>

          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            aria-label={t('common.close')}
            className="text-white/40 hover:text-white transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40',
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-accent-hover'
            )}
          >
            {busy ? t('common.loading') : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
