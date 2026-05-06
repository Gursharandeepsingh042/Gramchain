import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storage } from '@/services/storage'
import { User } from '@/types'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isKycComplete: boolean
  setAuth: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  completeKyc: (walletAddress?: string) => void
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
      setAuth: (token, refreshToken, user) => set({ 
        token, 
        refreshToken, 
        user, 
        isKycComplete: user.kycStatus === 'VERIFIED' 
      }),
      logout: () => set({ token: null, refreshToken: null, user: null, isKycComplete: false }),
      completeKyc: (walletAddress) => set((state) => ({ 
        isKycComplete: true,
        user: state.user ? {
          ...state.user,
          kycStatus: 'VERIFIED',
          walletAddress: walletAddress || state.user.walletAddress
        } : null
      })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
)
