/**
 * GramChain Shared UI Components
 * Header, Card, Badge, StatCard, Chip, Divider, Skeleton, EmptyState, TrustBadge
 */
import React, { useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, ViewStyle, TextStyle, DimensionValue,
} from 'react-native'
import { colors }  from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

// ─────────────────────────────────────────────────────────────────
// SCREEN HEADER
// ─────────────────────────────────────────────────────────────────
interface HeaderProps {
  title?:       string
  subtitle?:    string
  left?:        React.ReactNode
  right?:       React.ReactNode
  transparent?: boolean
  style?:       ViewStyle
}

export const Header = ({ title, subtitle, left, right, transparent, style }: HeaderProps) => (
  <View style={[
    styles.header,
    transparent ? styles.headerTransparent : styles.headerSolid,
    style,
  ]}>
    <View style={styles.headerLeft}>{left}</View>
    <View style={styles.headerCenter}>
      {title && <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>}
      {subtitle && <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>}
    </View>
    <View style={styles.headerRight}>{right}</View>
  </View>
)

// ─────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────
interface CardProps {
  children:      React.ReactNode
  variant?:      'default' | 'elevated' | 'outlined' | 'success' | 'warning' | 'hero'
  style?:        ViewStyle
  onPress?:      () => void
  padding?:      number
}

const CARD_VARIANTS = {
  default:   { bg: colors.surface,       border: colors.gray[100],   shadow: shadows.sm },
  elevated:  { bg: colors.surface,       border: colors.gray[100],   shadow: shadows.md },
  outlined:  { bg: colors.surface,       border: colors.gray[200],   shadow: shadows.none },
  success:   { bg: colors.primary[600],  border: 'transparent',      shadow: shadows.green },
  warning:   { bg: colors.secondary[500], border: 'transparent',      shadow: shadows.amber },
  hero:      { bg: '#1a7a3a',            border: 'transparent',      shadow: shadows.green },
}

export const Card = ({ children, variant = 'default', style, onPress, padding = spacing[5] }: CardProps) => {
  const cv = CARD_VARIANTS[variant]
  const inner = (
    <View style={[
      styles.card,
      { backgroundColor: cv.bg, borderColor: cv.border, padding },
      cv.shadow,
      style,
    ]}>
      {children}
    </View>
  )
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
        {inner}
      </TouchableOpacity>
    )
  }
  return inner
}

// ─────────────────────────────────────────────────────────────────
// BADGE / STATUS PILL
// ─────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  label:     string
  variant?:  BadgeVariant
  dot?:      boolean
  size?:     'sm' | 'md'
}

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: colors.primary[100],    text: colors.primary[700],   dot: colors.primary[500] },
  warning: { bg: colors.secondary[100],  text: colors.secondary[700], dot: colors.secondary[500] },
  danger:  { bg: colors.danger[100],     text: colors.danger[700],    dot: colors.danger[500] },
  info:    { bg: colors.info[100],       text: colors.info[600],      dot: colors.info[500] },
  neutral: { bg: colors.gray[100],       text: colors.gray[600],      dot: colors.gray[400] },
}

export const Badge = ({ label, variant = 'neutral', dot = true, size = 'md' }: BadgeProps) => {
  const bc = BADGE_COLORS[variant]
  return (
    <View style={[
      styles.badge,
      { backgroundColor: bc.bg, paddingVertical: size === 'sm' ? 3 : 5 },
    ]}>
      {dot && <View style={[styles.badgeDot, { backgroundColor: bc.dot }]} />}
      <Text style={[styles.badgeText, { color: bc.text, fontSize: size === 'sm' ? 10 : 12 }]}>
        {label}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label:       string
  value:       string
  subtext?:    string
  icon?:       string
  trend?:      'up' | 'down' | 'neutral'
  trendValue?: string
  style?:      ViewStyle
}

export const StatCard = ({ label, value, subtext, icon, trend, trendValue, style }: StatCardProps) => {
  const trendColor = trend === 'up' ? colors.primary[600] : trend === 'down' ? colors.danger[500] : colors.gray[500]
  const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  return (
    <View style={[styles.statCard, shadows.sm, style]}>
      <View style={styles.statHeader}>
        {icon && <Text style={styles.statIcon}>{icon}</Text>}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statFooter}>
        {trend && trendValue && (
          <View style={styles.statTrend}>
            <Text style={[styles.statTrendIcon, { color: trendColor }]}>{trendIcon}</Text>
            <Text style={[styles.statTrendText, { color: trendColor }]}>{trendValue}</Text>
          </View>
        )}
        {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────
// CHIP (for purpose/tenure selectors)
// ─────────────────────────────────────────────────────────────────
interface ChipProps {
  label:     string
  selected?: boolean
  onPress?:  () => void
  icon?:     string
  style?:    ViewStyle
}

export const Chip = ({ label, selected, onPress, icon, style }: ChipProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[
      styles.chip,
      selected ? styles.chipSelected : styles.chipDefault,
      style,
    ]}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    {icon && <Text style={[styles.chipIcon, selected && { color: colors.text.inverse }]}>{icon}</Text>}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
)

// ─────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────
interface DividerProps {
  label?: string
  style?: ViewStyle
}

export const Divider = ({ label, style }: DividerProps) => (
  <View style={[styles.dividerRow, style]}>
    <View style={styles.dividerLine} />
    {label && <Text style={styles.dividerLabel}>{label}</Text>}
    {label && <View style={styles.dividerLine} />}
  </View>
)

// ─────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────
interface SkeletonProps {
  width?:  DimensionValue
  height?: number
  radius?: number
  style?:  ViewStyle
}

export const Skeleton = ({ width = '100%', height = 16, radius: r = 8, style }: SkeletonProps) => {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] })

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.gray[200], opacity },
        style,
      ]}
    />
  )
}

// ─────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon:       string
  title:      string
  subtitle?:  string
  action?:    { label: string; onPress: () => void }
  style?:     ViewStyle
}

export const EmptyState = ({ icon, title, subtitle, action, style }: EmptyStateProps) => (
  <View style={[styles.emptyContainer, style]}>
    <View style={styles.emptyIconBg}>
      <Text style={styles.emptyIcon}>{icon}</Text>
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    {action && (
      <TouchableOpacity style={styles.emptyAction} onPress={action.onPress} activeOpacity={0.85}>
        <Text style={styles.emptyActionText}>{action.label}</Text>
      </TouchableOpacity>
    )}
  </View>
)

// ─────────────────────────────────────────────────────────────────
// TRUST BADGE ("Secured by Blockchain")
// ─────────────────────────────────────────────────────────────────
export const TrustBadge = () => (
  <View style={styles.trustRow}>
    <Text style={styles.trustIcon}>🔒</Text>
    <Text style={styles.trustText}>Secured by Blockchain</Text>
    <Text style={styles.trustIcon}>⛓</Text>
  </View>
)

// ─────────────────────────────────────────────────────────────────
// QUICK ACTION BUTTON
// ─────────────────────────────────────────────────────────────────
interface QuickActionProps {
  icon:     string
  label:    string
  onPress:  () => void
  color?:   string
}

export const QuickAction = ({ icon, label, onPress, color = colors.primary[600] }: QuickActionProps) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.quickActionIcon, { backgroundColor: `${color}18` }]}>
      <Text style={styles.quickActionEmoji}>{icon}</Text>
    </View>
    <Text style={styles.quickActionLabel} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
)

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    height:          56,
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: spacing[5],
  },
  headerSolid: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  headerTransparent: {
    backgroundColor: 'transparent',
  },
  headerLeft: {
    width: 48,
  },
  headerCenter: {
    flex:       1,
    alignItems: 'center',
  },
  headerRight: {
    width:      48,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize:   17,
    fontWeight: '700',
    color:      colors.text.primary,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize:  12,
    color:     colors.text.secondary,
    marginTop: 1,
  },

  // Card
  card: {
    borderRadius: radius.card,
    borderWidth:  1,
    overflow:     'hidden',
  },

  // Badge
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 10,
    borderRadius:      radius.pill,
    gap:               5,
    alignSelf:         'flex-start',
  },
  badgeDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // StatCard
  statCard: {
    flex:            1,
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing[4],
    borderWidth:     1,
    borderColor:     colors.gray[100],
  },
  statHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    marginBottom:   8,
  },
  statIcon: {
    fontSize: 16,
  },
  statLabel: {
    fontSize:   11,
    color:      colors.text.secondary,
    fontWeight: '600',
    letterSpacing: 0.3,
    flex:       1,
  },
  statValue: {
    fontSize:   22,
    fontWeight: '800',
    color:      colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  statFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  statTrend: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  statTrendIcon: {
    fontSize:   13,
    fontWeight: '700',
  },
  statTrendText: {
    fontSize:   12,
    fontWeight: '600',
  },
  statSubtext: {
    fontSize: 11,
    color:    colors.text.tertiary,
  },

  // Chip
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   8,
    paddingHorizontal: 14,
    borderRadius:      radius.chip,
    gap:               4,
    borderWidth:       1.5,
  },
  chipDefault: {
    backgroundColor: colors.gray[50],
    borderColor:     colors.gray[200],
  },
  chipSelected: {
    backgroundColor: colors.primary[600],
    borderColor:     colors.primary[600],
  },
  chipIcon: {
    fontSize: 14,
    color:    colors.gray[600],
  },
  chipText: {
    fontSize:  13,
    fontWeight: '600',
    color:     colors.gray[700],
  },
  chipTextSelected: {
    color: colors.text.inverse,
  },

  // Divider
  dividerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginVertical: 16,
    gap:            10,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: colors.gray[200],
  },
  dividerLabel: {
    fontSize:  12,
    color:     colors.gray[500],
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems:    'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconBg: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: colors.primary[50],
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      colors.text.primary,
    textAlign:  'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize:  14,
    color:     colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyAction: {
    backgroundColor: colors.primary[600],
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius:    radius.button,
    ...shadows.green,
  },
  emptyActionText: {
    color:     colors.text.inverse,
    fontSize:  15,
    fontWeight: '700',
  },

  // Trust Badge
  trustRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary[50],
    borderRadius:   radius.pill,
    alignSelf:      'center',
  },
  trustIcon: {
    fontSize: 13,
  },
  trustText: {
    fontSize:  12,
    color:     colors.primary[700],
    fontWeight: '600',
  },

  // Quick Action
  quickAction: {
    alignItems: 'center',
    gap:        8,
    flex:       1,
  },
  quickActionIcon: {
    width:          56,
    height:         56,
    borderRadius:   radius.xl,
    alignItems:     'center',
    justifyContent: 'center',
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionLabel: {
    fontSize:  11,
    fontWeight: '600',
    color:     colors.text.secondary,
    textAlign: 'center',
  },
})
