import { useEffect, useCallback, useRef, memo, useState } from 'react'
import { View, Animated, Text, StyleSheet, InteractionManager } from 'react-native'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useNetInfo } from '@react-native-community/netinfo'
import '@/i18n' // Init translations
import { I18nextProvider } from 'react-i18next'
import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'
import i18n from '@/i18n'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '@/constants/colors'

// In Expo Go, the host app shows its own splash + loading bar — holding
// our splash on top makes startup feel slow and double-flashes. Only block
// auto-hide in dev/standalone builds where we control the splash asset.
const IS_EXPO_GO = Constants.appOwnership === 'expo'
if (!IS_EXPO_GO) {
  SplashScreen.preventAutoHideAsync().catch(() => { /* ignore */ })
}

const queryClient = new QueryClient()

// memo prevents re-renders when parent re-renders
const OfflineBanner = memo(() => {
  const netInfo = useNetInfo()
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(-100)).current

  // Extract primitive boolean — avoids re-renders from netInfo object reference changes
  const isOffline = netInfo.isConnected === false
  const insetsTop = insets.top

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? insetsTop : -100,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [isOffline, insetsTop]) // stable primitives only

  return (
    <Animated.View style={[styles.offlineBanner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.offlineText}>Working Offline - Changes will sync automatically</Text>
    </Animated.View>
  )
})

export default function RootLayout() {
  const { token, isKycComplete, kycSkipped, user, hasHydrated } = useAuthStore()

  const isLender = user?.role === 'LENDER'

  const [isAppReady, setIsAppReady] = useState(false)
  const [showSplashOverlay, setShowSplashOverlay] = useState(true)
  const [isAnimationDone, setIsAnimationDone] = useState(false)
  const splashOpacity = useRef(new Animated.Value(1)).current
  const splashVideoRef = useRef<Video | null>(null)

  useEffect(() => {
    let isMounted = true

    const prepare = async () => {
      try {
        await Promise.all([
          new Promise<void>((resolve) => {
            InteractionManager.runAfterInteractions(() => resolve())
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 420)),
        ])
      } finally {
        if (isMounted) {
          setIsAppReady(true)
        }
      }
    }

    prepare()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isAppReady || !isAnimationDone) return

    let isMounted = true

    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 360,
      delay: 120,
      useNativeDriver: true,
    }).start(() => {
      if (isMounted) {
        setShowSplashOverlay(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [isAppReady, isAnimationDone, splashOpacity])

  useEffect(() => {
    // Future: Initialize background sync when services are production-ready
  }, [])

  const onLayoutRootView = useCallback(async () => {
    if (IS_EXPO_GO || !isAppReady) return // nothing to hide; never blocked
    // Hide splash screen once we have determined the initial layout
    await SplashScreen.hideAsync().catch(() => { /* already hidden */ })
  }, [isAppReady])

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!('isLoaded' in status) || !status.isLoaded) return
    if (status.didJustFinish) {
      setIsAnimationDone(true)
    }
  }, [])

  const handleVideoError = useCallback((error: unknown) => {
    console.error('Splash animation failed to play', error)
    setIsAnimationDone(true)
  }, [])

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <StatusBar style={showSplashOverlay ? 'light' : (isLender ? 'light' : 'dark')} />
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                {hasHydrated ? (
                  token ? (
                    isLender ? (
                      // Lender flow — skip KYC for now, go straight to lender dashboard
                      <Stack.Screen name="(lender)" />
                    ) : isKycComplete || kycSkipped ? (
                      <Stack.Screen name="(tabs)" />
                    ) : (
                      <Stack.Screen name="(auth)/kyc" />
                    )
                  ) : (
                    <Stack.Screen name="(auth)" />
                  )
                ) : (
                  <Stack.Screen name="(auth)" />
                )}
              </Stack>
            </SafeAreaProvider>
          </QueryClientProvider>
        </I18nextProvider>
        {showSplashOverlay && (
          <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity }]}
            pointerEvents="auto">
            <LinearGradient
              colors={colors.gradient.logoSoft}
              style={styles.splashGradient}
            >
              <Video
                ref={splashVideoRef}
                style={styles.splashVideo}
                source={require('../assets/animations/animation2.mp4')}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isMuted
                isLooping={false}
                onPlaybackStatusUpdate={handlePlaybackStatus}
                onError={handleVideoError}
                useNativeControls={false}
              />
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0e232f',
    zIndex: 9999,
  },
  splashGradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  splashVideo: {
    width: '150%',
    maxWidth: 700,
    aspectRatio: 1,
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ea580c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  }
})
