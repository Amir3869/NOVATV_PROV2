import React from 'react';
import { cn } from '@/utils/cn';

/**
 * Une action proposée depuis un écran vide.
 *
 * Le libellé est déjà traduit par l'appelant : ce composant ne connaît
 * pas les clés de traduction, il affiche le texte qu'on lui donne.
 */
interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  /** Action principale, mise en avant en couleur d'accentuation. */
  action?: EmptyStateAction;
  /**
   * Seconde action, facultative, au style discret.
   *
   * ─── Pourquoi deux actions ─────────────────────────────────────
   *
   * Un écran vide a souvent deux issues légitimes, et forcer un seul
   * bouton oblige à en cacher une. Le cas concret : l'accueil sans
   * contenu doit proposer « Synchroniser » — relancer la
   * récupération du catalogue depuis la source déjà enregistrée — et
   * « Gérer mes sources », pour celui dont la source est en cause.
   * Avec un seul bouton, l'un des deux profils reste bloqué.
   *
   * Elle n'est rendue que si `action` existe aussi : une action
   * secondaire seule n'aurait pas de sens, et la hiérarchie visuelle
   * (accentué / discret) suppose un principal à côté.
   */
  secondaryAction?: EmptyStateAction;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Styles communs aux deux boutons.
 *
 * L'anneau de focus est indispensable ici : sur téléviseur, la
 * navigation se fait à la télécommande, et un bouton dont on ne voit
 * pas qu'il est sélectionné rend l'écran inutilisable. `focus-visible`
 * n'affiche l'anneau qu'au clavier et à la télécommande, jamais au
 * clic de souris.
 */
const BUTTON_BASE =
  'px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black';

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
}: EmptyStateProps) {
  const emojiSize = size === 'sm' ? 'text-4xl' : size === 'md' ? 'text-5xl' : 'text-6xl';
  const titleSize = size === 'sm' ? 'text-base' : size === 'md' ? 'text-lg' : 'text-xl';

  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      {emoji ? (
        <div className={cn('mb-4', emojiSize)}>{emoji}</div>
      ) : icon ? (
        <div className="mb-4 text-white/20">{icon}</div>
      ) : null}
      <h3 className={cn('font-semibold text-white/70 mb-2', titleSize)}>{title}</h3>
      {description && (
        <p className="text-sm text-white/40 max-w-xs">{description}</p>
      )}
      {action && (
        // `flex-wrap` évite que les deux boutons débordent sur un
        // écran étroit : ils passent l'un sous l'autre.
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            // Sans `type`, un bouton vaut `submit` : placé dans un
            // formulaire, il en déclencherait l'envoi et rechargerait
            // la page au lieu d'exécuter `onClick`.
            type="button"
            onClick={action.onClick}
            className={cn(BUTTON_BASE, 'bg-accent hover:bg-accent-hover text-white')}
          >
            {action.label}
          </button>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={cn(
                BUTTON_BASE,
                'bg-white/5 border border-white/8 text-white/60 hover:bg-white/10'
              )}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
