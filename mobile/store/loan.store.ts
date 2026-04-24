import { create } from 'zustand'
import { Loan } from '@/types'

interface LoanState {
  myLoans: Loan[]
  setMyLoans: (loans: Loan[]) => void
  activeLoan: Loan | null
}

export const useLoanStore = create<LoanState>((set) => ({
  myLoans: [],
  setMyLoans: (loans) =>
    set({
      myLoans: loans,
      activeLoan: loans.find((l) => l.status === 'ACTIVE') || null,
    }),
  activeLoan: null,
}))
