/**
 * Production-grade logger utility for GramChain Mobile
 * Automatically suppresses logs in production builds.
 */

const isDev = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(' [LOG]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('⚠️ [WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    process.env.NODE_ENV !== 'test' && console.error('🔴 [ERROR]', ...args);
    // In production, we would integrate with Sentry/Bugsnag here
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info('ℹ️ [INFO]', ...args);
    }
  },
};
