/**
 * TezMind Design System — Tokens
 *
 * Single source of truth for colors, typography, spacing, radii, shadows.
 * Used throughout the web app (editor-ui takes these via props/context).
 */

export const colors = {
  // Brand
  primary: '#10A37F',
  primaryLight: '#2BB995',
  primaryDark: '#087F5B',
  primaryMuted: 'rgba(16, 163, 127, 0.10)',

  // Accent
  accent: '#10A37F',
  accentLight: '#2BB995',
  accentDark: '#087F5B',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.12)',

  // Clean light workspace
  bg: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgInput: '#F7F7F8',
  surface: '#F4F4F4',
  surfaceHover: '#ECECEC',
  border: '#E5E5E5',
  borderLight: '#D4D4D4',

  // Text
  text: '#202123',
  textSecondary: '#666666',
  textTertiary: '#888888',
  textInverted: '#FFFFFF',

  // Canvas
  canvasBg: '#F7F7F8',
  canvasGrid: 'rgba(0, 0, 0, 0.035)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: 11,
    sm: 12,
    md: 14,
    base: 15,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 40,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.24)',
  md: '0 4px 6px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
  lg: '0 10px 25px rgba(0,0,0,0.5), 0 6px 10px rgba(0,0,0,0.3)',
  xl: '0 20px 40px rgba(0,0,0,0.6), 0 10px 20px rgba(0,0,0,0.4)',
  glow: '0 0 20px rgba(124, 92, 252, 0.3), 0 0 40px rgba(124, 92, 252, 0.15)',
  glowAccent: '0 0 20px rgba(0, 212, 170, 0.3)',
} as const;

export const transitions = {
  fast: '0.1s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
  spring: '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  overlay: 100,
  modal: 200,
  toast: 300,
} as const;
