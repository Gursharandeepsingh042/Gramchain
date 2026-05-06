import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { sendError } from '@/utils/response'
import { logger } from '@/lib/logger'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Global error handler — must be registered last in Express middleware chain.
 *
 * FIX: Added ZodError handling so validation failures return clean 400 responses
 * instead of crashing with 500 "unexpected error" messages.
 * Also added structured logging for all unhandled errors.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // ── App-level business logic errors ─────────────────────────
  if (err instanceof AppError) {
    logger.warn({ code: err.code, path: req.path, status: err.statusCode }, err.message)
    sendError(res, err.code, err.message, err.statusCode)
    return
  }

  // ── Zod validation errors ───────────────────────────────────
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0]
    const message = firstIssue
      ? `Validation error on field '${firstIssue.path.join('.')}': ${firstIssue.message}`
      : 'Validation error'
    logger.warn({ path: req.path, issues: err.issues }, 'Request validation failed')
    sendError(res, 'VALIDATION_ERROR', message, 400)
    return
  }

  // ── Prisma known errors ─────────────────────────────────────
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any
    if (prismaErr.code === 'P2002') {
      sendError(res, 'DUPLICATE_ENTRY', 'A record with this data already exists', 409)
      return
    }
    if (prismaErr.code === 'P2025') {
      sendError(res, 'NOT_FOUND', 'Record not found', 404)
      return
    }
    if (prismaErr.code === 'P2003') {
      sendError(res, 'FOREIGN_KEY_CONSTRAINT', 'Related record not found', 400)
      return
    }
  }

  // ── Unexpected errors ────────────────────────────────────────
  logger.error({ err, path: req.path, method: req.method }, '❌ Unhandled error')
  sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500)
}
