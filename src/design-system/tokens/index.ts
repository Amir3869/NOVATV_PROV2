export { colors } from './colors';
export { typography } from './typography';

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  56: '14rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px',
  card: '0.875rem',
  modal: '1.25rem',
  button: '0.625rem',
  chip: '9999px',
  avatar: '9999px',
  badge: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.5)',
  md: '0 4px 12px rgba(0,0,0,0.4)',
  lg: '0 8px 24px rgba(0,0,0,0.5)',
  xl: '0 16px 48px rgba(0,0,0,0.6)',
  '2xl': '0 24px 72px rgba(0,0,0,0.7)',
  glass: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
  glassHover: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
  red: '0 0 20px rgba(200,16,46,0.3), 0 4px 12px rgba(200,16,46,0.2)',
  redGlow: '0 0 40px rgba(200,16,46,0.4)',
  focus: '0 0 0 2px rgba(200,16,46,0.6)',
  card: '0 4px 16px rgba(0,0,0,0.5)',
  cardHover: '0 8px 32px rgba(0,0,0,0.6)',
  none: 'none',
} as const;

export const blur = {
  none: '0',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
  '2xl': '64px',
  glass: '20px',
  heavy: '48px',
} as const;

export const animations = {
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
    slower: '600ms',
    slowest: '1000ms',
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

export const breakpoints = {
  xs: '375px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  tv: '1920px',
} as const;

export const cardDimensions = {
  channel: { width: 160, height: 90 },
  channelSm: { width: 120, height: 68 },
  movie: { width: 160, height: 240 },
  movieMd: { width: 200, height: 300 },
  movieLg: { width: 240, height: 360 },
  series: { width: 160, height: 240 },
  episode: { width: 280, height: 158 },
  hero: { width: '100%', height: 600 },
} as const;
