import { Redirect } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'

/**
 * Root Index — Traffic Controller
 * Redirects the user to the correct flow based on their auth state and role.
 */
export default function Index() {
  const { token, user, isKycComplete } = useAuthStore()

  if (!token) {
    // Not logged in -> go to role selection
    return <Redirect href="/role-select" />
  }

  if (user?.role === 'LENDER') {
    // Logged in as Lender -> go to lender dashboard
    return <Redirect href="/portfolio" />
  }

  // Logged in as Borrower
  if (!isKycComplete) {
    return <Redirect href="/kyc" />
  }

  return <Redirect href="/(tabs)" />
}
