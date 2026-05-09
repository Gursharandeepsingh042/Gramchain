import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { auth, rnAuth } from '@/services/firebase'
import { signInWithCredential, PhoneAuthProvider } from 'firebase/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

export default function VerifyOtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string, mode: string }>()
  const { setAuth } = useAuthStore()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [verificationId, setVerificationId] = useState<string | null>(null)

  useEffect(() => {
    // Load verificationId from AsyncStorage (stored by login/signup screens)
    AsyncStorage.getItem('@auth_verificationId').then(setVerificationId)
  }, [])

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
    if (!verificationId) {
      setError('Verification session expired. Please request a new OTP.')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Use JS SDK PhoneAuthProvider with verificationId from AsyncStorage
      const credential = PhoneAuthProvider.credential(verificationId, otp)
      const userCredential = await signInWithCredential(auth, credential)
      const idToken = await userCredential.user.getIdToken()

      const res = await authApi.verifyFirebase(idToken)
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, user)
      router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Incorrect OTP. Please check and try again.'
        : err.code === 'auth/code-expired'
        ? 'OTP expired. Please request a new one.'
        : err.message || 'Invalid OTP. Please try again.'
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
      // React Native Firebase: resend OTP
      const newConfirmation = await rnAuth().signInWithPhoneNumber(`+91${phone}`)
      if (newConfirmation.verificationId) {
        await AsyncStorage.setItem('@auth_verificationId', newConfirmation.verificationId)
        setVerificationId(newConfirmation.verificationId)
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progressContainer}>
            <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={50} color={colors.surface} />
            </View>
            <Text style={styles.title}>Enter Code</Text>
            <Text style={styles.subtitle}>
                A 6-digit code has been sent to {'\n'}
                <Text style={styles.phoneText}>+91 {phone}</Text>
            </Text>
        </View>

        <View style={styles.formCard}>
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
                <Text style={styles.devHintText}>🛠 Dev: Add your number as a test number in Firebase Console → Authentication → Phone → Test Numbers. Use any 6-digit OTP you set there.</Text>
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
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
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
    paddingVertical: 40,
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
    padding: 30,
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
