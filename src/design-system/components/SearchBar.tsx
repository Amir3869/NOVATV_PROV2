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
      <Search className="absolute left-3.5 w-4 h-4 text-white/40 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30',
          'bg-white/6 border border-white/8 backdrop-blur-xl',
          'focus:outline-none focus:border-accent/50 focus:bg-white/8',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          onClick={() => { onChange(''); onClear?.(); ref.current?.focus(); }}
          className="absolute right-3.5 text-white/40 hover:text-white/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
