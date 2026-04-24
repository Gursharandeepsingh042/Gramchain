import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { Platform, Alert } from 'react-native'
import { logger } from '@/utils/logger'

// Replace with localhost when running locally and EXPO is on actual device. Tunneling recommended.
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api/v1'; // Default emulator IP
  return 'http://localhost:3000/api/v1';
}

const baseURL = getBaseUrl()

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

logger.info(`API Service initialized with baseURL: ${baseURL}`)

// Request interceptor: add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    logger.error('API Request Error:', error.message)
    return Promise.reject(error)
  }
)

// Response interceptor: handle token expiration and global errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle 401 Unauthorized (Token expired/Invalid)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const currentRefreshToken = useAuthStore.getState().refreshToken

      if (currentRefreshToken) {
        try {
          logger.info('Attempting to refresh access token...')
          const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken: currentRefreshToken })
          const { accessToken, refreshToken: newRefreshToken, user } = res.data.data
          
          // Update store
          useAuthStore.getState().setAuth(accessToken, newRefreshToken, user)
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch (refreshError) {
          logger.error('Token refresh failed. Logging out...')
          useAuthStore.getState().logout()
          Alert.alert('Session Expired', 'Please login again to continue.')
          return Promise.reject(refreshError)
        }
      } else {
        useAuthStore.getState().logout()
      }
    }

    // Standardize error logging
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN_METHOD'
    const url = error.config?.url || 'UNKNOWN_URL'
    logger.error(`API [${method}] ${url}:`, error.response?.data || error.message)

    return Promise.reject(error)
  }
)

export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  loginWithPassword: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { phone: string; name: string; email: string; password?: string }) => 
    api.post('/auth/register', data),
  googleSignIn: (idToken: string) => api.post('/auth/google', { idToken }),
  getMe: () => api.get('/auth/me'),
}

export const loanApi = {
  getMyLoans: () => api.get('/loan/my'),
  applyLoan: (data: { shgId: string; amount: string; tenureMonths: number; purpose: string }) =>
    api.post('/loan/apply', data),
  repayLoan: (loanId: string) => api.post(`/loan/${loanId}/repay`),
}

export const shgApi = {
  getMyGroups: () => api.get('/shg/my'),
  createGroup: (data: any) => api.post('/shg', data),
}

export const kycApi = {
  verifyPan: (pan: string) => api.post('/kyc/pan/verify', { pan }),
  sendAadhaarOtp: (aadhaar: string) => api.post('/kyc/aadhaar/send-otp', { aadhaar }),
  verifyAadhaarOtp: (referenceId: string, otp: string, aadhaar: string) => 
    api.post('/kyc/aadhaar/verify', { referenceId, otp, aadhaar }),
}

export const lenderApi = {
  getPortfolio: () => api.get('/lender/portfolio'),
  getAvailablePools: (params?: { tier?: string; state?: string }) =>
    api.get('/lender/pools', { params }),
  fundPool: (poolId: string, amount: number) =>
    api.post(`/lender/pools/${poolId}/fund`, { amount }),
  getImpactMetrics: () => api.get('/lender/impact'),
  getTransactions: () => api.get('/lender/transactions'),
}
