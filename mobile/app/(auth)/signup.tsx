import React, { useState } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, Animated, Alert
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
import { auth } from '@/services/firebase'
import { startPhoneOtp, getActivePhoneSession } from '@/services/phoneAuth'
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import Constants from 'expo-constants'

WebBrowser.maybeCompleteAuthSession()

type SignupStep = 1 | 2 | 3

export default function SignupScreen() {
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState<SignupStep>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    groupCode: '',
    agreed: false
  })

  const [otp, setOtp] = useState('')
  // Holds the native Firebase user after successful OTP confirm — used by step 3.
  const [phoneFirebaseUser, setPhoneFirebaseUser] = useState<any>(null)

  // Google Auth — use explicit redirect URI for Expo Go, auto-detect for standalone
  const isExpoGo = Constants.appOwnership === 'expo'
  const redirectUri = isExpoGo
    ? 'https://auth.expo.io/@sharan66/gramchain'
    : makeRedirectUri({ scheme: 'gramchain', native: 'gramchain://' })

  const [request, response, promptAsync] = Google.useAuthRequest({
    // For Expo Go, use Web Client ID for the OAuth flow
    // For standalone builds, Android/iOS client IDs are used
    clientId: isExpoGo ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID : undefined,
    androidClientId: isExpoGo ? undefined : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: isExpoGo ? undefined : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  })

  // Wait for Google Auth Response

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response
      const token = authentication?.idToken || authentication?.accessToken
      if (token) {
        handleGoogleSignup(token, !!authentication?.idToken)
      } else {
        setError('Google sign-up failed: no token returned.')
      }
    } else if (response?.type === 'error') {
      const baseMsg = response.error?.message || 'Google sign-up was cancelled or failed.'
      const tip = request?.redirectUri
        ? `\n\nIf this says "redirect_uri_mismatch", add this URL to your Google OAuth Web Client → Authorized redirect URIs:\n${request.redirectUri}`
        : ''
      setError(baseMsg + tip)
    }
  }, [response, request])

  const handleGoogleSignup = async (token: string, isIdToken = true) => {
    setLoading(true)
    setError('')
    try {
      const credential = isIdToken
        ? GoogleAuthProvider.credential(token)
        : GoogleAuthProvider.credential(null, token)
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseToken = await userCredential.user.getIdToken();

      const res = await authApi.verifyFirebase(firebaseToken)
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, user)
      router.replace('/kyc')
    } catch (err: any) {
      setError(err.message || 'Google signup failed')
    } finally {
      setLoading(false)
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
        // Check if phone already registered — redirect returning users to login
        const checkRes = await authApi.checkPhone(formData.phone)
        if (checkRes.data.data.exists) {
          Alert.alert(
            'Already Registered',
            'This number is already linked to a GramChain account. Please login instead.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Login', onPress: () => router.replace('/login') },
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
        // Verify with backend to check if user actually exists (race condition guard)
        const checkRes = await authApi.verifyFirebase(result.idToken)
        if (!checkRes.data.data.isNewUser) {
          // Returning user — skip registration form, go directly to dashboard
          const { accessToken, refreshToken, user } = checkRes.data.data
          setAuth(accessToken, refreshToken, user)
          router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
          return
        }
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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(formData.email)) {
        setError('Please use a valid email address.')
        return
      }
      if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password)) {
        setError('Password must contain 1 Capital, 1 Number, and 1 Special Symbol.')
        return
      }
      if (!formData.agreed) {
        setError('You must agree to the Terms & Conditions')
        return
      }
      
      setLoading(true)
      try {
        // Use the native Firebase user captured at step 2.
        const currentUser = phoneFirebaseUser
        if (!currentUser) throw new Error("Authentication session lost. Please go back to step 1.");

        const idToken = await currentUser.getIdToken();
        // Forward the chosen password so the backend can store a bcrypt hash —
        // this enables future logins via phone-or-email + password.
        // Email is sent to the backend via the formData captured below; Firebase
        // email-linking is not required since auth is anchored to the phone identity.
        const res = await authApi.verifyFirebase(idToken, formData.fullName, formData.groupCode, formData.password);
        const { accessToken, refreshToken, user } = res.data.data
        setAuth(accessToken, refreshToken, user)
        router.replace('/kyc')
      } catch (err: any) {
        setError(err.message || 'Registration failed')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progressContainer}>
            <View style={styles.stepIndicator}>
                <View style={[styles.dot, step >= 1 && styles.dotActive]} />
                <View style={[styles.line, step >= 2 && styles.lineActive]} />
                <View style={[styles.dot, step >= 2 && styles.dotActive]} />
                <View style={[styles.line, step >= 3 && styles.lineActive]} />
                <View style={[styles.dot, step === 3 && styles.dotActive]} />
            </View>
            <Text style={styles.stepText}>Step {step} of 3</Text>
            <Text style={styles.stepTitle}>
                {step === 1 && 'Join GramChain'}
                {step === 2 && 'Verify Mobile'}
                {step === 3 && 'Create Account'}
            </Text>
        </View>

        <View style={styles.formCard}>
            {step === 1 && (
                <View style={styles.inputGroup}>
                    <Text style={styles.introText}>Enter your phone number to get started.</Text>
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
                                onChangeText={(t) => setFormData({...formData, phone: t.replace(/[^0-9]/g, '')})}
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
                        onPress={() => promptAsync()}
                        variant="outline"
                        style={styles.googleBtn}
                        icon={<Ionicons name="logo-google" size={20} color={colors.primary[600]} />}
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

                    <TouchableOpacity
                        style={styles.resendBtn}
                        onPress={async () => {
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
                            }
                        }}
                    >
                        <Text style={styles.resendText}>Didn't receive code? Resend</Text>
                    </TouchableOpacity>
                </View>
            )}

            {step === 3 && (
                <View style={styles.inputGroup}>
                    <Input
                        label="Full Name"
                        placeholder="E.g. Rajesh Kumar"
                        value={formData.fullName}
                        onChangeText={(t) => setFormData({...formData, fullName: t})}
                        icon={<Ionicons name="person-outline" size={20} color={colors.gray[400]} />}
                    />
                    
                    <View style={{ position: 'relative' }}>
                        <Input
                            label="Email Address"
                            placeholder="example@gmail.com"
                            value={formData.email}
                            onChangeText={(t) => setFormData({...formData, email: t})}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            icon={<Ionicons name="mail-outline" size={20} color={colors.gray[400]} />}
                        />
                        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(formData.email) && (
                            <View style={{ position: 'absolute', right: 15, top: 38 }}>
                                <Ionicons name="checkmark-circle" size={20} color={'#10b981'} />
                            </View>
                        )}
                        {formData.email.length > 5 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(formData.email) && (
                            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                                Please use a valid email address.
                            </Text>
                        )}
                    </View>

                    <View>
                        <Input
                            label="Create Password"
                            placeholder="Minimum 8 characters"
                            value={formData.password}
                            onChangeText={(t) => setFormData({...formData, password: t})}
                            secureTextEntry
                            icon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[400]} />}
                        />
                        {formData.password.length > 0 && !/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password) && (
                            <Text style={{ color: colors.gray[500], fontSize: 11, marginTop: 4, marginLeft: 4 }}>
                                Must be 8+ chars, 1 uppercase, 1 number, 1 special symbol (@$!%*?&)
                            </Text>
                        )}
                    </View>

                    <Input
                        label="Group Code (Optional)"
                        placeholder="Enter SHG Code"
                        value={formData.groupCode}
                        onChangeText={(t) => setFormData({...formData, groupCode: t.toUpperCase()})}
                        icon={<Ionicons name="people-outline" size={20} color={colors.gray[400]} />}
                    />

                    <TouchableOpacity 
                        style={styles.checkboxRow}
                        onPress={() => setFormData({...formData, agreed: !formData.agreed})}
                    >
                        <View style={[styles.checkbox, formData.agreed && styles.checkboxChecked]}>
                            {formData.agreed && <Ionicons name="checkmark" size={14} color={colors.surface} />}
                        </View>
                        <Text style={styles.checkboxText}>
                            I agree to the <Text style={styles.linkText}>Terms & Conditions</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
                label={step === 3 ? "REGISTER & FINISH" : "CONTINUE"}
                onPress={handleContinue}
                loading={loading}
                size="xl"
                variant="primary"
                style={styles.continueBtn}
            />

            <TouchableOpacity 
                style={styles.loginLink}
                onPress={() => router.push('/login')}
            >
                <Text style={styles.loginLinkText}>
                    Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
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
    backgroundColor: colors.primary[400],
  },
  dotActive: {
    backgroundColor: colors.secondary[400],
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  line: {
    width: 60,
    height: 3,
    backgroundColor: colors.primary[400],
    marginHorizontal: 5,
  },
  lineActive: {
    backgroundColor: colors.secondary[400],
  },
  stepText: {
    color: colors.surface,
    fontSize: 14,
    opacity: 0.9,
  },
  stepTitle: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 5,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    flex: 1,
    minHeight: 600,
    ...shadows.lg,
  },
  inputGroup: {
    marginTop: 10,
    gap: 15,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingRight: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary[400],
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray[600],
    lineHeight: 18,
  },
  linkText: {
    color: colors.primary[600],
    fontWeight: '700',
  },
  continueBtn: {
    marginTop: 30,
    borderRadius: radius.pill,
    height: 56,
    backgroundColor: colors.secondary[500],
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
    color: colors.primary[800],
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger[500],
    textAlign: 'center',
    marginTop: 15,
    fontSize: 14,
  },
  introText: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 10,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[200],
  },
  dividerText: {
    marginHorizontal: 15,
    color: colors.gray[400],
    fontWeight: '700',
    fontSize: 12,
  },
  googleBtn: {
    borderRadius: radius.pill,
    height: 52,
    borderColor: colors.gray[200],
  },
  otpHint: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.gray[600],
    lineHeight: 24,
    marginBottom: 20,
  },
  phoneBold: {
    fontWeight: '800',
    color: colors.primary[700],
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 10,
    fontWeight: '800',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 10,
  },
  resendText: {
    color: colors.primary[600],
    fontWeight: '600',
  }
})
