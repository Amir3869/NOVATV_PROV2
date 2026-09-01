'use client';

import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onClear?: () => void;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className,
  autoFocus,
  onClear,
}: SearchBarProps) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('relative flex items-center', className)}>
      {/* `start` / `end` / `ps` / `pe` suivent `dir` : en arabe l'icône
          et la croix basculent avec le texte, au lieu de rester calées
          à gauche / à droite du cadre. */}
      <Search className="pointer-events-none absolute start-3.5 h-4 w-4 text-white/40" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'w-full rounded-xl border border-white/8 bg-white/6 py-2.5 ps-10 pe-10 text-sm text-white backdrop-blur-xl placeholder:text-white/30',
          'focus:border-accent/50 focus:bg-white/8 focus:outline-none',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); onClear?.(); ref.current?.focus(); }}
          className="absolute end-3.5 text-white/40 transition-colors hover:text-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
