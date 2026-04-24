import { useEffect, useCallback } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import '@/i18n' // Init translations
import { storage } from '@/services/storage'
import { I18nextProvider } from 'react-i18next'
import * as SplashScreen from 'expo-splash-screen'
import i18n from '@/i18n'

// Prevent splash screen from hiding automatically until assets are loaded
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

export default function RootLayout() {
  const { token, isKycComplete, user } = useAuthStore()

  const isLender = user?.role === 'LENDER'

  const onLayoutRootView = useCallback(async () => {
    // Hide splash screen once we have determined the initial layout
    await SplashScreen.hideAsync()
  }, [])

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <StatusBar style={isLender ? 'light' : 'dark'} />
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
  )
}
