import { Request, Response, NextFunction } from 'express'
import { sendError } from '@/utils/response'

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
 * Global error handler — must be registered last in Express middleware chain
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode)
    return
  }

  // Prisma known errors
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
  }

  console.error('❌ Unhandled error:', err)
  sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500)
}
