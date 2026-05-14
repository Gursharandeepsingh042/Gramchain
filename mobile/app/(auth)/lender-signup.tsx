import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
import { startPhoneOtp, getActivePhoneSession } from '@/services/phoneAuth'

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
  // Holds the native Firebase user after OTP confirm — used by step 3.
  const [phoneFirebaseUser, setPhoneFirebaseUser] = useState<any>(null)
  const [resending, setResending] = useState(false)

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  secureTextEntry
                  icon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[400]} />}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.surface,
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
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 5,
  },
  lineActive: {
    backgroundColor: colors.secondary[400],
  },
  stepText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  stepTitle: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 5,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 28,
    flex: 1,
    minHeight: 500,
    ...shadows.lg,
  },
  inputGroup: {
    marginTop: 8,
    gap: 14,
  },
  introText: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    gap: 5,
    marginTop: 18,
  },
  flag: {
    fontSize: 18,
  },
  otpHint: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.gray[600],
    lineHeight: 24,
    marginBottom: 16,
  },
  phoneBold: {
    fontWeight: '800',
    color: '#1a56db',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 10,
    fontWeight: '800',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    color: '#1a56db',
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
    borderColor: '#1a56db',
    backgroundColor: '#eff6ff',
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
    color: '#1a56db',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingRight: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray[300],
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#1a56db',
    borderColor: '#1a56db',
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray[600],
    lineHeight: 18,
  },
  linkText: {
    color: '#1a56db',
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
    fontSize: 14,
  },
  continueBtn: {
    marginTop: 28,
    borderRadius: radius.pill,
    height: 56,
    backgroundColor: '#1a56db',
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 15,
    color: colors.gray[600],
  },
  loginLinkBold: {
    color: '#1a56db',
    fontWeight: '800',
  },
})
