export interface User {
  id: string
  phone: string
  name: string | null
  email?: string | null
  aadhaarHash: string | null
  walletAddress: string | null
  kycStatus: 'PENDING' | 'VERIFIED' | 'FAILED'
  role?: 'BORROWER' | 'LENDER'
  createdAt: string
  updatedAt: string
}

export interface SHGGroup {
  id: string
  name: string
  district: string
  state: string
  village: string | null
  poolContractAddress: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface Loan {
  id: string
  memberId: string
  shgId: string
  amount: number
  interestRateBps: number
  tenureMonths: number
  purpose: string | null
  mlScore: number | null
  mlRiskBand: string | null
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REPAID' | 'DEFAULTED'
  contractLoanId: number | null
  disbursedAt: string | null
  txHash: string | null
  nextEmiDue: string | null
  emiAmount: number | null
  createdAt: string
  updatedAt: string
}

export interface Repayment {
  id: string
  loanId: string
  amount: number
  paidAt: string
  txHash: string
  status: 'CONFIRMED' | 'FAILED'
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}
