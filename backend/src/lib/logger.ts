import pino from 'pino'
// Force TS re-parse

/**
 * Structured logger using pino.
 * In development: pretty-printed. In production: JSON for log aggregators.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
})
