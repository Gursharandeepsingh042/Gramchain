import Constants from 'expo-constants'
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { Platform, Alert } from 'react-native'
import { logger } from '@/utils/logger'

// Replace with localhost when running locally and EXPO is on actual device. 
// Uses auto-detection via Constants.expoConfig.hostUri for zero-config dev.
const getBaseUrl = () => {
  // If production URL is provided and doesn't look like a local IP, use it
  if (process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_API_URL.includes('192.168')) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // AUTO-DETECT Backend IP (Uses the machine running Metro)
  // hostUri typically looks like "192.168.x.x:8081"
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const ip = debuggerHost?.split(':').shift();

  if (ip) {
    return `http://${ip}:3000/api/v1`;
  }

  // Fallback to localhost or emulator IP
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api/v1'; 
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
  // NOTE: /auth/send-otp and /auth/verify-otp are deprecated on the backend (returns 410
  // unless DEMO_MODE). Real OTP delivery is handled by Firebase Phone Auth on the client;
  // verification goes through /auth/firebase below.
  loginWithPassword: (identifier: string, password: string) => api.post('/auth/login', { identifier, password }),
  register: (data: { phone: string; name: string; email: string; password?: string }) => 
    api.post('/auth/register', data),
  googleSignIn: (idToken: string) => api.post('/auth/google', { idToken }),
  verifyFirebase: (idToken: string, name?: string, groupCode?: string, password?: string, role?: 'BORROWER' | 'LENDER') =>
    api.post('/auth/firebase', { idToken, name, groupCode, password, role }),
  checkPhone: (phone: string) => api.get<{ data: { exists: boolean; hasName: boolean } }>(`/auth/check-phone?phone=${phone}`),
  setPassword: (password: string) => api.post('/auth/set-password', { password }),
  getMe: () => api.get('/auth/me'),
  /** N1: Server-side logout — invalidates refresh tokens & clears FCM token. */
  logout: () => api.post('/auth/logout'),
}

export const loanApi = {
  getMyLoans: () => api.get('/loan/my'),
  applyLoan: (data: { shgId: string; amount: string; tenureMonths: number; purpose: string }) =>
    api.post('/loan/apply', data),
  approveLoan: (loanId: string) => api.post(`/loan/${loanId}/approve`),
  repayLoan: (loanId: string) => api.post(`/loan/${loanId}/repay`),
  /** M4: Fetch ML credit score before applying. Pass refresh=true to bypass 24h cache. */
  getCreditScore: (params: { shgId: string; amount: number; refresh?: boolean }) =>
    api.get('/loan/credit-score', { params }),
}

/** Razorpay payment endpoints (P1) */
export const paymentApi = {
  createOrder: (data: {
    amountPaise: number
    purpose: 'loan-emi' | 'loan-disbursal' | 'shg-contribution'
    refType: string
    refId: string
  }) => api.post('/payment/order', data),
  verifyPayment: (data: { orderId: string; paymentId: string; signature: string }) =>
    api.post('/payment/verify', data),
}

export const shgApi = {
  getMyGroups: () => api.get('/shg/my'),
  createGroup: (data: any) => api.post('/shg', data),
  joinGroup: (shgId: string) => api.post(`/shg/${shgId}/join`),
  joinByCode: (inviteCode: string) => api.post('/shg/join-by-code', { inviteCode }),
  generateInvite: (shgId: string) => api.post(`/shg/${shgId}/invite`),
  removeMember:     (shgId: string, userId: string) => api.delete(`/shg/${shgId}/members/${userId}`),
  initiateDissolve: (shgId: string) => api.post(`/shg/${shgId}/dissolve`),
  voteDissolve:     (shgId: string, vote: boolean) => api.post(`/shg/${shgId}/dissolve/vote`, { vote }),
  getDissolveStatus:(shgId: string) => api.get(`/shg/${shgId}/dissolve`),
}

export const notificationApi = {
  getAll: (skip = 0) => api.get(`/notifications?skip=${skip}`),
  markOneRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read'),
}

export const kycApi = {
  verifyPan: (pan: string, dob?: string) => api.post('/kyc/pan/verify', { pan, dob }),
  sendAadhaarOtp: (aadhaar: string) => api.post('/kyc/aadhaar/send-otp', { aadhaar }),
  verifyAadhaarOtp: (referenceId: string, otp: string, aadhaar: string) => 
    api.post('/kyc/aadhaar/verify', { referenceId, otp, aadhaar }),
  completeKyc: (data: { aadhaar: string; pan: string; name: string; dob: string; gender: string; address: string }) =>
    api.post('/kyc/complete', data),
}

export const bankApi = {
  initiateLinking: (data: { bankName: string; accountNumber: string; ifsc: string }) =>
    api.post('/bank/initiate', data),
  verifyLinking: (referenceId: string, otp: string) =>
    api.post('/bank/verify', { referenceId, otp }),
  getAccounts: () => api.get('/bank/accounts'),
  deleteAccount: (id: string) => api.delete(`/bank/accounts/${id}`),
}

export const geoApi = {
  getStates: () => api.get('/geo/states'),
  getDistricts: (state: string) => api.get(`/geo/states/${encodeURIComponent(state)}/districts`),
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
