import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storage } from '@/services/storage'
import { User } from '@/types'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isKycComplete: boolean
  kycSkipped: boolean
  hasHydrated: boolean
  setAuth: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  completeKyc: (walletAddress?: string) => void
  skipKyc: () => void
  setHasHydrated: (state: boolean) => void
}

const zustandStorage = {
  setItem: (name: string, value: string) => storage.set(name, value),
  getItem: async (name: string) => (await storage.getString(name)) ?? null,
  removeItem: (name: string) => storage.remove(name),
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isKycComplete: false,
      kycSkipped: false,
      hasHydrated: false,
      setAuth: (token, refreshToken, user) => set((state) => ({
        token,
        refreshToken,
        user,
        isKycComplete: user.kycStatus === 'VERIFIED',
        // Preserve kycSkipped only when the same user is logging back in.
        // A different user on the same device must see the KYC prompt again.
        kycSkipped: state.user?.id === user.id ? state.kycSkipped : false,
      })),
      logout: () => set({ token: null, refreshToken: null, user: null, isKycComplete: false, kycSkipped: false }),
      completeKyc: (walletAddress) => set((state) => ({
        isKycComplete: true,
        kycSkipped: false,
        user: state.user ? {
          ...state.user,
          kycStatus: 'VERIFIED',
          walletAddress: walletAddress || state.user.walletAddress
        } : null
      })),
      skipKyc: () => set({ kycSkipped: true }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
