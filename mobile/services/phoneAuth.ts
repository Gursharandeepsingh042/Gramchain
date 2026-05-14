/**
 * Phone OTP layer — native Firebase Phone Auth ONLY.
 *
 * Real SMS, real numbers. Uses @react-native-firebase/auth which does
 * Play Integrity (Android) / APNs (iOS) — no reCAPTCHA on device.
 *
 * IMPORTANT: This module REQUIRES a development or production build.
 *   It cannot work in Expo Go, because Expo Go does not bundle the
 *   @react-native-firebase native modules. Run:
 *     eas build --profile development -p android
 *   then install the resulting APK on your device.
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { getRnAuth, setPendingConfirmation, clearPendingConfirmation } from './firebase'

export const isExpoGo = Constants.appOwnership === 'expo'

export const isNativePhoneAuthAvailable = (): boolean => {
  if (Platform.OS === 'web') return false
  return getRnAuth() !== null
}

export type PhoneOtpResult =
  | { kind: 'firebase'; idToken: string; firebaseUser: any }

export interface PhoneOtpSession {
  readonly kind: 'firebase'
  /** The phone number this session is bound to (10-digit, no country code). */
  readonly phone: string
  confirm(otp: string): Promise<PhoneOtpResult>
  /** Re-send the OTP using the same backend. */
  resend(): Promise<void>
}

// Module-scoped session pointer so screens can hand off across navigation
// (e.g. login → verify-otp). Cleared after a successful confirm() or logout.
let activeSession: PhoneOtpSession | null = null
export const getActivePhoneSession = () => activeSession
export const clearActivePhoneSession = () => { activeSession = null }

const NATIVE_UNAVAILABLE_MSG =
  'Phone OTP requires a development build. Expo Go cannot ship native Firebase. ' +
  'Run: eas build --profile development -p android, then install the APK on your phone.'

/**
 * Start an OTP flow for a 10-digit Indian phone number.
 * Throws if the native module is missing (Expo Go / web).
 */
export const startPhoneOtp = async (phone: string): Promise<PhoneOtpSession> => {
  if (!isNativePhoneAuthAvailable()) {
    throw new Error(NATIVE_UNAVAILABLE_MSG)
  }
  const rnAuthMod = getRnAuth()!
  let confirmation = await rnAuthMod().signInWithPhoneNumber(`+91${phone}`)
  setPendingConfirmation(confirmation)

  const session: PhoneOtpSession = {
    kind: 'firebase',
    phone,
    async confirm(otp: string): Promise<PhoneOtpResult> {
      const userCredential = await confirmation.confirm(otp)
      const idToken = await userCredential.user.getIdToken()
      clearPendingConfirmation()
      clearActivePhoneSession()
      return { kind: 'firebase', idToken, firebaseUser: userCredential.user }
    },
    async resend() {
      confirmation = await rnAuthMod().signInWithPhoneNumber(`+91${phone}`)
      setPendingConfirmation(confirmation)
    },
  }
  activeSession = session
  return session
}
