/**
 * SEC8: Input Sanitization Middleware
 *
 * Strips HTML tags and potentially dangerous characters from user-controlled
 * string fields (loan purpose, SHG name, etc.) to prevent stored XSS.
 *
 * Applied BEFORE route handlers so all req.body strings are clean.
 */

/**
 * Remove HTML tags and dangerous characters from a string.
 * Keeps alphanumeric, spaces, basic punctuation, and Unicode letters (Hindi etc).
 */
function sanitizeString(input: unknown): unknown {
  if (typeof input !== 'string') return input

  return input
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip potential script injection patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Trim excessive whitespace
    .replace(/\s{3,}/g, '  ')
    .trim()
}

/**
 * Recursively sanitize all string values in an object or array.
 */
function sanitizeDeep(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitizeString(obj)
  if (Array.isArray(obj)) return obj.map(sanitizeDeep)
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeDeep(value)
    }
    return result
  }
  return obj
}

import { Request, Response, NextFunction } from 'express'

/**
 * Express middleware that sanitizes all string values in req.body.
 * Does NOT touch req.params or req.query (those are typically used as lookups).
 */
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body) as typeof req.body
  }
  next()
}
