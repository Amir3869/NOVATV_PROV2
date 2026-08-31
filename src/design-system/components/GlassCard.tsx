import React from 'react';
import { cn } from '@/utils/cn';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'glass' | 'opaque' | 'dark' | 'red';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  as?: 'div' | 'article' | 'section';
}

const variantStyles = {
  glass: 'bg-white/5 backdrop-blur-xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
  opaque: 'bg-surface-3 border border-white/5 shadow-lg',
  dark: 'bg-surface-2/90 backdrop-blur-xl border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
  red: 'bg-accent/10 backdrop-blur-xl border border-accent/25 shadow-[0_8px_32px_rgba(200,16,46,0.15)]',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function GlassCard({
  children,
  className,
  variant = 'glass',
  padding = 'md',
  hover = false,
  onClick,
  as: Tag = 'div',
}: GlassCardProps) {
  return (
    <Tag
      className={cn(
        'rounded-xl transition-all duration-200',
        variantStyles[variant],
        paddingStyles[padding],
        hover && 'hover:bg-white/8 hover:border-white/12 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}
