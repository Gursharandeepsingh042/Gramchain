import { Response } from 'express'

/**
 * Standard success response wrapper
 */
export const sendSuccess = <T>(res: Response, data: T, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  })

/**
 * Standard error response wrapper
 */
export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400
) =>
  res.status(statusCode).json({
    success: false,
    data: null,
    error: { code, message },
    timestamp: new Date().toISOString(),
  })
