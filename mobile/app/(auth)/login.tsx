import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Image, ScrollView, Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Alert } from 'react-native'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
import { GoogleLogo } from '@/components/ui/GoogleLogo'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Google Auth
  // Note: These should ideally be moved to mobile/.env
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '647993260711-jecc37q5dc70au6agl977qcs3jvnk1ii.apps.googleusercontent.com', // Replace with Android Specific ID
    iosClientId:     '647993260711-jecc37q5dc70au6agl977qcs3jvnk1ii.apps.googleusercontent.com', // Replace with iOS Specific ID
    webClientId:     '647993260711-jecc37q5dc70au6agl977qcs3jvnk1ii.apps.googleusercontent.com', // Web ID for Expo Go
  })

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response
      if (authentication?.idToken) {
        handleGoogleLogin(authentication.idToken)
      }
    }
  }, [response])

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.googleSignIn(idToken)
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, user)
      router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Google login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      if (loginMode === 'otp') {
        if (phone.length !== 10) {
          setError('Please enter a 10-digit phone number')
          setLoading(false)
          return
        }
        await authApi.sendOtp(phone)
        router.push({ pathname: '/(auth)/verify-otp', params: { phone, mode: 'login' } })
      } else {
        if (!email) {
          setError('Please enter your email address')
          setLoading(false)
          return
        }
        if (!password) {
          setError('Please enter your password')
          setLoading(false)
          return
        }
        const res = await authApi.loginWithPassword(email, password)
        const { accessToken, refreshToken, user } = res.data.data
        setAuth(accessToken, refreshToken, user)
        // Save to secure store for biometric login
        await SecureStore.setItemAsync('saved_email', email)
        await SecureStore.setItemAsync('saved_password', password)
        router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      if (!hasHardware) {
        Alert.alert('Not Supported', 'Your device does not support biometric authentication.')
        return
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      if (!isEnrolled) {
        Alert.alert('Not Enrolled', 'No fingerprints or facial data found.')
        return
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to GramChain',
        fallbackLabel: 'Use Passcode',
      })

      if (result.success) {
        setLoading(true)
        const savedEmail = await SecureStore.getItemAsync('saved_email')
        const savedPassword = await SecureStore.getItemAsync('saved_password')

        if (savedEmail && savedPassword) {
            try {
                const res = await authApi.loginWithPassword(savedEmail, savedPassword)
                const { accessToken, refreshToken, user } = res.data.data
                setAuth(accessToken, refreshToken, user)
                router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
            } catch (err: any) {
                setError(err.response?.data?.error?.message || 'Biometric login failed server-side.')
            }
        } else {
            Alert.alert('Setup Required', 'Please login with your password once to enable Biometric login.')
        }
        setLoading(false)
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during authentication.')
    }
  }

  const handleDemoLogin = () => {
    // Bypass backend entirely — inject a mock session and go to dashboard
    const demoUser = {
      id: 'demo-borrower-001',
      phone: '8888888888',
      name: 'Demo Borrower',
      email: 'demo@borrower.com',
      role: 'BORROWER' as const,
      kycStatus: 'VERIFIED' as const,
    }
    setAuth('demo-token-borrower', 'demo-refresh-token', demoUser as any)
    useAuthStore.getState().completeKyc()
    router.replace('/(tabs)' as any)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.replace('/role-select' as any)}
      >
        <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                <Image 
                    source={{ uri: 'https://img.icons8.com/clouds/200/leaf.png' }}
                    style={styles.logo}
                />
            </View>
            <Text style={styles.appName}>GramChain</Text>
            <Text style={styles.tagline}>Grow Together with Trust</Text>
        </View>

        <View style={styles.formCard}>
            <View style={styles.modeToggle}>
                <TouchableOpacity 
                    style={[styles.modeTab, loginMode === 'password' && styles.modeTabActive]}
                    onPress={() => setLoginMode('password')}
                >
                    <Text style={[styles.modeTabText, loginMode === 'password' && styles.modeTabTextActive]}>Password</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.modeTab, loginMode === 'otp' && styles.modeTabActive]}
                    onPress={() => setLoginMode('otp')}
                >
                    <Text style={[styles.modeTabText, loginMode === 'otp' && styles.modeTabTextActive]}>OTP Login</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
                {loginMode === 'otp' ? (
                    <Input
                        label="Phone Number"
                        placeholder="98765 43210"
                        value={phone}
                        onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
                        keyboardType="phone-pad"
                        maxLength={10}
                        icon={<Ionicons name="call-outline" size={20} color={colors.gray[400]} />}
                    />
                ) : (
                    <>
                        <Input
                            label="Email Address"
                            placeholder="example@mail.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            icon={<Ionicons name="mail-outline" size={20} color={colors.gray[400]} />}
                        />
                        <Input
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            icon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[400]} />}
                        />
                        <TouchableOpacity 
                            style={styles.forgotPass}
                            onPress={() => router.push('/(auth)/forgot-password')}
                        >
                            <Text style={styles.forgotPassText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
                label={loginMode === 'otp' ? "GET OTP" : "LOGIN"}
                onPress={handleLogin}
                loading={loading}
                size="xl"
                variant="primary"
                style={styles.loginBtn}
            />

            <TouchableOpacity 
                style={styles.biometricBtn}
                onPress={handleBiometricLogin}
            >
                <Ionicons name="finger-print" size={20} color={colors.text.primary} />
                <Text style={styles.biometricText}>Login with Fingerprint</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.line} />
            </View>

            <Button
                label="Login with Google"
                onPress={() => promptAsync()}
                variant="outline"
                icon={<GoogleLogo size={20} />}
                size="xl"
                style={styles.googleBtn}
            />

            {/* Demo Login — skip all auth for testing */}
            <TouchableOpacity style={styles.demoBtn} onPress={handleDemoLogin}>
              <Text style={styles.demoBtnText}>🚀  QUICK DEMO LOGIN</Text>
              <Text style={styles.demoBtnSub}>Skip OTP — instant SHG dashboard</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.footer}>
            <Text style={styles.footerText}>New to GramChain? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.registerText}>Sign Up Now</Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[900], // Deep green background like TrustSeed
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  logo: {
    width: 70,
    height: 70,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.surface,
    marginTop: 15,
  },
  tagline: {
    fontSize: 16,
    color: colors.primary[100],
    opacity: 0.8,
    marginTop: 5,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    flex: 1,
    minHeight: 500,
  },
  inputGroup: {
    marginTop: 10,
    gap: 15,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginTop: -5,
  },
  forgotPassText: {
    color: colors.secondary[600],
    fontSize: 14,
    fontWeight: '600',
  },
  loginBtn: {
    marginTop: 25,
    borderRadius: radius.pill,
    height: 56,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[200],
  },
  dividerText: {
    marginHorizontal: 15,
    color: colors.gray[500],
    fontSize: 14,
    fontWeight: '700',
  },
  googleBtn: {
    borderRadius: radius.pill,
    height: 56,
    borderColor: colors.gray[200],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    paddingBottom: 20,
  },
  footerText: {
    color: colors.gray[100],
    fontSize: 15,
  },
  registerText: {
    color: colors.secondary[400],
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger[500],
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  modeTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[500],
  },
  modeTabTextActive: {
    color: colors.primary[700],
  },
  demoBtn: {
    marginTop: 16,
    backgroundColor: colors.primary[50],
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  demoBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary[700],
    letterSpacing: 0.5,
  },
  demoBtnSub: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 4,
  },
})
