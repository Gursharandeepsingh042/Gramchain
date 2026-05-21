import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Animated, Alert, KeyboardAvoidingView, Platform, useWindowDimensions, Image
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
import { radius, shadows, getScreenPadding, FORM_MAX_WIDTH } from '@/constants/design'
import { GoogleLogo } from '@/components/ui/GoogleLogo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

WebBrowser.maybeCompleteAuthSession()

/**
 * Lender Login Screen — premium, investor-focused design
 * Uses the same backend auth but sets role to LENDER on success
 */
export default function LenderLoginScreen() {
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const styles = useMemo(
    () => createStyles({ width, height, topInset: insets.top, bottomInset: insets.bottom }),
    [width, height, insets.bottom, insets.top],
  )

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
    // Expo Go: only send the Web client. Native builds: send platform IDs.
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
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

  const handleGooglePress = () => {
    if (!request) {
      setError('Google sign-in is still preparing. Please try again shortly.')
      return
    }
    setError('')
    promptAsync().catch(() => setError('Google sign-in was cancelled.'))
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
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Header */}
          <Animated.View style={[styles.header, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }]}>
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/circular logo.png')} style={styles.logo} resizeMode="cover" />
            </View>
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
                secureTextEntry={!showPassword}
                icon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[400]} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.gray[400]} />
                  </TouchableOpacity>
                }
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
              onPress={handleGooglePress}
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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
  const cardRadius = isTablet ? 32 : 28
  const cardPadding = isTablet ? 32 : 24
  const formMaxWidth = isTablet ? FORM_MAX_WIDTH : undefined
  const contentGap = isTablet ? 28 : 22
  const footerPadding = bottomInset + (isTablet ? 38 : 26)
  const formMinHeight = Math.max(height * (isTablet ? 0.5 : 0.62), isTablet ? 520 : 560)

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    bgWrapper: {
      ...StyleSheet.absoluteFillObject,
    },
    accentCircle1: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: isTablet ? 240 : 200,
      height: isTablet ? 240 : 200,
      borderRadius: isTablet ? 120 : 100,
      backgroundColor: 'rgba(59,130,246,0.08)',
    },
    accentCircle2: {
      position: 'absolute',
      bottom: isTablet ? 120 : 100,
      left: -60,
      width: isTablet ? 220 : 180,
      height: isTablet ? 220 : 180,
      borderRadius: isTablet ? 110 : 90,
      backgroundColor: 'rgba(245,158,11,0.05)',
    },
    safe: {
      flex: 1,
    },
    keyboard: {
      flex: 1,
    },
    backBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignSelf: 'flex-start',
      marginTop: 8,
      marginLeft: horizontalPadding,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: horizontalPadding,
      paddingBottom: footerPadding,
      paddingTop: 16,
    },
    header: {
      paddingTop: 4,
      marginBottom: 8,
      gap: 16,
      alignItems: 'center',
      maxWidth: formMaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    logoContainer: {
      width: isTablet ? 96 : 96,
      height: isTablet ? 96 : 96,
      borderRadius: isTablet ? 48 : 48,
      backgroundColor: 'rgba(255,255,255,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    logo: {
      width: isTablet ? 96 : 96,
      height: isTablet ? 96 : 96,
    },
    lenderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(245,158,11,0.12)',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
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
      fontSize: isTablet ? 34 : 32,
      fontWeight: '900',
      color: colors.surface,
      lineHeight: isTablet ? 44 : 40,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: isTablet ? 16 : 15,
      color: 'rgba(255,255,255,0.6)',
      lineHeight: isTablet ? 24 : 22,
      maxWidth: isTablet ? 500 : undefined,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      paddingHorizontal: cardPadding,
      paddingVertical: cardPadding,
      ...shadows.xl,
      width: '100%',
      alignSelf: 'center',
      maxWidth: formMaxWidth,
      minHeight: formMinHeight,
      gap: 20,
    },
    inputGroup: {
      gap: isTablet ? 16 : 12,
    },
    forgotPass: {
      alignSelf: 'flex-end',
      marginTop: -4,
    },
    forgotPassText: {
      color: colors.secondary[600],
      fontSize: isTablet ? 15 : 14,
      fontWeight: '600',
    },
    loginBtn: {
      marginTop: 16,
      borderRadius: radius.pill,
      height: 56,
      backgroundColor: colors.info[600],
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: isTablet ? 26 : 22,
      gap: 12,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.gray[200],
    },
    dividerText: {
      color: colors.gray[500],
      fontSize: isTablet ? 14 : 13,
      fontWeight: '700',
      letterSpacing: 1,
    },
    googleBtn: {
      borderRadius: radius.pill,
      height: 56,
      borderColor: colors.gray[200],
    },
    yieldBanner: {
      marginTop: 20,
      backgroundColor: colors.primary[50],
      borderRadius: 16,
      padding: isTablet ? 20 : 16,
      borderWidth: 1,
      borderColor: colors.primary[100],
    },
    yieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    yieldItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    yieldValue: {
      fontSize: isTablet ? 22 : 20,
      fontWeight: '900',
      color: colors.primary[700],
    },
    yieldLabel: {
      fontSize: isTablet ? 12 : 11,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    yieldDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.primary[200],
    },
    errorText: {
      color: colors.danger[500],
      textAlign: 'center',
      marginTop: 6,
      fontSize: isTablet ? 15 : 14,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20,
      gap: 6,
    },
    footerText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: isTablet ? 16 : 15,
    },
    registerText: {
      color: colors.secondary[400],
      fontSize: isTablet ? 16 : 15,
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
      gap: 6,
    },
    demoBtnText: {
      fontSize: isTablet ? 18 : 16,
      fontWeight: '800',
      color: '#60a5fa',
      letterSpacing: 0.5,
    },
    demoBtnSub: {
      fontSize: isTablet ? 12 : 11,
      color: '#94a3b8',
    },
  })
}
