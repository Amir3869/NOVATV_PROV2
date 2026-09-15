'use client';

import { Sun, Volume2 } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Pastille volume / luminosité, visible seulement pendant le geste
 * sur le bord de l'écran (Netflix / Canal+). Pas au tap.
 */
export function EdgeLevelHud({
  kind,
  value,
}: {
  kind: 'volume' | 'brightness';
  value: number;
}) {
  const percent = Math.round(Math.max(0, Math.min(100, value)));

  return (
    <div
      className={cn(
        'pointer-events-none absolute top-1/2 z-40 -translate-y-1/2',
        kind === 'brightness' ? 'left-4 sm:left-6' : 'right-4 sm:right-6'
      )}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-3 rounded-[1.6rem] border border-white/15 bg-black/55 px-3.5 py-4 shadow-2xl backdrop-blur-xl">
        {kind === 'brightness' ? (
          <Sun className="h-4 w-4 text-white" />
        ) : (
          <Volume2 className="h-4 w-4 text-white" />
        )}
        <div className="relative h-28 w-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="absolute inset-x-0 bottom-0 rounded-full bg-white"
            style={{ height: `${percent}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-white">{percent}</span>
      </div>
    </div>
  );
}
