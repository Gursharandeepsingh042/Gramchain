import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Animated, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import Constants from 'expo-constants'
import { auth } from '@/services/firebase'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows } from '@/constants/design'
import { GoogleLogo } from '@/components/ui/GoogleLogo'

WebBrowser.maybeCompleteAuthSession()

/**
 * Lender Login Screen — premium, investor-focused design
 * Uses the same backend auth but sets role to LENDER on success
 */
export default function LenderLoginScreen() {
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Animations
  const headerAnim = React.useRef(new Animated.Value(0)).current
  const formAnim = React.useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start()
  }, [])

  // Google Auth — same Firebase-backed flow as borrower login
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

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response
      const token = authentication?.idToken || authentication?.accessToken
      if (token) {
        handleGoogleLogin(token, !!authentication?.idToken)
      } else {
        setError('Google sign-in failed: no token returned.')
      }
    } else if (response?.type === 'error') {
      const baseMsg = response.error?.message || 'Google sign-in was cancelled or failed.'
      const tip = request?.redirectUri
        ? `\n\nIf this says "redirect_uri_mismatch", add this URL to your Google OAuth Web Client → Authorized redirect URIs:\n${request.redirectUri}`
        : ''
      setError(baseMsg + tip)
    }
  }, [response, request])

  const handleGoogleLogin = async (token: string, isIdToken = true) => {
    setLoading(true)
    setError('')
    try {
      const credential = isIdToken
        ? GoogleAuthProvider.credential(token)
        : GoogleAuthProvider.credential(null, token)
      const userCredential = await signInWithCredential(auth, credential)
      const firebaseToken = await userCredential.user.getIdToken()

      const res = await authApi.verifyFirebase(firebaseToken, undefined, undefined, undefined, 'LENDER')
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, { ...user, role: 'LENDER' })
      router.replace('/portfolio' as any)
    } catch (err: any) {
      setError(err.message || 'Google login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = () => {
    // Bypass backend for demo — inject mock investor session
    const demoUser = {
      id: 'demo-investor-001',
      phone: '9999999999',
      name: 'Demo Investor',
      email: 'demo@investor.com',
      role: 'LENDER' as const,
      kycStatus: 'VERIFIED' as const,
    }
    setAuth('demo-token-investor', 'demo-refresh-token', demoUser as any)
    // No KYC needed for demo lender
    router.replace('/portfolio' as any)
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }
    if (!password) {
      setError('Please enter your password')
      setLoading(false)
      return
    }

    try {
      // Use backend password login (credentials are stored in backend DB, not Firebase)
      const res = await authApi.loginWithPassword(email, password)
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, { ...user, role: 'LENDER' })

      // Save to secure store for biometric login
      await SecureStore.setItemAsync('saved_email', email)
      await SecureStore.setItemAsync('saved_password', password)

      router.replace('/portfolio' as any)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Premium dark background with subtle accents */}
      <View style={styles.bgWrapper}>
        <View style={styles.accentCircle1} />
        <View style={styles.accentCircle2} />
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View style={[styles.header, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }]}>
            <View style={styles.lenderBadge}>
              <Text style={styles.lenderBadgeIcon}>💎</Text>
              <Text style={styles.lenderBadgeText}>INVESTOR PORTAL</Text>
            </View>
            <Text style={styles.title}>Welcome Back,{'\n'}Investor</Text>
            <Text style={styles.subtitle}>
              Access your portfolio, track returns, and manage your impact investments
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[styles.formCard, {
            opacity: formAnim,
            transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }]}>
            <View style={styles.inputGroup}>
              <Input
                label="Email Address"
                placeholder="investor@example.com"
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
                onPress={() => router.push('/forgot-password' as any)}
              >
                <Text style={styles.forgotPassText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              label="LOGIN TO PORTFOLIO"
              onPress={handleLogin}
              loading={loading}
              size="xl"
              variant="primary"
              style={styles.loginBtn}
            />

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
              <Text style={styles.demoBtnSub}>Skip OTP — instant investor dashboard</Text>
            </TouchableOpacity>

            {/* Yield Info Banner */}
            <View style={styles.yieldBanner}>
              <View style={styles.yieldRow}>
                <View style={styles.yieldItem}>
                  <Text style={styles.yieldValue}>12%</Text>
                  <Text style={styles.yieldLabel}>Avg APY</Text>
                </View>
                <View style={styles.yieldDivider} />
                <View style={styles.yieldItem}>
                  <Text style={styles.yieldValue}>₹2.4Cr</Text>
                  <Text style={styles.yieldLabel}>Deployed</Text>
                </View>
                <View style={styles.yieldDivider} />
                <View style={styles.yieldItem}>
                  <Text style={styles.yieldValue}>98.2%</Text>
                  <Text style={styles.yieldLabel}>Repayment</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to GramChain? </Text>
            <TouchableOpacity onPress={() => router.push('/lender-signup' as any)}>
              <Text style={styles.registerText}>Create Investor Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c1a2e',
  },
  bgWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  accentCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  accentCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  safe: {
    flex: 1,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 10,
    marginBottom: 30,
  },
  lenderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 6,
  },
  lenderBadgeIcon: {
    fontSize: 14,
  },
  lenderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary[400],
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.surface,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 10,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 28,
    ...shadows.xl,
  },
  inputGroup: {
    gap: 12,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotPassText: {
    color: colors.secondary[600],
    fontSize: 14,
    fontWeight: '600',
  },
  loginBtn: {
    marginTop: 24,
    borderRadius: radius.pill,
    height: 56,
    backgroundColor: '#1a56db',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[200],
  },
  dividerText: {
    marginHorizontal: 15,
    color: colors.gray[500],
    fontSize: 13,
    fontWeight: '700',
  },
  googleBtn: {
    borderRadius: radius.pill,
    height: 56,
    borderColor: colors.gray[200],
  },
  yieldBanner: {
    marginTop: 22,
    backgroundColor: colors.primary[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  yieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yieldItem: {
    flex: 1,
    alignItems: 'center',
  },
  yieldValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary[700],
  },
  yieldLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  yieldDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.primary[200],
  },
  errorText: {
    color: colors.danger[500],
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingBottom: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  },
  registerText: {
    color: colors.secondary[400],
    fontSize: 15,
    fontWeight: '800',
  },
  demoBtn: {
    marginTop: 16,
    backgroundColor: '#172554',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e40af',
  },
  demoBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  demoBtnSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
})
