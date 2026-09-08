'use client';

import { cn } from '@/utils/cn';

/**
 * Nom trop long pour la carte : on le fait défiler.
 *
 * Au-delà de 3 caractères (demande utilisateur : préfixes type
 * `lFRl TF1 FHD` sinon illisibles), une animation CSS fait passer
 * le texte. Coupée si `data-motion='off'`.
 */
export function ScrollingText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const animate = text.trim().length > 3;

  return (
    <span className={cn('block overflow-hidden whitespace-nowrap', className)}>
      <span
        className={cn(
          'inline-block max-w-none',
          animate && 'scroll-channel-name'
        )}
      >
        {text}
        {animate ? `\u00a0\u00a0\u00a0\u00a0${text}` : null}
      </span>
    </span>
  );
}
