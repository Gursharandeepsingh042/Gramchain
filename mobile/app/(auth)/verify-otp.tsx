import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, useWindowDimensions, Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { getActivePhoneSession, startPhoneOtp } from '@/services/phoneAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing, getScreenPadding, FORM_MAX_WIDTH } from '@/constants/design'
import { useStaggeredFadeIn, makeFadeStyle } from '@/hooks/useStaggeredFadeIn'

export default function VerifyOtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string, mode: string }>()
  const { setAuth } = useAuthStore()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const { width, height } = useWindowDimensions()
  const isTablet = width >= 768
  const horizontalPadding = getScreenPadding(width)
  const minFormHeight = Math.max(height * (isTablet ? 0.5 : 0.62), isTablet ? 520 : 560)
  const formMaxWidth = isTablet ? FORM_MAX_WIDTH : undefined

  const [headerAnim, heroAnim, cardAnim] = useStaggeredFadeIn({ count: 3 })

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP')
      return
    }
    const session = getActivePhoneSession()
    if (!session) {
      setError('Verification session expired. Please request a new OTP.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await session.confirm(otp)
      const res = await authApi.verifyFirebase(result.idToken)
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, user)
      router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Incorrect OTP. Please check and try again.'
        : err.code === 'auth/code-expired'
        ? 'OTP expired. Please request a new one.'
        : err.response?.data?.error?.message
        || err.message || 'Invalid OTP. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || resending) return
    setResending(true)
    setError('')
    try {
      const existing = getActivePhoneSession()
      if (existing && existing.phone === phone) {
        await existing.resend()
      } else {
        await startPhoneOtp(phone)
      }
      setCountdown(60)
      setOtp('')
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[
        styles.header, 
        { paddingHorizontal: horizontalPadding, maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }, 
        makeFadeStyle(headerAnim)
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[
          styles.progressContainer,
          { maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' },
          makeFadeStyle(heroAnim)
        ]}>
            <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={50} color={colors.surface} />
            </View>
            <Text style={styles.title}>Enter Code</Text>
            <Text style={styles.subtitle}>
                A 6-digit code has been sent to {'\n'}
                <Text style={styles.phoneText}>+91 {phone}</Text>
            </Text>
        </Animated.View>

        <Animated.View style={[
          styles.formCard,
          {
            paddingHorizontal: horizontalPadding + 6,
            maxWidth: formMaxWidth,
            minHeight: minFormHeight,
            alignSelf: 'center',
            width: '100%',
          },
          makeFadeStyle(cardAnim, 32),
        ]}>
            <View style={styles.inputGroup}>
                <Input
                    placeholder="000 000"
                    value={otp}
                    onChangeText={(t) => {
                        setOtp(t.replace(/[^0-9]/g, ''))
                        setError('')
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.otpInput}
                />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {__DEV__ && (
              <View style={styles.devHint}>
                <Text style={styles.devHintText}>🛠 Dev: Real OTP via Firebase Phone Auth. To test without burning SMS quota, register your number in Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing".</Text>
              </View>
            )}

            <Button
                label="VERIFY & CONTINUE"
                onPress={handleVerify}
                loading={loading}
                size="xl"
                variant="primary"
                style={styles.verifyBtn}
            />

            <TouchableOpacity
                disabled={countdown > 0 || resending}
                onPress={handleResend}
                style={styles.resendBtn}
            >
                <Text style={[styles.resendText, (countdown > 0 || resending) && { opacity: 0.5 }]}>
                    {resending ? 'Sending...' : countdown > 0 ? `Resend code in ${countdown}s` : "Didn't receive code? Resend"}
                </Text>
            </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  progressContainer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.surface,
  },
  subtitle: {
    fontSize: 16,
    color: colors.surface,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  phoneText: {
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingVertical: 30,
    flex: 1,
    minHeight: 400,
  },
  inputGroup: {
    marginTop: 20,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 32,
    letterSpacing: 15,
    fontWeight: '800',
    height: 70,
  },
  verifyBtn: {
    marginTop: 30,
    borderRadius: radius.pill,
    height: 56,
    backgroundColor: colors.secondary[500],
  },
  resendBtn: {
    marginTop: 25,
    alignItems: 'center',
  },
  resendText: {
    color: colors.primary[600],
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    color: colors.danger[500],
    textAlign: 'center',
    marginTop: 15,
    fontSize: 14,
  },
  devHint: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  devHintText: {
    fontSize: 12,
    color: colors.text.primary,
    lineHeight: 18,
  },
})
