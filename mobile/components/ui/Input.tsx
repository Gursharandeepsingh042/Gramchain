import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/design'

interface InputProps extends TextInputProps {
  label?:              string
  error?:              string
  hint?:               string
  prefix?:             string          // e.g. "₹" or "+91"
  icon?:               React.ReactNode // icon on left
  rightIcon?:          React.ReactNode // icon on right (alias for suffix)
  suffix?:             React.ReactNode // icon or text on right
  containerStyle?:     object
  showClearButton?:    boolean
  onClear?:            () => void
}

export const Input = ({
  label,
  error,
  hint,
  prefix,
  icon,
  rightIcon,
  suffix,
  containerStyle,
  showClearButton,
  onClear,
  onFocus,
  onBlur,
  value,
  ...props
}: InputProps) => {
  const [isFocused, setIsFocused] = useState(false)
  const labelAnim  = useRef(new Animated.Value(0)).current

  const animateFocus = (focused: boolean) => {
    Animated.timing(labelAnim, {
      toValue:         focused ? 1 : 0,
      duration:        180,
      useNativeDriver: false,
    }).start()
  }

  const borderColor = error
    ? colors.danger[500]
    : isFocused
      ? colors.primary[500]
      : colors.gray[200]

  const bgColor = error
    ? colors.danger[50]
    : isFocused
      ? '#fafffe'
      : colors.gray[50]

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[
          styles.label,
          { color: error ? colors.danger[600] : isFocused ? colors.primary[700] : colors.gray[600] }
        ]}>
          {label}
        </Text>
      )}

      <View style={[
        styles.inputWrapper,
        {
          borderColor,
          backgroundColor: bgColor,
          borderWidth: isFocused ? 1.5 : 1,
        }
      ]}>
        {icon && (
          <View style={styles.leftIcon}>{icon}</View>
        )}
        {prefix && (
          <Text style={styles.prefix}>{prefix}</Text>
        )}
        <TextInput
          style={[styles.input, prefix ? styles.inputWithPrefix : null]}
          placeholderTextColor={colors.gray[400]}
          value={value}
          onFocus={(e) => {
            setIsFocused(true)
            animateFocus(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            animateFocus(false)
            onBlur?.(e)
          }}
          selectionColor={colors.primary[500]}
          {...props}
        />
        {showClearButton && value && value.length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
        {(rightIcon || suffix) && <View style={styles.suffix}>{rightIcon || suffix}</View>}
      </View>

      {error ? (
        <Text style={styles.error}>⚠ {error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  )
}

// ─── OTP Input ────────────────────────────────────────────────────
interface OtpInputProps {
  value:        string
  onChange:     (val: string) => void
  length?:      number
  error?:       string
}

export const OtpInput = ({ value, onChange, length = 6, error }: OtpInputProps) => {
  const inputRef = useRef<TextInput>(null)
  const digits   = value.split('')

  return (
    <View>
      <TouchableOpacity onPress={() => inputRef.current?.focus()} activeOpacity={1}>
        <View style={styles.otpRow}>
          {Array.from({ length }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.otpBox,
                {
                  borderColor: error
                    ? colors.danger[500]
                    : digits[i] !== undefined
                      ? colors.primary[500]
                      : i === digits.length
                        ? colors.primary[300]
                        : colors.gray[200],
                  backgroundColor: digits[i] !== undefined ? colors.primary[50] : colors.gray[50],
                  borderWidth: i === digits.length ? 2 : 1.5,
                }
              ]}
            >
              <Text style={styles.otpDigit}>
                {digits[i] ? '•' : ''}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        caretHidden
      />

      {error && <Text style={[styles.error, { textAlign: 'center', marginTop: 8 }]}>⚠ {error}</Text>}
    </View>
  )
}

// ─── Amount Input (large ₹ style) ────────────────────────────────
interface AmountInputProps {
  value:        string
  onChange:     (val: string) => void
  max?:         number
  error?:       string
}

export const AmountInput = ({ value, onChange, max, error }: AmountInputProps) => {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={styles.amountContainer}>
      <Text style={styles.amountLabel}>ऋण राशि / Loan Amount</Text>
      <View style={[
        styles.amountWrapper,
        {
          borderColor: error ? colors.danger[500] : isFocused ? colors.primary[400] : colors.gray[200],
          borderWidth: isFocused ? 2 : 1.5,
        }
      ]}>
        <Text style={styles.rupeeSymbol}>₹</Text>
        <TextInput
          style={styles.amountInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="10,000"
          placeholderTextColor={colors.gray[300]}
          selectionColor={colors.primary[500]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel="Loan amount in rupees"
        />
      </View>
      {max && (
        <Text style={styles.maxHint}>Max eligible: ₹{max.toLocaleString('en-IN')}</Text>
      )}
      {error && <Text style={styles.error}>⚠ {error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize:     13,
    fontWeight:   '600',
    marginBottom: 6,
    marginLeft:   2,
    letterSpacing: 0.1,
  },
  inputWrapper: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   radius.input,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight:      52,
  },
  prefix: {
    fontSize:     18,
    fontWeight:   '600',
    color:        colors.gray[600],
    marginRight:  8,
  },
  input: {
    flex:         1,
    fontSize:     16,
    color:        colors.text.primary,
    paddingVertical: 10,
    minHeight:    40,
  },
  inputWithPrefix: {
    paddingLeft: 4,
  },
  clearBtn: {
    padding: 4,
  },
  clearText: {
    fontSize:  12,
    color:     colors.gray[400],
  },
  suffix: {
    marginLeft: 8,
  },
  leftIcon: {
    marginRight: 10,
  },
  error: {
    fontSize:   12,
    color:      colors.danger[600],
    marginTop:  5,
    marginLeft: 2,
    fontWeight: '500',
  },
  hint: {
    fontSize:   12,
    color:      colors.gray[500],
    marginTop:  5,
    marginLeft: 2,
  },

  // OTP
  otpRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    gap:             8,
  },
  otpBox: {
    flex:            1,
    aspectRatio:     1,
    maxWidth:        52,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  otpDigit: {
    fontSize:    22,
    fontWeight:  '700',
    color:       colors.primary[700],
  },
  hiddenInput: {
    position:  'absolute',
    opacity:   0,
    height:    0,
    width:     0,
  },

  // Amount
  amountContainer: {
    marginBottom: 16,
  },
  amountLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.gray[600],
    marginBottom: 8,
    marginLeft: 2,
  },
  amountWrapper: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.gray[50],
    borderRadius:      radius.lg,
    paddingHorizontal: 18,
    paddingVertical:   12,
    minHeight:         70,
  },
  rupeeSymbol: {
    fontSize:     32,
    fontWeight:   '700',
    color:        colors.primary[600],
    marginRight:  8,
  },
  amountInput: {
    flex:         1,
    fontSize:     36,
    fontWeight:   '800',
    color:        colors.text.primary,
    letterSpacing: -1,
  },
  maxHint: {
    fontSize:   12,
    color:      colors.gray[500],
    marginTop:  6,
    marginLeft: 4,
  },
})
