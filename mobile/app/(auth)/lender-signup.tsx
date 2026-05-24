import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, useWindowDimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { authApi, getApiBaseUrl } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, getScreenPadding, FORM_MAX_WIDTH } from '@/constants/design'
import { startPhoneOtp, getActivePhoneSession } from '@/services/phoneAuth'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { GoogleLogo } from '@/components/ui/GoogleLogo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type SignupStep = 1 | 2 | 3

/**
 * Lender Signup Screen — 3-step flow:
 * Step 1: Enter email
 * Step 2: Enter phone + OTP verification
 * Step 3: Full name, password, investor type
 */

export default function LenderSignupScreen() {
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState<SignupStep>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    investorType: '' as '' | 'individual' | 'institutional',
    agreed: false,
  })

  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Holds the native Firebase user after OTP confirm — used by step 3.
  const [phoneFirebaseUser, setPhoneFirebaseUser] = useState<any>(null)
  const [resending, setResending] = useState(false)

  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const styles = useMemo(
    () => createStyles({ width, height, topInset: insets.top, bottomInset: insets.bottom }),
    [width, height, insets.bottom, insets.top],
  )

  // Google Auth — backend-proxied flow (no auth.expo.io dependency)
  const returnUrl = makeRedirectUri({ scheme: 'gramchain' })

  const handleGoogleSignup = async () => {
    setLoading(true)
    setError('')
    try {
      await WebBrowser.dismissBrowser()
      const baseUrl = getApiBaseUrl()
      const startUrl = `${baseUrl}/auth/google/mobile-start?returnUrl=${encodeURIComponent(returnUrl)}`

      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl)

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url)
        const errorParam = url.searchParams.get('error')
        if (errorParam) {
          setError(`Google sign-up failed: ${errorParam}`)
          return
        }

        const accessToken = url.searchParams.get('accessToken')
        const refreshToken = url.searchParams.get('refreshToken')
        const userId = url.searchParams.get('userId')
        const userName = url.searchParams.get('userName')
        const userEmail = url.searchParams.get('userEmail')
        const kycStatus = url.searchParams.get('kycStatus')

        if (!accessToken || !refreshToken || !userId) {
          setError('Google sign-up failed: incomplete response.')
          return
        }

        const user = {
          id: userId,
          name: userName || '',
          email: userEmail || '',
          kycStatus: kycStatus || '',
          role: 'LENDER',
        } as any

        setAuth(accessToken, refreshToken, user)
        router.replace('/portfolio' as any)
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setError('Google sign-up was cancelled.')
      }
    } catch (err: any) {
      setError(err.message || 'Google signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleButtonPress = () => {
    setError('')
    handleGoogleSignup()
  }

  const handleResendOtp = async () => {
    if (resending) return
    setResending(true)
    setError('')
    try {
      const existing = getActivePhoneSession()
      if (existing && existing.phone === formData.phone) {
        await existing.resend()
      } else {
        await startPhoneOtp(formData.phone)
      }
      setOtp('')
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  const handleContinue = async () => {
    setError('')

    if (step === 1) {
      if (formData.phone.length !== 10) {
        setError('Please enter a valid 10-digit phone number')
        return
      }

      setLoading(true)
      try {
        // Check if phone already registered
        const checkRes = await authApi.checkPhone(formData.phone)
        if (checkRes.data.data.exists) {
          Alert.alert(
            'Already Registered',
            'This number is already linked to a GramChain account. Please login instead.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Login', onPress: () => router.replace('/lender-login' as any) },
            ]
          )
          setLoading(false)
          return
        }

        // Native Firebase Phone Auth — requires a dev/prod build (won't work in Expo Go).
        await startPhoneOtp(formData.phone)
        setStep(2)
      } catch (err: any) {
        setError(err.message || 'Failed to send OTP')
      } finally {
        setLoading(false)
      }
    } else if (step === 2) {
      if (otp.length !== 6) {
        setError('Please enter the 6-digit OTP')
        return
      }
      setLoading(true)
      try {
        const session = getActivePhoneSession()
        if (!session) throw new Error('Verification session expired. Tap back and request a new OTP.')
        const result = await session.confirm(otp)
        setPhoneFirebaseUser(result.firebaseUser)
        setStep(3)
      } catch (err: any) {
        const msg = err.code === 'auth/invalid-verification-code'
          ? 'Incorrect OTP. Please check and try again.'
          : err.code === 'auth/code-expired'
          ? 'OTP expired. Tap back and request a new one.'
          : err.message || 'Invalid OTP'
        setError(msg)
      } finally {
        setLoading(false)
      }
    } else if (step === 3) {
      if (!formData.fullName || !formData.email || !formData.password) {
        setError('Please fill in all required fields')
        return
      }
      if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password)) {
        setError('Password must contain 1 Capital, 1 Number, and 1 Special Symbol.')
        return
      }
      if (!formData.agreed) {
        setError('You must agree to the Terms & Risk Disclosure')
        return
      }

      setLoading(true)
      try {
        const currentUser = phoneFirebaseUser
        if (!currentUser) throw new Error('Authentication session lost. Please go back to step 1.')

        // Register via Firebase token verification — creates user in backend DB.
        // Backend stores the bcrypt hash of formData.password so future logins
        // work via phone-or-email + password. JS-SDK email linking is not needed.
        const idToken = await currentUser.getIdToken()
        const res = await authApi.verifyFirebase(idToken, formData.fullName, undefined, formData.password, 'LENDER')
        const { accessToken, refreshToken, user } = res.data.data
        setAuth(accessToken, refreshToken, { ...user, role: 'LENDER' })
        router.replace('/portfolio' as any)
      } catch (err: any) {
        setError(err.message || 'Registration failed')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 1) router.back()
            else if (step === 2) setStep(1)
            else setStep(2)
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GramChain</Text>
        <View style={styles.lenderBadge}>
          <Text style={styles.lenderBadgeText}>💎 INVESTOR</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.stepIndicator}>
            <View style={[styles.dot, step >= 1 && styles.dotActive]} />
            <View style={[styles.stepLine, step >= 2 && styles.lineActive]} />
            <View style={[styles.dot, step >= 2 && styles.dotActive]} />
            <View style={[styles.stepLine, step >= 3 && styles.lineActive]} />
            <View style={[styles.dot, step === 3 && styles.dotActive]} />
          </View>
          <Text style={styles.stepText}>Step {step} of 3</Text>
          <Text style={styles.stepTitle}>
            {step === 1 && 'Verify Your Phone'}
            {step === 2 && 'Enter OTP'}
            {step === 3 && 'Create Investor Account'}
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {step === 1 && (
            <View style={styles.inputGroup}>
              <Text style={styles.introText}>
                Start investing in rural microfinance with as little as ₹1,000
              </Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.gray[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Mobile Number"
                    placeholder="98765 43210"
                    value={formData.phone}
                    onChangeText={(t) => setFormData({ ...formData, phone: t.replace(/[^0-9]/g, '') })}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                label="Sign up with Google"
                onPress={handleGoogleButtonPress}
                variant="outline"
                style={styles.googleBtn}
                icon={<GoogleLogo size={20} />}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.inputGroup}>
              <Text style={styles.otpHint}>
                We have sent a 6-digit code to {'\n'}
                <Text style={styles.phoneBold}>+91 {formData.phone}</Text>
              </Text>

              <Input
                label="Verification Code"
                placeholder="000000"
                value={otp}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setOtp}
                style={styles.otpInput}
              />

              <TouchableOpacity style={styles.resendBtn} onPress={handleResendOtp} disabled={resending}>
                <Text style={[styles.resendText, resending && { opacity: 0.5 }]}>
                  {resending ? 'Sending...' : "Didn't receive code? Resend"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.inputGroup}>
              <Input
                label="Full Name"
                placeholder="E.g. Amit Sharma"
                value={formData.fullName}
                onChangeText={(t) => setFormData({ ...formData, fullName: t })}
                icon={<Ionicons name="person-outline" size={20} color={colors.gray[400]} />}
              />

              <Input
                label="Email Address"
                placeholder="amit@example.com"
                value={formData.email}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Ionicons name="mail-outline" size={20} color={colors.gray[400]} />}
              />

              <View>
                <Input
                  label="Create Password"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChangeText={(t) => setFormData({ ...formData, password: t })}
                  secureTextEntry={!showPassword}
                  icon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[400]} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.gray[400]} />
                    </TouchableOpacity>
                  }
                />
                {formData.password.length > 0 && !/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password) && (
                  <Text style={styles.passHint}>
                    Must be 8+ chars, 1 uppercase, 1 number, 1 special symbol
                  </Text>
                )}
              </View>

              {/* Investor Type Selector */}
              <Text style={styles.typeLabel}>Investor Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, formData.investorType === 'individual' && styles.typeBtnActive]}
                  onPress={() => setFormData({ ...formData, investorType: 'individual' })}
                >
                  <Text style={styles.typeEmoji}>👤</Text>
                  <Text style={[styles.typeBtnText, formData.investorType === 'individual' && styles.typeBtnTextActive]}>
                    Individual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, formData.investorType === 'institutional' && styles.typeBtnActive]}
                  onPress={() => setFormData({ ...formData, investorType: 'institutional' })}
                >
                  <Text style={styles.typeEmoji}>🏢</Text>
                  <Text style={[styles.typeBtnText, formData.investorType === 'institutional' && styles.typeBtnTextActive]}>
                    Institutional
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Risk Disclosure Agreement */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setFormData({ ...formData, agreed: !formData.agreed })}
              >
                <View style={[styles.checkbox, formData.agreed && styles.checkboxChecked]}>
                  {formData.agreed && <Ionicons name="checkmark" size={14} color={colors.surface} />}
                </View>
                <Text style={styles.checkboxText}>
                  I agree to the <Text style={styles.linkText}>Terms of Service</Text> and acknowledge that{' '}
                  <Text style={styles.riskText}>capital is not guaranteed</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label={step === 3 ? "CREATE INVESTOR ACCOUNT" : "CONTINUE"}
            onPress={handleContinue}
            loading={loading}
            size="xl"
            variant="primary"
            style={styles.continueBtn}
          />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push('/lender-login' as any)}
          >
            <Text style={styles.loginLinkText}>
              Already an investor? <Text style={styles.loginLinkBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
type StyleParams = {
  width: number
  height: number
  topInset: number
  bottomInset: number
}

const createStyles = ({ width, height, topInset, bottomInset }: StyleParams) => {
  const isTablet = width >= 768
  const horizontalPadding = getScreenPadding(width)
  const cardRadius = isTablet ? 42 : 36
  const cardPadding = isTablet ? 32 : 24
  const footerPadding = bottomInset + (isTablet ? 38 : 26)
  const minFormHeight = Math.max(height * (isTablet ? 0.5 : 0.62), isTablet ? 520 : 560)
  const formMaxWidth = isTablet ? FORM_MAX_WIDTH : undefined

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    keyboard: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: horizontalPadding,
      paddingTop: 16,
      paddingBottom: 12,
      maxWidth: formMaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    backBtn: {
      padding: 10,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    headerTitle: {
      fontSize: isTablet ? 24 : 20,
      fontWeight: '800',
      color: colors.surface,
      letterSpacing: 0.4,
    },
    lenderBadge: {
      backgroundColor: 'rgba(245,158,11,0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    lenderBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.secondary[400],
      letterSpacing: 0.5,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: horizontalPadding,
      paddingBottom: footerPadding,
      paddingTop: 12,
      gap: 24,
    },
    progressContainer: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 8,
      maxWidth: formMaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dotActive: {
      backgroundColor: colors.secondary[400],
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    stepLine: {
      width: 56,
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    lineActive: {
      backgroundColor: colors.secondary[400],
    },
    stepText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: isTablet ? 15 : 14,
    },
    stepTitle: {
      color: colors.surface,
      fontSize: isTablet ? 24 : 22,
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'center',
    },
    formCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: cardRadius,
      borderTopRightRadius: cardRadius,
      padding: cardPadding,
      minHeight: minFormHeight,
      ...shadows.lg,
      gap: 24,
      width: '100%',
      maxWidth: formMaxWidth,
      alignSelf: 'center',
    },
    inputGroup: {
      gap: isTablet ? 16 : 14,
    },
    introText: {
      fontSize: isTablet ? 18 : 16,
      color: colors.gray[600],
      textAlign: 'center',
      lineHeight: 24,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    countryCode: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.gray[50],
      paddingHorizontal: 12,
      height: 52,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.gray[200],
      gap: 6,
      marginTop: 18,
    },
    flag: {
      fontSize: 18,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: isTablet ? 24 : 20,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.gray[200],
    },
    dividerText: {
      color: colors.gray[400],
      fontWeight: '700',
      fontSize: isTablet ? 13 : 12,
      letterSpacing: 1,
    },
    googleBtn: {
      borderRadius: radius.pill,
      height: 52,
      borderColor: colors.gray[200],
    },
    otpHint: {
      fontSize: isTablet ? 18 : 16,
      textAlign: 'center',
      color: colors.gray[600],
      lineHeight: 24,
    },
    phoneBold: {
      fontWeight: '800',
      color: colors.info[600],
    },
    otpInput: {
      textAlign: 'center',
      fontSize: isTablet ? 26 : 24,
      letterSpacing: 10,
      fontWeight: '800',
    },
    resendBtn: {
      alignItems: 'center',
      marginTop: 10,
    },
    resendText: {
      color: colors.info[600],
      fontWeight: '600',
    },
    passHint: {
      color: colors.gray[500],
      fontSize: 11,
      marginTop: 4,
      marginLeft: 4,
    },
    typeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.gray[600],
      marginBottom: 2,
      marginLeft: 2,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    typeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.gray[200],
      backgroundColor: colors.gray[50],
    },
    typeBtnActive: {
      borderColor: colors.info[600],
      backgroundColor: colors.info[50],
    },
    typeEmoji: {
      fontSize: 18,
    },
    typeBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.gray[500],
    },
    typeBtnTextActive: {
      color: colors.info[600],
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 10,
      paddingRight: 10,
      gap: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.gray[300],
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.info[600],
      borderColor: colors.info[600],
    },
    checkboxText: {
      flex: 1,
      fontSize: isTablet ? 14 : 13,
      color: colors.gray[600],
      lineHeight: 19,
    },
    linkText: {
      color: colors.info[600],
      fontWeight: '700',
    },
    riskText: {
      color: colors.danger[600],
      fontWeight: '700',
    },
    errorText: {
      color: colors.danger[500],
      textAlign: 'center',
      marginTop: 12,
      fontSize: isTablet ? 15 : 14,
    },
    continueBtn: {
      marginTop: 16,
      borderRadius: radius.pill,
      height: 56,
      backgroundColor: colors.info[600],
    },
    loginLink: {
      marginTop: 20,
      alignItems: 'center',
    },
    loginLinkText: {
      fontSize: isTablet ? 16 : 15,
      color: colors.gray[600],
    },
    loginLinkBold: {
      color: colors.info[600],
      fontWeight: '800',
    },
  })
}
