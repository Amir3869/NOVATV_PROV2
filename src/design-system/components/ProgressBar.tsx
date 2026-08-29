import React from 'react';
import { cn } from '@/utils/cn';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  color?: 'red' | 'white' | 'green';
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

const colorStyles = {
  red: 'bg-accent',
  white: 'bg-white/80',
  green: 'bg-emerald-500',
};

const sizeStyles = {
  xs: 'h-0.5',
  sm: 'h-1',
  md: 'h-1.5',
};

export function ProgressBar({ value, className, color = 'red', size = 'sm', showLabel = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 rounded-full bg-white/10 overflow-hidden', sizeStyles[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', colorStyles[color])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-white/50 min-w-[2.5rem] text-right">{clamped}%</span>
      )}
    </div>
  );
}
