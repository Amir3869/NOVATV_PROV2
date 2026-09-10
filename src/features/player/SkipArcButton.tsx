'use client';

import type { MouseEvent } from 'react';
import { cn } from '@/utils/cn';

/**
 * Bouton −10 s / +10 s : un mini-arc autour du chiffre, pas une flèche.
 * Même geste que Canal+ / Netflix.
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
        className={cn('absolute inset-1', direction === 'forward' && '-scale-x-100')}
        aria-hidden
      >
        <path
          d="M13 18.4a13.2 13.2 0 1 0 7.6-6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M11.2 12.2v6.8h6.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="relative text-sm font-bold tabular-nums leading-none">{seconds}</span>
    </button>
  );
}
