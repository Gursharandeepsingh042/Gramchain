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
import { Alert } from 'react-native'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
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

  // Google Auth
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '647993260711-jecc37q5dc70au6agl977qcs3jvnk1ii.apps.googleusercontent.com',
    iosClientId:     '647993260711-jecc37q5dc70au6agl977qcs3jvnk1ii.apps.googleusercontent.com',
    webClientId:     '647993260711-jecc37q5dc70au6agl977qcs3jvnk1ii.apps.googleusercontent.com',
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
      setAuth(accessToken, refreshToken, { ...user, role: 'LENDER' })
      router.replace('/portfolio' as any)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Google login failed')
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

    try {
      const res = await authApi.loginWithPassword(email, password)
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, { ...user, role: 'LENDER' })
      router.replace('/portfolio' as any)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed')
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
