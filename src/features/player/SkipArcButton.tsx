'use client';

import type { MouseEvent } from 'react';
import { cn } from '@/utils/cn';

/**
 * Bouton −10 s / +10 s : un mini-arc autour du chiffre, pas une flèche.
 * Le signe (+ / −) est dans le texte, sinon on ne le voit pas.
 */
export function SkipArcButton({
  seconds = 10,
  direction,
  onClick,
  disabled,
  label,
}: {
  seconds?: number;
  direction: 'back' | 'forward';
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  label: string;
}) {
  const signed = direction === 'back' ? `−${seconds}` : `+${seconds}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-lg backdrop-blur-md pointer-events-auto disabled:opacity-30"
    >
      <svg
        viewBox="0 0 48 48"
        className={cn('absolute inset-0.5 text-white/80', direction === 'forward' && '-scale-x-100')}
        aria-hidden
      >
        <path
          d="M12.5 18.8a13.6 13.6 0 1 0 8.2-6.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M10.6 12.4v7.2h7.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="relative z-[1] text-[15px] font-extrabold tabular-nums leading-none tracking-tight">
        {signed}
      </span>
    </button>
  );
}
