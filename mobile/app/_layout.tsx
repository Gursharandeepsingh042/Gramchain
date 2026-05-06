import { useEffect, useCallback, useRef } from 'react'
import { View, Animated, Text, StyleSheet } from 'react-native'
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
import i18n from '@/i18n'

// Prevent splash screen from hiding automatically until assets are loaded
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

const OfflineBanner = () => {
  const netInfo = useNetInfo()
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(-100)).current

  const isOffline = netInfo.isConnected === false

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? insets.top : -100,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [isOffline, insets.top])

  return (
    <Animated.View style={[styles.offlineBanner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.offlineText}>Working Offline - Changes will sync automatically</Text>
    </Animated.View>
  )
}

export default function RootLayout() {
  const { token, isKycComplete, user } = useAuthStore()

  const isLender = user?.role === 'LENDER'

  useEffect(() => {
    // Future: Initialize background sync when services are production-ready
  }, [])

  const onLayoutRootView = useCallback(async () => {
    // Hide splash screen once we have determined the initial layout
    await SplashScreen.hideAsync()
  }, [])

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <StatusBar style={isLender ? 'light' : 'dark'} />
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                {token ? (
                  isLender ? (
                    // Lender flow — skip KYC for now, go straight to lender dashboard
                    <Stack.Screen name="(lender)" />
                  ) : isKycComplete ? (
                    <Stack.Screen name="(tabs)" />
                  ) : (
                    <Stack.Screen name="(auth)/kyc" />
                  )
                ) : (
                  <Stack.Screen name="(auth)" />
                )}
              </Stack>
            </SafeAreaProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </View>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
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
