import React from 'react';
import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'live' | 'new' | 'hd' | 'default' | 'genre' | 'rating';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  pulse?: boolean;
}

const variantStyles = {
  live: 'bg-accent text-white font-bold tracking-widest',
  new: 'bg-emerald-600/90 text-white font-semibold',
  hd: 'bg-white/10 text-white/70 border border-white/20 font-medium',
  default: 'bg-white/10 text-white/60 border border-white/10',
  genre: 'bg-white/8 text-white/60 border border-white/10',
  rating: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold',
};

const sizeStyles = {
  xs: 'text-[9px] px-1.5 py-0.5',
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export function Badge({ children, variant = 'default', size = 'sm', className, pulse = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded uppercase tracking-wider',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {variant === 'live' && pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}
