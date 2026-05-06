/**
 * ErrorBoundary — F4
 *
 * Global error boundary for the mobile app.
 * Catches unhandled JS exceptions in the React tree,
 * shows a friendly retry screen instead of a white crash.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

interface Props {
  children: ReactNode
  /** Optional fallback component. If not provided, uses the default retry UI. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to your error reporting service (Sentry, Crashlytics, etc.)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <View style={styles.container}>
          <View style={[styles.card, shadows.sm]}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred. Please try again.
            </Text>
            {__DEV__ && this.state.error && (
              <View style={styles.debugBox}>
                <Text style={styles.debugText} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={this.handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryBtnText}>🔄 Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )
    }

    return this.props.children
  }
}

/**
 * NetworkErrorView — reusable inline error state for screens
 * that fail to load data (API timeout, no connection, etc.)
 */
export function NetworkErrorView({
  message = 'Unable to load data. Check your connection and try again.',
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  return (
    <View style={styles.networkContainer}>
      <Text style={styles.networkIcon}>📡</Text>
      <Text style={styles.networkTitle}>Connection Error</Text>
      <Text style={styles.networkMessage}>{message}</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text style={styles.retryBtnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  // ── ErrorBoundary ──
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[100],
    width: '100%',
    maxWidth: 360,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  debugBox: {
    backgroundColor: colors.gray[50],
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.danger[100] ?? colors.gray[200],
  },
  debugText: {
    fontSize: 11,
    color: colors.danger[600] ?? '#dc2626',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.button ?? 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.green,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── NetworkErrorView ──
  networkContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  networkIcon: {
    fontSize: 44,
    marginBottom: 16,
  },
  networkTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 8,
  },
  networkMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
})
