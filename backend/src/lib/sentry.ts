/**
 * Sentry observability — opt-in error + performance tracking.
 *
 * Sentry is OFF by default. To enable: set SENTRY_DSN in env.
 * Without DSN, all functions are no-ops (zero overhead, no SDK init).
 *
 * Why a wrapper: Sentry's SDK is a transitive dependency we don't want to
 * pull in unless the user actually wants observability. Lazy-loaded.
 */

import type { Express, Request, Response, NextFunction } from 'express'
import { logger } from './logger'

let sentryInitialized = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null

export async function initSentry(app: Express): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    logger.info('Sentry DSN not set — error tracking disabled')
    return
  }

  try {
    // Lazy-load so the SDK is only required when actually enabled.
    // @ts-expect-error — @sentry/node is an optional peer dep, install only if SENTRY_DSN is set.
    Sentry = await import('@sentry/node')
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || 'unknown',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      // Don't send PII by default
      sendDefaultPii: false,
      beforeSend(event: unknown) {
        // Drop known noisy errors
        const e = event as { exception?: { values?: Array<{ type?: string }> } }
        const type = e?.exception?.values?.[0]?.type
        if (type === 'AppError') return null // 4xx user errors — not actionable
        return event as object
      },
    })

    // Express integration
    app.use(Sentry.Handlers.requestHandler())
    app.use(Sentry.Handlers.tracingHandler())

    sentryInitialized = true
    logger.info({ env: process.env.NODE_ENV }, 'Sentry initialized')
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      'Sentry init failed — install @sentry/node to enable',
    )
  }
}

/**
 * Express error handler — must be wired AFTER routes but BEFORE the
 * project's own errorHandler middleware.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function sentryErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (sentryInitialized && Sentry) {
    Sentry.captureException(err)
  }
  next(err)
}

/** Manually capture an error from any code path. */
export function captureError(err: Error, context?: Record<string, unknown>): void {
  if (!sentryInitialized || !Sentry) return
  Sentry.withScope((scope: { setContext: (k: string, v: unknown) => void }) => {
    if (context) scope.setContext('extra', context)
    Sentry.captureException(err)
  })
}

/** Tag the current request scope with a userId for traceability. */
export function setUserContext(userId: string): void {
  if (!sentryInitialized || !Sentry) return
  Sentry.setUser({ id: userId })
}
