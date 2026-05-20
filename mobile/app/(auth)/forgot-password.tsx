import React, { useState } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, useWindowDimensions, Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '@/services/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, getScreenPadding, FORM_MAX_WIDTH } from '@/constants/design'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStaggeredFadeIn, makeFadeStyle } from '@/hooks/useStaggeredFadeIn'

type RecoveryStep = 1 | 2

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<RecoveryStep>(1)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const isTablet = width >= 768
  const horizontalPadding = getScreenPadding(width)
  const minFormHeight = Math.max(height * (isTablet ? 0.5 : 0.62), isTablet ? 520 : 560)
  const formMaxWidth = isTablet ? FORM_MAX_WIDTH : undefined

  const [headerAnim, cardAnim] = useStaggeredFadeIn({ count: 2, resetKey: step })

  const handleIdentifierSubmit = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await authApi.checkEmail(trimmed)
      if (res.data.data.exists) {
        setStep(2)
      } else {
        setError('Account does not exist. Please check your email or sign up.')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Unable to verify account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + (isTablet ? 40 : 28) }
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Animated.View style={[
            styles.header, 
            { paddingHorizontal: horizontalPadding, maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' },
            makeFadeStyle(headerAnim)
          ]}>
            <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(1)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.surface} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Account Recovery</Text>
            <View style={{ width: 40 }} />
          </Animated.View>

          <Animated.View style={[
            styles.formCard,
            {
              paddingHorizontal: horizontalPadding + 6,
              maxWidth: formMaxWidth,
              minHeight: minFormHeight,
              alignSelf: 'center',
              width: '100%',
            },
            makeFadeStyle(cardAnim, 32),
          ]}>
            {step === 1 && (
              <View style={styles.inputGroup}>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>Enter your email address and we will check if your account exists.</Text>

                <Input
                  label="Email Address"
                  placeholder="example@mail.com"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError('') }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  icon={<Ionicons name="mail-outline" size={20} color={colors.gray[400]} />}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Button
                  label="FIND ACCOUNT"
                  onPress={handleIdentifierSubmit}
                  loading={loading}
                  size="xl"
                  variant="primary"
                  style={styles.actionBtn}
                />
              </View>
            )}

            {step === 2 && (
              <View style={styles.inputGroup}>
                <View style={styles.successIcon}>
                  <Ionicons name="mail-outline" size={48} color={colors.primary[600]} />
                </View>
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                  If an account exists for{' '}
                  <Text style={styles.emailHighlight}>{email}</Text>,
                  {'\n'}a password reset link has been sent.
                </Text>
                <Text style={styles.hintText}>
                  Didn't receive it? Check your spam folder or try again in a few minutes.
                </Text>

                <Button
                  label="BACK TO LOGIN"
                  onPress={() => router.replace('/login')}
                  size="xl"
                  variant="outline"
                  style={styles.actionBtn}
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingVertical: 30,
    marginTop: 16,
    ...shadows.lg,
  },
  inputGroup: {
    marginTop: 10,
    gap: 15,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary[900],
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray[600],
    lineHeight: 22,
    marginBottom: 20,
  },
  actionBtn: {
    marginTop: 20,
    borderRadius: radius.pill,
    height: 56,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emailHighlight: {
    fontWeight: '800',
    color: colors.primary[800],
  },
  hintText: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger[500],
    textAlign: 'center',
    fontSize: 14,
  }
})
