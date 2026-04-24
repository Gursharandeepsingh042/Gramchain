# GramChain — Frontend Engineering Skill Guide
**Stack:** React Native + Expo + TypeScript

---

## 1. Core Philosophy

- **Offline-first:** Assume no internet. Write to local SQLite first, sync later.
- **Hindi-native:** Every string goes through i18n. No hardcoded English text.
- **Accessible:** Every touchable has `accessibilityLabel`. Support screen readers.
- **Type-safe:** `strict: true` in tsconfig. No `any`. Use Zod for API response parsing.

---

## 2. Project Bootstrap

```bash
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
npx expo install expo-router expo-sqlite expo-secure-store expo-local-authentication
npm install nativewind zustand @tanstack/react-query axios ethers i18next react-i18next
npm install @react-native-mmkv mmkv
npx expo install expo-notifications expo-camera expo-file-system
```

**Configure NativeWind:**
```js
// babel.config.js
module.exports = { presets: ['babel-preset-expo'], plugins: ['nativewind/babel'] }
// tailwind.config.js
module.exports = { content: ['./app/**/*.tsx', './components/**/*.tsx'] }
```

---

## 3. State Management

Use **Zustand** for global client state, **React Query** for server state.

```ts
// store/auth.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { storage } from '@/services/storage'

interface AuthState {
  token: string | null
  user: User | null
  isKycComplete: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isKycComplete: false,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth', storage: createJSONStorage(() => storage) }
  )
)
```

```ts
// hooks/useLoan.ts — React Query example
import { useQuery, useMutation } from '@tanstack/react-query'
import { loanApi } from '@/services/api'

export const useMyLoans = () =>
  useQuery({ queryKey: ['loans', 'my'], queryFn: loanApi.getMyLoans })

export const useApplyLoan = () =>
  useMutation({
    mutationFn: loanApi.applyLoan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  })
```

---

## 4. Offline Queue Pattern

```ts
// services/offlineQueue.ts
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabase('gramchain.db')

export interface QueuedAction {
  id: string
  type: 'LOAN_APPLY' | 'EMI_REPAY' | 'MEETING_LOG'
  payload: string // JSON
  createdAt: number
  retries: number
}

export const enqueueAction = async (action: Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>) => {
  return new Promise<void>((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT INTO offline_queue (id, type, payload, created_at, retries) VALUES (?, ?, ?, ?, 0)',
        [crypto.randomUUID(), action.type, action.payload, Date.now()],
        () => resolve(),
        (_, err) => { reject(err); return false }
      )
    })
  })
}

export const processQueue = async () => {
  // Called when connectivity restored (via NetInfo event)
  const pending = await getPendingActions()
  for (const action of pending) {
    try {
      await dispatchAction(action)
      await markComplete(action.id)
    } catch {
      await incrementRetry(action.id)
    }
  }
}
```

---

## 5. Wallet & Blockchain Integration

```ts
// services/wallet.ts
import { ethers } from 'ethers'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

export const createWallet = async (): Promise<string> => {
  const wallet = ethers.Wallet.createRandom()
  // Encrypt private key before storage
  const encrypted = encryptWithDeviceKey(wallet.privateKey)
  await SecureStore.setItemAsync('wallet_encrypted', encrypted)
  return wallet.address
}

export const getWallet = async (): Promise<ethers.Wallet> => {
  await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm identity' })
  const encrypted = await SecureStore.getItemAsync('wallet_encrypted')
  const privateKey = decryptWithDeviceKey(encrypted!)
  const provider = new ethers.JsonRpcProvider(process.env.EXPO_PUBLIC_RPC_URL)
  return new ethers.Wallet(privateKey, provider)
}

// services/blockchain.ts — Contract interaction
import { Contract, parseUnits } from 'ethers'
import LOAN_MANAGER_ABI from '@/constants/abis/LoanManager.json'

export const repayEMI = async (loanId: number, amount: string) => {
  const wallet = await getWallet()
  const contract = new Contract(
    process.env.EXPO_PUBLIC_LOAN_MANAGER_ADDRESS!,
    LOAN_MANAGER_ABI,
    wallet
  )
  // First approve USDC spend
  const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, wallet)
  await usdc.approve(contract.target, parseUnits(amount, 6))
  // Then repay
  const tx = await contract.repayEMI(loanId)
  return tx.wait()
}
```

---

## 6. TFLite ML Inference

```ts
// services/ml.ts
import { bundleResourceIO } from '@tensorflow/tfjs-react-native'
import * as tf from '@tensorflow/tfjs'

let model: tf.GraphModel | null = null

export const loadModel = async () => {
  if (model) return model
  await tf.ready()
  const modelJson = require('@/assets/models/credit_score.tflite')
  // Use TFLite delegate via expo-tensorflow-lite
  model = await tf.loadGraphModel(bundleResourceIO(modelJson, []))
  return model
}

export const predictCreditScore = async (features: CreditFeatures): Promise<number> => {
  const m = await loadModel()
  const input = tf.tensor2d([featuresToArray(features)])
  const output = m.predict(input) as tf.Tensor
  const [probability] = await output.data()
  // Convert default probability to credit score (inverse)
  return Math.round(300 + (1 - probability) * 600)
}
```

---

## 7. Internationalization

```ts
// i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import hi from './hi.json'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: 'hi',       // default Hindi
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})
```

```json
// i18n/hi.json (sample)
{
  "dashboard": {
    "greeting": "नमस्ते, {{name}}",
    "activeLoans": "सक्रिय ऋण",
    "nextEmi": "अगली EMI: {{date}}"
  },
  "loan": {
    "apply": "ऋण के लिए आवेदन करें",
    "amount": "राशि (₹)",
    "score": "आपका क्रेडिट स्कोर"
  }
}
```

---

## 8. Component Standards

```tsx
// components/ui/LoanCard.tsx — Example component
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Loan } from '@/types'

interface Props {
  loan: Loan
  onRepay: (id: number) => void
}

export const LoanCard = ({ loan, onRepay }: Props) => {
  const { t } = useTranslation()
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm mb-3">
      <Text className="text-lg font-semibold text-gray-900">
        ₹{loan.principal.toLocaleString('en-IN')}
      </Text>
      <Text className="text-sm text-gray-500 mt-1">
        {t('loan.nextEmi', { date: formatDate(loan.nextEmiDue) })}
      </Text>
      <TouchableOpacity
        className="bg-green-600 rounded-xl py-3 mt-4"
        onPress={() => onRepay(loan.id)}
        accessibilityLabel={t('loan.repayButton')}
        accessibilityRole="button"
      >
        <Text className="text-white text-center font-semibold">
          {t('loan.payNow')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
```

---

## 9. Testing Standards

```bash
# Unit test components
npm install --save-dev jest @testing-library/react-native jest-expo

# Run tests
npx jest --coverage
```

```ts
// __tests__/LoanCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native'
import { LoanCard } from '@/components/ui/LoanCard'

it('calls onRepay with correct loan id', () => {
  const mockRepay = jest.fn()
  const { getByRole } = render(
    <LoanCard loan={mockLoan} onRepay={mockRepay} />
  )
  fireEvent.press(getByRole('button'))
  expect(mockRepay).toHaveBeenCalledWith(mockLoan.id)
})
```

---

## 10. Build & Release

```bash
# Development
npx expo start --tunnel   # For physical device testing

# Production build (EAS)
npm install -g eas-cli
eas login
eas build --platform android --profile preview  # APK for demo
eas build --platform all --profile production   # Store build
```

```json
// eas.json
{
  "build": {
    "preview": { "android": { "buildType": "apk" } },
    "production": { "autoIncrement": true }
  }
}
```
