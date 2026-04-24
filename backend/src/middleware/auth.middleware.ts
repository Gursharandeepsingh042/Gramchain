import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '@/utils/response'

export interface AuthenticatedRequest extends Request {
  userId?: string
}

/**
 * JWT authentication middleware
 * Validates Bearer token and attaches userId to request
 */
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'Missing or invalid authorization header', 401)
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch (err) {
    sendError(res, 'TOKEN_INVALID', 'Token is invalid or expired', 401)
  }
}
