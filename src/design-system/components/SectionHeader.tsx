import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  className?: string;
  accent?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  onSeeAll,
  seeAllLabel = 'Voir tout',
  className,
  accent = false,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between', className)}>
      <div>
        <h2 className={cn(
          'text-lg font-bold text-white',
          accent && 'flex items-center gap-2 before:content-[""] before:w-0.5 before:h-5 before:bg-accent before:rounded-full'
        )}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-sm text-white/50 hover:text-accent transition-colors font-medium"
        >
          {seeAllLabel}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
