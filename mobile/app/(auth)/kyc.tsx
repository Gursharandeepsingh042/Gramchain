import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Animated, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TrustBadge } from '@/components/ui/SharedComponents'
import { useAuthStore } from '@/store/auth.store'
import { createWallet } from '@/services/wallet'
import { kycApi } from '@/services/api'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

type KycStep = 'PAN' | 'AADHAAR' | 'OTP' | 'PROFILE'

export default function KycScreen() {
  const { t } = useTranslation()
  const { completeKyc } = useAuthStore()
  
  const [step, setStep] = useState<KycStep>('AADHAAR')
  const [loading, setLoading] = useState(false)
  
  // KYC Form State
  const [pan, setPan] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [otp, setOtp] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [error, setError] = useState('')

  // Profile data
  const [profile, setProfile] = useState({
    name: '',
    dob: '',
    gender: '',
    address: '',
    email: '',
    occupation: ''
  })

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1,  duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,  friction: 8,   useNativeDriver: true }),
    ]).start()
  }, [step]) // trigger animation on step change too

  const handleVerifyPan = async () => {
    if (pan.length !== 10) {
      setError('Please enter a valid 10-character PAN')
      return
    }
    setError('')
    setLoading(true)
    
    try {
      const res = await kycApi.verifyPan(pan)
      // PAN is verified, move to profile completion
      setStep('PROFILE')
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'PAN Verification failed. Please check the ID.')
    } finally {
      setLoading(false)
    }
  }

  const handleFetchAadhaar = async () => {
    if (aadhaar.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar number')
      return
    }
    setError('')
    setLoading(true)
    
    try {
      const res = await kycApi.sendAadhaarOtp(aadhaar)
      setReferenceId(res.data.data.referenceId)
      setStep('OTP')
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to request Aadhaar OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAadhaarOtp = async () => {
    if (otp.length !== 6) {
      setError('Enter a 6-digit OTP')
      return
    }
    setError('')
    setLoading(true)
    
    try {
      const res = await kycApi.verifyAadhaarOtp(referenceId, otp, aadhaar)
      const details = res.data.data.details
      setProfile({
        ...profile,
        name: res.data.data.user.name || '', // Got name from updated user record
        dob: details.dob || '',
        gender: details.gender || '',
        address: details.address || ''
      })
      // Aadhaar done, now verify PAN
      setStep('PAN')
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Invalid Aadhaar OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteProfile = async () => {
    if (!profile.name) {
      setError('Name is required.')
      return
    }
    setError('')
    setLoading(true)

    try {
      await createWallet()
      completeKyc()
      router.replace('/')
    } catch (e: any) {
      console.error('Wallet creation failed during KYC', e)
      setError('Failed to complete profile. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconRow}>
          <View style={styles.iconBg}>
            <Text style={styles.iconEmoji}>🛡️</Text>
          </View>
        </View>

        {step === 'PAN' && (
          <>
            <Text style={styles.heading}>Verify PAN Card</Text>
            <Text style={styles.subheading}>
              Enter your Permanent Account Number for official name verification.
            </Text>

            <View style={styles.formContainer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Input
                label="PAN Number"
                placeholder="ABCDE1234F"
                maxLength={10}
                autoCapitalize="characters"
                value={pan}
                onChangeText={(val) => {
                  setPan(val.toUpperCase())
                  setError('')
                }}
              />

              <Button
                label="Verify PAN"
                onPress={handleVerifyPan}
                loading={loading}
                disabled={pan.length !== 10 || loading}
                size="xl"
                style={{ marginTop: 16 }}
              />
            </View>
          </>
        )}

        {step === 'AADHAAR' && (
          <>
            <Text style={styles.heading}>Verify Aadhaar</Text>
            <Text style={styles.subheading}>
              Enter your 12-digit Aadhaar ID to fetch details automatically.
            </Text>

            <View style={styles.formContainer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Input
                label="Aadhaar Number"
                placeholder="0000 0000 0000"
                keyboardType="number-pad"
                maxLength={12}
                value={aadhaar}
                onChangeText={(val) => {
                  setAadhaar(val.replace(/[^0-9]/g, ''))
                  setError('')
                }}
              />

              <Button
                label="Get OTP"
                onPress={handleFetchAadhaar}
                loading={loading}
                disabled={aadhaar.length !== 12 || loading}
                size="xl"
                style={{ marginTop: 16 }}
              />
            </View>
          </>
        )}

        {step === 'OTP' && (
          <>
            <Text style={styles.heading}>Aadhaar OTP</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit OTP sent to your Aadhaar registered mobile number.
            </Text>

            <View style={styles.formContainer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Input
                label="Enter OTP"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(val) => {
                  setOtp(val.replace(/[^0-9]/g, ''))
                  setError('')
                }}
              />

              <Button
                label="Verify & Fetch Details"
                onPress={handleVerifyAadhaarOtp}
                loading={loading}
                disabled={otp.length !== 6 || loading}
                size="xl"
                style={{ marginTop: 16 }}
              />
            </View>
          </>
        )}

        {step === 'PROFILE' && (
          <>
            <Text style={styles.heading}>Complete Profile</Text>
            <Text style={styles.subheading}>
              Please verify the fetched details and fill in the remaining information.
            </Text>

            <View style={styles.formContainer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Input
                label="Full Name (Verified by PAN)"
                value={profile.name}
                editable={false}
                style={{ backgroundColor: colors.gray[100] }}
              />
              
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label="Date of Birth"
                    value={profile.dob}
                    onChangeText={(val) => setProfile({ ...profile, dob: val })}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label="Gender"
                    value={profile.gender}
                    onChangeText={(val) => setProfile({ ...profile, gender: val })}
                  />
                </View>
              </View>

              <Input
                label="Address (Fetched)"
                value={profile.address}
                onChangeText={(val) => setProfile({ ...profile, address: val })}
                containerStyle={{ minHeight: 60 }}
              />

              <Input
                label="Email Address (Optional)"
                placeholder="example@mail.com"
                value={profile.email}
                onChangeText={(val) => setProfile({ ...profile, email: val })}
                keyboardType="email-address"
              />

              <Input
                label="Occupation"
                placeholder="E.g. Farmer, Artisan, etc."
                value={profile.occupation}
                onChangeText={(val) => setProfile({ ...profile, occupation: val })}
              />

              <Button
                label="Complete & Create Wallet"
                onPress={handleCompleteProfile}
                loading={loading}
                disabled={loading}
                size="xl"
                style={{ marginTop: 24 }}
              />
            </View>
          </>
        )}

        <View style={styles.trustWrapper}>
          <TrustBadge />
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 20,
    paddingBottom: 40,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  iconEmoji: {
    fontSize: 38,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  formContainer: {
    backgroundColor: colors.gray[50],
    padding: 20,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  errorText: {
    color: colors.danger[500],
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  trustWrapper: {
    marginTop: 40,
    alignItems: 'center',
  },
})
