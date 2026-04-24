// GramChain Design System — Typography
// System fonts for Hindi/Devanagari support, no external webfonts

import { Platform } from 'react-native'

// Devanagari-compatible font stack
const FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
})

const FONT_FAMILY_MEDIUM = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
})

const FONT_FAMILY_BOLD = Platform.select({
  ios: 'System',
  android: 'sans-serif-bold',
  default: 'System',
})

export const typography = {
  fontFamily: {
    regular: FONT_FAMILY!,
    medium:  FONT_FAMILY_MEDIUM!,
    bold:    FONT_FAMILY_BOLD!,
    mono:    Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' })!,
  },

  // ─── Font Sizes ──────────────────────────────────────────────
  fontSize: {
    '2xs': 10,
    xs:    12,
    sm:    14,
    base:  16,
    lg:    18,
    xl:    20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },

  // ─── Font Weights ────────────────────────────────────────────
  fontWeight: {
    normal:    '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },

  // ─── Line Heights ────────────────────────────────────────────
  lineHeight: {
    none:    1.0,
    tight:   1.25,
    snug:    1.375,
    normal:  1.5,
    relaxed: 1.625,
    loose:   1.75,    // Recommended for Devanagari script
    hindi:   1.8,     // Extra spacing for complex Hindi characters
  },

  // ─── Letter Spacing ──────────────────────────────────────────
  letterSpacing: {
    tighter: -0.5,
    tight:   -0.25,
    normal:  0,
    wide:    0.25,
    wider:   0.5,
    widest:  1.0,
  },

  // ─── Pre-composed Text Styles ────────────────────────────────
  presets: {
    hero: {
      fontSize:   36,
      fontWeight: '800' as const,
      lineHeight: 1.2,
      letterSpacing: -0.5,
    },
    h1: {
      fontSize:   30,
      fontWeight: '700' as const,
      lineHeight: 1.25,
      letterSpacing: -0.25,
    },
    h2: {
      fontSize:   24,
      fontWeight: '700' as const,
      lineHeight: 1.3,
      letterSpacing: -0.25,
    },
    h3: {
      fontSize:   20,
      fontWeight: '600' as const,
      lineHeight: 1.35,
    },
    h4: {
      fontSize:   18,
      fontWeight: '600' as const,
      lineHeight: 1.4,
    },
    body: {
      fontSize:   16,
      fontWeight: '400' as const,
      lineHeight: 1.6,
    },
    bodyHindi: {
      fontSize:   16,
      fontWeight: '400' as const,
      lineHeight: 1.8,    // Extra for Devanagari
    },
    caption: {
      fontSize:   14,
      fontWeight: '400' as const,
      lineHeight: 1.5,
    },
    captionSmall: {
      fontSize:   12,
      fontWeight: '400' as const,
      lineHeight: 1.4,
    },
    label: {
      fontSize:   14,
      fontWeight: '600' as const,
      lineHeight: 1.4,
      letterSpacing: 0.1,
    },
    overline: {
      fontSize:   11,
      fontWeight: '600' as const,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    amount: {
      fontSize:   28,
      fontWeight: '800' as const,
      letterSpacing: -0.5,
    },
    amountLg: {
      fontSize:   40,
      fontWeight: '800' as const,
      letterSpacing: -1,
    },
    mono: {
      fontSize:   14,
      fontWeight: '400' as const,
      letterSpacing: 0.5,
    },
  },
} as const
