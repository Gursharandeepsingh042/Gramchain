import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Image, ScrollView, useWindowDimensions, Animated, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import Constants from 'expo-constants'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Alert } from 'react-native'
import axios from 'axios'
import { startPhoneOtp } from '@/services/phoneAuth'
import { authApi, getApiBaseUrl } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, getScreenPadding, FORM_MAX_WIDTH } from '@/constants/design'
import { GoogleLogo } from '@/components/ui/GoogleLogo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false)

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current
  const formAnim = useRef(new Animated.Value(0)).current

  // Check if saved refresh token exists on mount
  useEffect(() => {
    SecureStore.getItemAsync('saved_refresh_token').then(token => {
      setHasSavedCredentials(!!token)
    })
  }, [])

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

  // Google Auth — backend-proxied flow (no auth.expo.io dependency)
  // Expo Go needs exp:// URL, native builds use gramchain://
  const isExpoGo = Constants.appOwnership === 'expo'
  const returnUrl = isExpoGo
    ? makeRedirectUri({ scheme: 'exp' })
    : makeRedirectUri({ scheme: 'gramchain' })

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const baseUrl = getApiBaseUrl()
      const startUrl = `${baseUrl}/auth/google/mobile-start?returnUrl=${encodeURIComponent(returnUrl)}&mode=login&role=BORROWER`
      console.log('[Google Auth] Opening:', startUrl)
      console.log('[Google Auth] Return URL:', returnUrl)
      console.log('[Google Auth] isExpoGo:', isExpoGo)

      console.log('[Google Auth] Calling openAuthSessionAsync...')
      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl)
      console.log('[Google Auth] Result type:', result.type)
      console.log('[Google Auth] Result:', result)

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url)
        const errorParam = url.searchParams.get('error')
        if (errorParam) {
          // Display user-friendly error message
          if (errorParam.includes('already exists')) {
            setError('An account with this Google email already exists. Please login instead.')
          } else if (errorParam.includes('not found')) {
            setError('No account registered with this Google email. Please sign up first.')
          } else {
            setError(`Google sign-in failed: ${errorParam}`)
          }
          return
        }

        const accessToken = url.searchParams.get('accessToken')
        const refreshToken = url.searchParams.get('refreshToken')
        const userId = url.searchParams.get('userId')
        const userName = url.searchParams.get('userName')
        const userEmail = url.searchParams.get('userEmail')
        const kycStatus = url.searchParams.get('kycStatus')
        const userRole = url.searchParams.get('userRole')

        if (!accessToken || !refreshToken || !userId) {
          setError('Google sign-in failed: incomplete response.')
          return
        }

        const user = {
          id: userId,
          name: userName || '',
          email: userEmail || '',
          kycStatus: kycStatus || '',
          role: userRole || 'BORROWER',
        } as any

        setAuth(accessToken, refreshToken, user)
        console.log('[Google Auth] Login successful for:', userEmail)
        router.replace(kycStatus === 'VERIFIED' ? '/' : '/kyc')
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setError('Google sign-in was cancelled.')
      }
    } catch (err: any) {
      console.error('[Google Auth] Error:', err)
      setError(err.message || 'Google login failed')
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

          // Save refresh token to secure store for biometric login (more secure than storing password)
          await SecureStore.setItemAsync('saved_refresh_token', refreshToken)
          setHasSavedCredentials(true)

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
        const savedRefreshToken = await SecureStore.getItemAsync('saved_refresh_token')

        if (savedRefreshToken) {
            try {
                // Use refresh token to get new access token (more secure than storing password)
                const baseURL = getApiBaseUrl()
                const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken: savedRefreshToken })
                const { accessToken, refreshToken: newRefreshToken, user } = res.data.data

                // Update store with new tokens
                setAuth(accessToken, newRefreshToken, user)

                // Update saved refresh token
                await SecureStore.setItemAsync('saved_refresh_token', newRefreshToken)

                router.replace(user.kycStatus === 'VERIFIED' ? '/' : '/kyc')
            } catch (err: any) {
                // If refresh fails, clear the saved token and ask user to login with password
                await SecureStore.deleteItemAsync('saved_refresh_token')
                setError('Session expired. Please login with your password.')
                Alert.alert('Session Expired', 'Please login with your password to enable biometric login again.')
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
    console.log('[Google Auth] Button pressed')
    setError('')
    handleGoogleLogin()
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
                    source={require('../../assets/circular logo.png')}
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

            <TouchableOpacity
                onPress={handleLogin}
                style={styles.loginBtn}
                activeOpacity={0.7}
                disabled={loading}
            >
                <View style={styles.loginBtnContent}>
                    {loading ? (
                        <ActivityIndicator color={colors.text.inverse} size="small" />
                    ) : (
                        <Text style={styles.loginBtnText}>{loginMode === 'otp' ? "GET OTP" : "LOGIN"}</Text>
                    )}
                </View>
            </TouchableOpacity>

            {hasSavedCredentials && (
            <TouchableOpacity 
                style={styles.biometricBtn}
                onPress={handleBiometricLogin}
            >
                <Ionicons name={Platform.OS === 'ios' ? "scan-outline" : "finger-print"} size={20} color={colors.text.primary} />
                <Text style={styles.biometricText}>
                    {Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Fingerprint'}
                </Text>
            </TouchableOpacity>
            )}

            <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.line} />
            </View>

            <TouchableOpacity
                onPress={handleGooglePress}
                style={styles.googleBtn}
                activeOpacity={0.7}
            >
                <View style={styles.googleBtnContent}>
                    <GoogleLogo size={20} />
                    <Text style={styles.googleBtnText}>Login with Google</Text>
                </View>
            </TouchableOpacity>


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
      backgroundColor: colors.primary[600],
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.inverse,
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
      borderWidth: 1.5,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    googleBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    googleBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary[600],
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
