import 'react-native-get-random-values'
import '@ethersproject/shims'
import { ethers, Wallet } from 'ethers'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

const WALLET_KEY = 'gramchain_secure_wallet_key'

export const createWallet = async (): Promise<string> => {
  const wallet = Wallet.createRandom()

  // In production, encrypt this with a PIN/Biometric-derived key
  // For Expo Demo, we store it in SecureStore directly
  await SecureStore.setItemAsync(WALLET_KEY, wallet.privateKey)
  await SecureStore.setItemAsync(`${WALLET_KEY}_address`, wallet.address)
  
  return wallet.address
}

export const getAddress = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(`${WALLET_KEY}_address`)
}

export const getWallet = async (): Promise<Wallet | null> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled = await LocalAuthentication.isEnrolledAsync()

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Wallet',
        fallbackLabel: 'Use PIN',
      })

      if (!result.success) {
        throw new Error('Authentication failed')
      }
    }

    const privateKey = await SecureStore.getItemAsync(WALLET_KEY)
    if (!privateKey) return null

    const provider = new ethers.JsonRpcProvider(
      process.env.EXPO_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology'
    )
    return new Wallet(privateKey, provider)
  } catch (err) {
    console.error('Wallet access error:', err)
    return null
  }
}

export const hasWallet = async (): Promise<boolean> => {
  const pk = await SecureStore.getItemAsync(WALLET_KEY)
  return !!pk
}

export const clearWallet = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(WALLET_KEY)
}
