import React from 'react';
import { cn } from '@/utils/cn';

interface NovaLogoProps {
  variant?: 'full' | 'horizontal' | 'compact' | 'icon';
  colorScheme?: 'default' | 'white' | 'red' | 'mono';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: { icon: 20, text: 'text-sm' },
  sm: { icon: 28, text: 'text-base' },
  md: { icon: 36, text: 'text-xl' },
  lg: { icon: 48, text: 'text-2xl' },
  xl: { icon: 64, text: 'text-4xl' },
};

// SVG Icon mark – a stylized "N" inside a TV-screen shape with a play triangle
function NovaIcon({ size = 36, color = '#C8102E', bgColor = 'transparent' }: {
  size?: number;
  color?: string;
  bgColor?: string;
}) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Screen shape */}
      <rect x="2" y="6" width="44" height="32" rx="5" fill={bgColor} stroke={color} strokeWidth="2.5"/>
      {/* Antenna left */}
      <line x1="16" y1="6" x2="10" y2="1" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      {/* Antenna right */}
      <line x1="32" y1="6" x2="38" y2="1" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      {/* Stand */}
      <rect x="18" y="38" width="12" height="4" rx="1" fill={color}/>
      <rect x="14" y="42" width="20" height="3" rx="1.5" fill={color}/>
      {/* Play triangle (centered in screen) */}
      <path d="M20 16 L20 30 L34 23 Z" fill={color}/>
      {/* Small dot – live indicator */}
      <circle cx="8" cy="12" r="2" fill={color} opacity="0.7"/>
    </svg>
  );
}

export function NovaLogo({ variant = 'full', colorScheme = 'default', size = 'md', className }: NovaLogoProps) {
  const s = sizes[size];

  const textColor =
    colorScheme === 'white' ? 'text-white' :
    colorScheme === 'mono' ? 'text-white' :
    'text-white';

  const iconColor =
    colorScheme === 'white' ? '#FFFFFF' :
    colorScheme === 'mono' ? '#FFFFFF' :
    colorScheme === 'red' ? '#C8102E' :
    '#C8102E';

  if (variant === 'icon') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <NovaIcon size={s.icon} color={iconColor} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <NovaIcon size={s.icon * 0.75} color={iconColor} />
        <span className={cn('font-black tracking-tight leading-none', s.text, textColor)}>
          Nova<span style={{ color: iconColor }}>TV</span>
        </span>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <NovaIcon size={s.icon} color={iconColor} />
        <div className="flex flex-col leading-none">
          <span className={cn('font-black tracking-tight', s.text, textColor)}>
            Nova<span style={{ color: iconColor }}>TV</span>
          </span>
          <span className="text-[10px] tracking-widest font-medium text-white/40 uppercase">
            Premium Streaming
          </span>
        </div>
      </div>
    );
  }

  // Full / stacked
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <NovaIcon size={s.icon} color={iconColor} />
      <span className={cn('font-black tracking-tight leading-none', s.text, textColor)}>
        Nova<span style={{ color: iconColor }}>TV</span>
      </span>
    </div>
  );
}
