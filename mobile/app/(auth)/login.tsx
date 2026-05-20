import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Image, ScrollView, useWindowDimensions, Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import Constants from 'expo-constants'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Alert } from 'react-native'
import { auth } from '@/services/firebase'
import { startPhoneOtp } from '@/services/phoneAuth'
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, getScreenPadding, FORM_MAX_WIDTH } from '@/constants/design'
import { GoogleLogo } from '@/components/ui/GoogleLogo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current
  const formAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(headerAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, friction: 9, tension: 55, useNativeDriver: true }),
    ]).start()
  }, [])

  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const styles = useMemo(
    () => createStyles({ width, height, topInset: insets.top, bottomInset: insets.bottom }),
    [width, height, insets.bottom, insets.top],
  )

  // Google Auth — use explicit redirect URI for Expo Go, auto-detect for standalone
  const isExpoGo = Constants.appOwnership === 'expo'
  const redirectUri = isExpoGo
    ? 'https://auth.expo.io/@sharan66/gramchain'
    : makeRedirectUri({ scheme: 'gramchain', native: 'gramchain://' })

  console.log('[Google Auth] clientId =', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)

  const [request, response, promptAsync] = Google.useAuthRequest({
    // In Expo Go we MUST send only the Web client ID against the auth.expo.io
    // proxy redirect. Passing androidClientId/iosClientId in Expo Go makes
    // expo-auth-session pick the platform client, which Google then rejects
    // with the "deleted_client / authorized blocked" page because the
    // Android/iOS clients don't accept the HTTPS proxy redirect URI.
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: isExpoGo ? undefined : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: isExpoGo ? undefined : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  })

  useEffect(() => {
    if (request) console.log('[Google Auth] redirectUri =', request.redirectUri)
  }, [request])

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response
      // expo-auth-session may return accessToken only; use whichever is present
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
      console.log('[Google Auth] Token received, isIdToken:', isIdToken)
      // Build Firebase credential — idToken preferred, accessToken as fallback
      const credential = isIdToken
        ? GoogleAuthProvider.credential(token)
        : GoogleAuthProvider.credential(null, token)
      console.log('[Google Auth] Credential created')
      const userCredential = await signInWithCredential(auth, credential)
      console.log('[Google Auth] Firebase sign-in successful')
      const firebaseToken = await userCredential.user.getIdToken()
      console.log('[Google Auth] Firebase token obtained')

      const res = await authApi.verifyFirebase(firebaseToken)
      console.log('[Google Auth] Backend verification successful')
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(accessToken, refreshToken, user)
      router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
    } catch (err: any) {
      console.error('[Google Auth] Error:', err)
      const errorMsg = err.response?.data?.error?.message || err.message || 'Google login failed'
      setError(errorMsg)
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
        
        try {
          // Native Firebase Phone Auth — requires a dev/prod build (won't work in Expo Go).
          await startPhoneOtp(phone)
          router.push({ pathname: '/(auth)/verify-otp', params: { phone, mode: 'login' } })
        } catch (err: any) {
          setError(err.message || 'Failed to send OTP')
        }
      } else {
        const cred = email.trim()
        if (!cred) {
          setError('Please enter your email')
          setLoading(false)
          return
        }
        if (!password) {
          setError('Please enter your password')
          setLoading(false)
          return
        }

        try {
          // Backend /auth/login accepts EMAIL or 10-digit PHONE in `identifier`.
          const res = await authApi.loginWithPassword(cred, password)
          const { accessToken, refreshToken, user } = res.data.data
          setAuth(accessToken, refreshToken, user)

          // Save to secure store for biometric login
          await SecureStore.setItemAsync('saved_email', email)
          await SecureStore.setItemAsync('saved_password', password)

          router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
        } catch (err: any) {
          setError(err.response?.data?.error?.message || err.message || 'Login failed')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
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

      const promptMessage = Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Biometric'
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
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



  const handleGooglePress = () => {
    if (!request) {
      setError('Google sign-in is still preparing. Please try again in a moment.')
      return
    }
    setError('')
    promptAsync().catch(() => setError('Google sign-in was cancelled.'))
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/role-select' as any)}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
          </TouchableOpacity>

        <Animated.View style={[styles.header, {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
        }]}>
            <View style={styles.logoContainer}>
                <Image 
                    source={require('../../assets/icon.png')}
                    style={styles.logo}
                    resizeMode="cover"
                />
            </View>
            <Text style={styles.appName}>GramChain</Text>
            <Text style={styles.tagline}>Grow Together with Trust</Text>
        </Animated.View>

        <Animated.View style={[styles.formCard, {
          opacity: formAnim,
          transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}>
            <View style={styles.modeToggle}>
                <TouchableOpacity 
                    style={[styles.modeTab, loginMode === 'password' && styles.modeTabActive]}
                    onPress={() => setLoginMode('password')}
                >
                    <Text style={[styles.modeTabText, loginMode === 'password' && styles.modeTabTextActive]}>Email</Text>
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
                            label="Email"
                            placeholder="example@mail.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            icon={<Ionicons name="person-outline" size={20} color={colors.gray[400]} />}
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
                <Ionicons name={Platform.OS === 'ios' ? "scan-outline" : "finger-print"} size={20} color={colors.text.primary} />
                <Text style={styles.biometricText}>
                    {Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Fingerprint'}
                </Text>
            </TouchableOpacity>

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


        </Animated.View>

        <View style={styles.footer}>
            <Text style={styles.footerText}>New to GramChain? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.registerText}>Sign Up Now</Text>
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
  const isWide = width >= 1024
  const horizontalPadding = getScreenPadding(width)
  const logoContainerSize = isTablet ? 120 : 112
  const logoSize = isTablet ? 92 : 88
  const cardRadius = isTablet ? 48 : 40
  const formMinHeight = Math.max(height * (isTablet ? 0.5 : 0.62), isTablet ? 520 : 560)
  const footerPadding = bottomInset + (isTablet ? 40 : 28)
  const formMaxWidth = isTablet ? FORM_MAX_WIDTH : undefined
  const dividerVertical = isTablet ? 28 : 22

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary[900],
    },
    keyboard: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: horizontalPadding,
      paddingTop: 16,
      paddingBottom: footerPadding,
    },
    backBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    header: {
      alignItems: 'center',
      gap: isTablet ? 18 : 14,
      marginBottom: isTablet ? 40 : 32,
      maxWidth: formMaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    logoContainer: {
      width: logoContainerSize,
      height: logoContainerSize,
      borderRadius: logoContainerSize / 2,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      ...shadows.lg,
    },
    logo: {
      width: logoContainerSize,
      height: logoContainerSize,
    },
    appName: {
      fontSize: isWide ? 42 : isTablet ? 36 : 34,
      fontWeight: '800',
      color: colors.surface,
      letterSpacing: 0.5,
    },
    tagline: {
      fontSize: isTablet ? 18 : 16,
      color: colors.primary[100],
      opacity: 0.85,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: cardRadius,
      borderTopRightRadius: cardRadius,
      paddingHorizontal: isTablet ? 36 : 24,
      paddingVertical: isTablet ? 36 : 28,
      width: '100%',
      alignSelf: 'center',
      maxWidth: formMaxWidth,
      minHeight: formMinHeight,
      gap: 24,
      ...shadows.lg,
    },
    inputGroup: {
      gap: isTablet ? 18 : 15,
    },
    forgotPass: {
      alignSelf: 'flex-end',
      marginTop: -6,
    },
    forgotPassText: {
      color: colors.secondary[600],
      fontSize: isTablet ? 15 : 14,
      fontWeight: '600',
    },
    loginBtn: {
      marginTop: 12,
      borderRadius: radius.pill,
      height: 56,
    },
    biometricBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      gap: 8,
    },
    biometricText: {
      fontSize: isTablet ? 16 : 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: dividerVertical,
      gap: 12,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.gray[200],
    },
    dividerText: {
      color: colors.gray[500],
      fontSize: isTablet ? 15 : 14,
      fontWeight: '700',
      letterSpacing: 1,
    },
    googleBtn: {
      borderRadius: radius.pill,
      height: 56,
      borderColor: colors.gray[200],
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
      gap: 6,
    },
    footerText: {
      color: colors.gray[100],
      fontSize: isTablet ? 16 : 15,
    },
    registerText: {
      color: colors.secondary[400],
      fontSize: isTablet ? 16 : 15,
      fontWeight: '800',
    },
    errorText: {
      color: colors.danger[500],
      textAlign: 'center',
      marginTop: 6,
      fontSize: isTablet ? 15 : 14,
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.gray[100],
      borderRadius: radius.pill,
      padding: 4,
    },
    modeTab: {
      flex: 1,
      paddingVertical: isTablet ? 12 : 10,
      alignItems: 'center',
      borderRadius: radius.pill,
    },
    modeTabActive: {
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
    modeTabText: {
      fontSize: isTablet ? 16 : 15,
      fontWeight: '600',
      color: colors.gray[500],
    },
    modeTabTextActive: {
      color: colors.primary[700],
    },
  })
}
