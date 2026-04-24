import React, { useState } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '@/services/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows } from '@/constants/design'
import { GoogleLogo } from '@/components/ui/GoogleLogo'

type RecoveryStep = 1 | 2 | 3

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<RecoveryStep>(1)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  const handleIdentifierSubmit = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      // In a real app, you'd check if the user exists first.
      // For now, we go straight to verification options.
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const handleRecoveryOption = async (method: 'google' | 'otp') => {
    if (method === 'google') {
      // Logic for Google verification
      setStep(3)
    } else {
      setLoading(true)
      try {
        // Simulate sending recovery email
        await new Promise(resolve => setTimeout(resolve, 1000))
        setStep(3)
      } catch (err: any) {
        setError('Failed to send recovery email')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
        setError('Password must be at least 8 characters')
        return
    }
    setLoading(true)
    try {
      // Call reset endpoint (to be implemented on backend)
      router.replace('/login')
    } catch (err: any) {
      setError('Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(step - 1 as RecoveryStep)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Recovery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
            {step === 1 && (
                <View style={styles.inputGroup}>
                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>Enter your email address to find your account.</Text>
                    
                    <Input
                        label="Email Address"
                        placeholder="example@mail.com"
                        value={email}
                        onChangeText={setEmail}
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
                    <Text style={styles.title}>Verify Identity</Text>
                    <Text style={styles.subtitle}>Choose how you want to receive a code to reset your password.</Text>
                    
                    <TouchableOpacity 
                        style={styles.optionCard}
                        onPress={() => handleRecoveryOption('google')}
                    >
                        <View style={styles.optionIcon}>
                            <GoogleLogo size={24} />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={styles.optionTitle}>Use Google / Gmail</Text>
                            <Text style={styles.optionDesc}>Quickest & Most Secure (Recommended)</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.optionCard}
                        onPress={() => handleRecoveryOption('otp')}
                    >
                        <View style={[styles.optionIcon, { backgroundColor: colors.primary[50] }]}>
                            <Ionicons name="mail-outline" size={24} color={colors.primary[600]} />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={styles.optionTitle}>Send Recovery Email</Text>
                            <Text style={styles.optionDesc}>Receive recovery settings on {email}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {step === 3 && (
                <View style={styles.inputGroup}>
                    <Text style={styles.title}>Create New Password</Text>
                    <Text style={styles.subtitle}>Set a strong password to protect your account.</Text>
                    
                    <Input
                        label="New Password"
                        placeholder="Minimum 8 characters"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        icon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[400]} />}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <Button
                        label="RESET PASSWORD"
                        onPress={handleResetPassword}
                        loading={loading}
                        size="xl"
                        variant="primary"
                        style={styles.actionBtn}
                    />
                </View>
            )}
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    flex: 1,
    marginTop: 20,
    ...shadows.lg,
  },
  inputGroup: {
    marginTop: 10,
    gap: 15,
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: 15,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[800],
  },
  optionDesc: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  errorText: {
    color: colors.danger[500],
    textAlign: 'center',
    fontSize: 14,
  }
})
