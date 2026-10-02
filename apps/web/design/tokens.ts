/**
 * TezMind Design System — Tokens
 *
 * Single source of truth for colors, typography, spacing, radii, shadows.
 * Used throughout the web app (editor-ui takes these via props/context).
 */

export const colors = {
  // Brand
  primary: '#7C5CFC',
  primaryLight: '#9B7FFD',
  primaryDark: '#5E3EDB',
  primaryMuted: 'rgba(124, 92, 252, 0.12)',

  // Accent
  accent: '#00D4AA',
  accentLight: '#33DDBB',
  accentDark: '#00A884',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.12)',

  // Dark theme (primary)
  bg: '#0A0A0F',
  bgElevated: '#111118',
  bgCard: '#16161F',
  bgInput: '#1C1C28',
  surface: '#1E1E2A',
  surfaceHover: '#252535',
  border: '#2A2A3A',
  borderLight: '#353550',

  // Text
  text: '#F0F0F8',
  textSecondary: '#9090B0',
  textTertiary: '#5A5A7A',
  textInverted: '#0A0A0F',

  // Canvas
  canvasBg: '#07070D',
  canvasGrid: 'rgba(124, 92, 252, 0.06)',

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
