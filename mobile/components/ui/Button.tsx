import React, { useRef } from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  Animated,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'outline' | 'blockchain'
type Size    = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps {
  onPress:     () => void
  label:       string
  variant?:    Variant
  size?:       Size
  loading?:    boolean
  disabled?:   boolean
  fullWidth?:  boolean
  icon?:       React.ReactNode
  iconRight?:  React.ReactNode
  accessibilityLabel?: string
  accessibilityHint?:  string
  className?:  string
  style?:      StyleProp<ViewStyle>
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string; shadow?: object }> = {
  primary: {
    bg:     colors.primary[600],
    text:   colors.text.inverse,
    shadow: shadows.green,
  },
  secondary: {
    bg:     colors.primary[50],
    text:   colors.primary[700],
  },
  ghost: {
    bg:     'transparent',
    text:   colors.primary[600],
  },
  danger: {
    bg:     colors.danger[500],
    text:   colors.text.inverse,
  },
  warning: {
    bg:     colors.secondary[500],
    text:   colors.text.inverse,
  },
  outline: {
    bg:     'transparent',
    text:   colors.primary[600],
    border: colors.primary[600],
  },
  blockchain: {
    bg:     colors.info[600],
    text:   colors.text.inverse,
  },
}

const sizeStyles: Record<Size, { paddingV: number; paddingH: number; fontSize: number; radius: number }> = {
  sm: { paddingV: 8,  paddingH: 14, fontSize: 13, radius: 10 },
  md: { paddingV: 12, paddingH: 20, fontSize: 15, radius: 12 },
  lg: { paddingV: 16, paddingH: 24, fontSize: 16, radius: 14 },
  xl: { paddingV: 18, paddingH: 28, fontSize: 17, radius: 16 },
}

export const Button = ({
  onPress,
  label,
  variant    = 'primary',
  size       = 'lg',
  loading    = false,
  disabled   = false,
  fullWidth  = true,
  icon,
  iconRight,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const vs = variantStyles[variant]
  const ss = sizeStyles[size]
  const isDisabled = disabled || loading

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue:          0.96,
      useNativeDriver:  true,
      speed:            50,
      bounciness:       4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue:          1,
      useNativeDriver:  true,
      speed:            50,
      bounciness:       4,
    }).start()
  }

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        style,
        { transform: [{ scale: scaleAnim }] },
        !isDisabled && variant === 'primary' && shadows.green,
        !isDisabled && variant === 'danger' && shadows.md,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.base,
          {
            paddingVertical:   ss.paddingV,
            paddingHorizontal: ss.paddingH,
            borderRadius:      ss.radius,
            backgroundColor:   isDisabled ? colors.gray[200] : vs.bg,
            borderWidth:       vs.border ? 1.5 : 0,
            borderColor:       vs.border || 'transparent',
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'secondary' || variant === 'ghost' || variant === 'outline'
              ? colors.primary[600]
              : colors.text.inverse
            }
            size="small"
          />
        ) : (
          <>
            {icon && <View style={styles.iconLeft}>{icon}</View>}
            <Text
              style={[
                styles.label,
                {
                  fontSize:  ss.fontSize,
                  color:     isDisabled ? colors.gray[400] : vs.text,
                },
              ]}
            >
              {label}
            </Text>
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  base: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         48,   // WCAG 2.1 AA touch target
  },
  label: {
    fontWeight: '600',
    textAlign:  'center',
    letterSpacing: 0.1,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
})
