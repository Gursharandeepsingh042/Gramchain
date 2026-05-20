// GramChain Design System — Spacing, Shadows, Border Radii, Animations

import { Platform } from 'react-native'

// ─── Spacing Scale (4px base grid) ───────────────────────────────
export const spacing = {
  0:    0,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  11:   44,
  12:   48,
  14:   56,
  16:   64,
  18:   72,
  20:   80,
  24:   96,
  28:   112,
  32:   128,

  // Semantic tokens
  screenPadding:     20,
  sectionGap:        24,
  cardPadding:       20,
  inputPadding:      16,
  buttonPaddingV:    16,
  buttonPaddingH:    24,
  tabBarHeight:      64,
  headerHeight:      56,
  safeAreaBottom:    20,
} as const

// ─── Border Radii ─────────────────────────────────────────────────
export const radius = {
  none:    0,
  sm:      4,
  base:    8,
  md:      12,
  lg:      16,
  xl:      20,
  '2xl':   24,
  '3xl':   28,
  full:    9999,

  // Component-specific
  button:  16,
  card:    20,
  input:   12,
  pill:    9999,
  avatar:  9999,
  chip:    8,
  modal:   24,
  tab:     12,
} as const

// ─── Shadows ─────────────────────────────────────────────────────
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  // Brand shadow
  green: {
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  amber: {
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 5,
  },
} as const

// ─── Animation Timing ─────────────────────────────────────────────
export const animation = {
  // Durations (ms)
  duration: {
    instant:    0,
    fast:       150,
    normal:     250,
    slow:       400,
    verySlow:   600,
    gauge:      2000,
    skeleton:   1200,
    confetti:   3000,
  },

  // Spring configs for react-native-reanimated
  spring: {
    snappy: {
      damping:   25,
      stiffness: 300,
    },
    bouncy: {
      damping:   12,
      stiffness: 150,
    },
    gentle: {
      damping:   20,
      stiffness: 90,
    },
    slow: {
      damping:   30,
      stiffness: 60,
    },
  },
} as const

// ─── Z-Index ─────────────────────────────────────────────────────
export const zIndex = {
  base:     0,
  card:     10,
  dropdown: 100,
  modal:    200,
  toast:    300,
  overlay:  400,
  tooltip:  500,
} as const

// ─── Hit Slop (min touch target 48×48dp WCAG 2.1 AA) ─────────────
export const hitSlop = {
  xs:  { top: 8,  bottom: 8,  left: 8,  right: 8  },
  sm:  { top: 10, bottom: 10, left: 10, right: 10 },
  md:  { top: 12, bottom: 12, left: 12, right: 12 },
  lg:  { top: 16, bottom: 16, left: 16, right: 16 },
} as const

// ─── Responsive Layout Helpers ───────────────────────────────────
// Breakpoints (matches Tailwind's md/lg roughly)
export const breakpoints = {
  tablet: 768,
  desktop: 1024,
} as const

/**
 * Returns the standard horizontal screen padding for a given width.
 * Phone: 24, Tablet: 32, Desktop: 48.
 * Use everywhere instead of hand-rolling per-screen rules.
 */
export const getScreenPadding = (width: number): number => {
  if (width >= breakpoints.desktop) return 48
  if (width >= breakpoints.tablet)  return 32
  return 24
}

/** Max width for centered form / content cards on wide screens. */
export const FORM_MAX_WIDTH = 560

