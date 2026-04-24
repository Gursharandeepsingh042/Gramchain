// GramChain Design System — Complete Color System
// Trust Green + Warm Amber + Sophisticated Neutrals

export const colors = {
  // ─── Primary: Trust Green ───────────────────────────────────
  primary: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',   // Main CTA
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // ─── Secondary: Warm Amber (alerts, attention) ─────────────
  secondary: {
    50:  '#fffbeb',
    100: '#fef3c7',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },

  // ─── Danger / Error ─────────────────────────────────────────
  danger: {
    50:  '#fef2f2',
    100: '#fee2e2',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },

  // ─── Info / Blockchain ──────────────────────────────────────
  info: {
    50:  '#eff6ff',
    100: '#dbeafe',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  },

  // ─── Neutrals ───────────────────────────────────────────────
  gray: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    150: '#eef0f3',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // ─── Semantic Tokens ────────────────────────────────────────
  background:     '#f5f7fa',   // Slightly off-white
  backgroundDark: '#0f1923',
  surface:        '#ffffff',
  surfaceElevated:'#fafbfc',
  border:         '#e5e7eb',
  borderFocus:    '#16a34a',
  overlay:        'rgba(0,0,0,0.45)',

  // ─── Text ───────────────────────────────────────────────────
  text: {
    primary:      '#111827',
    secondary:    '#6b7280',
    tertiary:     '#9ca3af',
    inverse:      '#ffffff',
    brand:        '#16a34a',
    warning:      '#d97706',
    danger:       '#dc2626',
  },

  // ─── Gradients (for LinearGradient) ─────────────────────────
  gradient: {
    primary:       ['#22c55e', '#16a34a'],         // Green
    primaryDeep:   ['#16a34a', '#14532d'],         // Deep green
    hero:          ['#1a7a3a', '#0f5523'],          // Hero card
    warm:          ['#f59e0b', '#d97706'],          // Amber
    card:          ['#ffffff', '#f9fafb'],           // Subtle card
    blockchain:    ['#2563eb', '#1d4ed8'],          // Blue blockchain
    danger:        ['#ef4444', '#dc2626'],          // Red
    success:       ['#22c55e', '#16a34a'],          // Success
    sky:           ['#bae6fd', '#7dd3fc'],           // Light blue
    onboarding1:   ['#f0fdf4', '#dcfce7'],
    onboarding2:   ['#fffbeb', '#fef3c7'],
  },

  // ─── Score Colors (Credit Gauge) ────────────────────────────
  score: {
    poor:     '#dc2626',   // < 500
    fair:     '#f59e0b',   // 500–649
    good:     '#22c55e',   // 650–749
    excellent:'#16a34a',   // 750+
  },

  // ─── Status Pills ───────────────────────────────────────────
  status: {
    active:   { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
    pending:  { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
    approved: { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
    rejected: { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
    closed:   { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' },
  },

  // ─── Shadows ────────────────────────────────────────────────
  shadow: {
    sm:  'rgba(0,0,0,0.06)',
    md:  'rgba(0,0,0,0.10)',
    lg:  'rgba(0,0,0,0.15)',
    green:'rgba(22,163,74,0.25)',
  },
} as const

export type ColorToken = keyof typeof colors
