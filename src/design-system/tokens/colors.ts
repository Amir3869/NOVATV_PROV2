export const colors = {
  // Base blacks & carbons
  black: {
    pure: '#000000',
    deep: '#050505',
    carbon: '#0A0A0A',
    rich: '#0F0F0F',
    soft: '#141414',
    elevated: '#1A1A1A',
  },

  // Grays
  gray: {
    900: '#1C1C1E',
    850: '#242424',
    800: '#2C2C2E',
    750: '#333333',
    700: '#3A3A3C',
    600: '#48484A',
    500: '#636366',
    400: '#8E8E93',
    300: '#AEAEB2',
    200: '#C7C7CC',
    150: '#D1D1D6',
    100: '#E5E5EA',
    50: '#F2F2F7',
  },

  // Off-whites
  white: {
    pure: '#FFFFFF',
    soft: '#F5F5F5',
    warm: '#F0EDE8',
    muted: '#E8E5E0',
    dim: '#D4D0C8',
  },

  // Reds (primary accent)
  red: {
    950: '#1A0000',
    900: '#2D0000',
    800: '#4A0000',
    700: '#6B0000',
    600: '#8B0000',
    500: '#B00020',
    400: '#CC0022',
    300: '#E31837',
    premium: '#C8102E',
    cinema: '#DC143C',
    accent: '#E8162E',
    200: '#FF4D63',
    100: '#FF8A95',
    50: '#FFD6DB',
    glow: 'rgba(200, 16, 46, 0.4)',
    halo: 'rgba(200, 16, 46, 0.2)',
    subtle: 'rgba(200, 16, 46, 0.1)',
  },

  // Glass surfaces
  glass: {
    black: 'rgba(0, 0, 0, 0.75)',
    blackLight: 'rgba(0, 0, 0, 0.5)',
    blackSubtle: 'rgba(0, 0, 0, 0.3)',
    carbon: 'rgba(10, 10, 10, 0.8)',
    dark: 'rgba(20, 20, 20, 0.85)',
    darkMedium: 'rgba(26, 26, 26, 0.8)',
    medium: 'rgba(36, 36, 36, 0.75)',
    light: 'rgba(255, 255, 255, 0.05)',
    lightMedium: 'rgba(255, 255, 255, 0.08)',
    lightStrong: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderMedium: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    red: 'rgba(200, 16, 46, 0.15)',
    redBorder: 'rgba(200, 16, 46, 0.3)',
  },

  // Semantic
  semantic: {
    live: '#E8162E',
    online: '#30D158',
    offline: '#636366',
    warning: '#FF9F0A',
    error: '#FF453A',
    success: '#30D158',
    info: '#64D2FF',
  },

  // Overlays
  overlay: {
    black: 'rgba(0,0,0,0.9)',
    heavy: 'rgba(0,0,0,0.75)',
    medium: 'rgba(0,0,0,0.5)',
    light: 'rgba(0,0,0,0.3)',
    hero: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 100%)',
  },
} as const;

export type ColorToken = typeof colors;
