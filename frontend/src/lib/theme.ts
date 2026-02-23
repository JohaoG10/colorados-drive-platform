/**
 * Design system — Colorados Drive
 * Premium SaaS/fintech con identidad roja.
 */

export const colors = {
  // Brand red palette
  redDeep: '#991b1b',       // red-800 — CTAs, acentos fuertes
  red: '#dc2626',           // red-600 — primario
  redLight: '#fecaca',      // red-200 — fondos suaves
  redSoft: '#fef2f2',       // red-50
  redNeon: 'rgba(248, 113, 113, 0.4)', // red-400 con alpha — glow suave
  // Neutrals
  neutral: {
    950: '#0a0a0a',
    900: '#171717',
    800: '#262626',
    700: '#404040',
    600: '#525252',
    500: '#737373',
    400: '#a3a3a3',
    300: '#d4d4d4',
    200: '#e5e5e5',
    100: '#f5f5f5',
    50: '#fafafa',
  },
  white: '#ffffff',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
  glow: '0 0 40px -8px rgba(220, 38, 38, 0.35), 0 0 20px -10px rgba(220, 38, 38, 0.2)',
  glowSoft: '0 0 60px -12px rgba(248, 113, 113, 0.25)',
  cardHover: '0 24px 48px -12px rgb(0 0 0 / 0.12), 0 0 0 1px rgba(220, 38, 38, 0.06)',
} as const;

export const radius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.25rem', // 20px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

export const spacing = {
  sectionY: 'py-24 sm:py-28 md:py-32',
  sectionX: 'px-4 sm:px-6 lg:px-8',
  block: 'gap-16 lg:gap-24',
  card: 'p-6 sm:p-8',
} as const;

export const typography = {
  label: 'text-[11px] font-semibold uppercase tracking-[0.2em]',
  heading1: 'text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight',
  heading2: 'text-2xl sm:text-3xl font-bold tracking-tight',
  heading3: 'text-lg font-semibold',
  body: 'text-base leading-relaxed',
  bodySm: 'text-sm leading-relaxed',
  muted: 'text-neutral-500',
} as const;

export const maxWidth = {
  content: 'max-w-5xl mx-auto',
  narrow: 'max-w-2xl mx-auto',
  wide: 'max-w-6xl mx-auto',
} as const;
