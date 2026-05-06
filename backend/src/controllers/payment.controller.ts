import { Request, Response, NextFunction } from 'express'
import * as PaymentService from '@/services/payment.service'
import { sendSuccess, sendError } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const createOrderSchema = z.object({
  amountPaise: z.number().int().positive(),
  purpose: z.enum(['loan-emi', 'loan-disbursal', 'shg-contribution']),
  refType: z.string().min(1).max(20),
  refId: z.string().min(1).max(50),
})

const verifySchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
})

/** POST /payment/order — create Razorpay order before checkout */
export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body = createOrderSchema.parse(req.body)
    const order = await PaymentService.createOrder({ ...body, userId: req.userId! })
    sendSuccess(res, order, 201)
  } catch (err) {
    next(err)
  }
}

/** POST /payment/verify — verify client-side payment signature */
export const verifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body = verifySchema.parse(req.body)
    const ok = await PaymentService.verifyPayment(body)
    if (!ok) {
      sendError(res, 'INVALID_SIGNATURE', 'Payment signature verification failed', 400)
      return
    }
    sendSuccess(res, { verified: true })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /payment/webhook — Razorpay → server callback.
 *
 * IMPORTANT: route must be registered BEFORE express.json() OR with
 * express.raw({ type: '*\/*' }) so we can verify the signature on the
 * raw body bytes.
 */
export const webhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string
    if (!signature) {
      sendError(res, 'MISSING_SIGNATURE', 'X-Razorpay-Signature header required', 400)
      return
    }

    // req.body is a Buffer here because of express.raw()
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body)
    const verified = await PaymentService.verifyWebhookSignature(rawBody, signature)
    if (!verified) {
      logger.warn('Razorpay webhook signature mismatch — ignoring')
      sendError(res, 'INVALID_SIGNATURE', 'Webhook signature mismatch', 400)
      return
    }

    const event = JSON.parse(rawBody)
    await PaymentService.handleWebhookEvent(event)
    res.status(200).json({ received: true })
  } catch (err) {
    next(err)
  }
}
