/**
 * Razorpay Payment Service — P1 / P9.
 *
 * Real INR money flow for:
 *   - Loan disbursement (lender → borrower)
 *   - EMI repayment (borrower → lender)
 *
 * Modes:
 *   - DEMO_MODE=true            → all calls return mocked success
 *   - RAZORPAY_KEY_ID + SECRET  → calls Razorpay test/live API
 *
 * Security:
 *   - Webhook signature verified via HMAC-SHA256 (X-Razorpay-Signature header)
 *   - Idempotency via DB-backed payment record (no double-charge)
 *
 * Mounting:
 *   POST /api/v1/payment/order        — create order before checkout
 *   POST /api/v1/payment/verify       — verify client-side payment signature
 *   POST /api/v1/payment/webhook      — Razorpay → our server (raw body required)
 */

import crypto from 'crypto'
import axios, { AxiosInstance } from 'axios'
import { AppError } from '@/middleware/error.middleware'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getSecret } from '@/lib/secrets'

const DEMO_MODE = process.env.DEMO_MODE === 'true'

let httpClient: AxiosInstance | null = null

async function getClient(): Promise<AxiosInstance> {
  if (httpClient) return httpClient
  const keyId = await getSecret('RAZORPAY_KEY_ID')
  const keySecret = await getSecret('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) {
    throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'Razorpay credentials not configured')
  }
  httpClient = axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: { username: keyId, password: keySecret },
    timeout: 10_000,
  })
  return httpClient
}

// ─── 1. Create Order ─────────────────────────────────────────

export interface CreateOrderInput {
  /** Amount in INR paise (e.g. ₹100 → 10000) */
  amountPaise: number
  /** 'loan-emi' | 'loan-disbursal' | 'shg-contribution' */
  purpose: string
  /** ID of the loan/repayment this order is paying for */
  refType: string
  refId: string
  userId: string
}

export interface CreateOrderResult {
  orderId: string
  amountPaise: number
  currency: 'INR'
  keyId: string
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (input.amountPaise <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'amount must be > 0')

  if (DEMO_MODE) {
    const orderId = `order_demo_${Date.now()}`
    await persistOrder({ ...input, orderId, status: 'CREATED' })
    return { orderId, amountPaise: input.amountPaise, currency: 'INR', keyId: 'rzp_test_DEMO' }
  }

  const client = await getClient()
  const keyId = (await getSecret('RAZORPAY_KEY_ID'))!

  const { data } = await client.post('/orders', {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: `${input.refType}-${input.refId}`.slice(0, 40),
    notes: { purpose: input.purpose, userId: input.userId, refType: input.refType, refId: input.refId },
  })

  await persistOrder({ ...input, orderId: data.id, status: 'CREATED' })
  return { orderId: data.id, amountPaise: input.amountPaise, currency: 'INR', keyId }
}

// ─── 2. Verify Client-Side Payment ────────────────────────────

export interface VerifyPaymentInput {
  orderId: string
  paymentId: string
  signature: string
}

/**
 * Called from mobile after Razorpay Checkout returns success.
 * Verifies the signature so an attacker can't forge a "paid" status.
 */
export async function verifyPayment(input: VerifyPaymentInput): Promise<boolean> {
  if (DEMO_MODE) {
    await markPaid(input.orderId, input.paymentId)
    return true
  }

  const keySecret = (await getSecret('RAZORPAY_KEY_SECRET'))!
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature))) {
    logger.warn({ orderId: input.orderId }, 'Razorpay signature mismatch')
    return false
  }

  await markPaid(input.orderId, input.paymentId)
  return true
}

// ─── 3. Webhook Verification ─────────────────────────────────

/**
 * Verify Razorpay webhook signature. Webhook body is a STRING (raw body),
 * NOT parsed JSON — Express must use express.raw() on this route.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
  const webhookSecret = await getSecret('RAZORPAY_WEBHOOK_SECRET')
  if (!webhookSecret) {
    logger.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook')
    return false
  }
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

/**
 * Process a verified webhook event. Idempotent — safe to call multiple times.
 */
export async function handleWebhookEvent(event: {
  event: string
  payload: { payment?: { entity: { id: string; order_id: string; status: string } } }
}): Promise<void> {
  const payment = event.payload.payment?.entity
  if (!payment) return

  switch (event.event) {
    case 'payment.captured':
      await markPaid(payment.order_id, payment.id)
      break
    case 'payment.failed':
      await markFailed(payment.order_id, payment.id)
      break
    default:
      logger.info({ event: event.event }, 'Razorpay webhook event ignored')
  }
}

// ─── DB persistence helpers ──────────────────────────────────

async function persistOrder(args: {
  orderId: string
  amountPaise: number
  purpose: string
  refType: string
  refId: string
  userId: string
  status: string
}): Promise<void> {
  await prisma.paymentOrder.create({
    data: {
      razorpayOrderId: args.orderId,
      userId:          args.userId,
      amountPaise:     args.amountPaise,
      purpose:         args.purpose,
      refType:         args.refType,
      refId:           args.refId,
      status:          'CREATED',
    },
  })
  logger.info({ orderId: args.orderId }, 'PaymentOrder created')
}

async function markPaid(orderId: string, paymentId: string): Promise<void> {
  await prisma.paymentOrder.update({
    where: { razorpayOrderId: orderId },
    data: {
      status:            'CAPTURED',
      razorpayPaymentId: paymentId,
      capturedAt:        new Date(),
    },
  })
  logger.info({ orderId, paymentId }, 'PaymentOrder captured')
}

async function markFailed(orderId: string, paymentId: string): Promise<void> {
  await prisma.paymentOrder.update({
    where:  { razorpayOrderId: orderId },
    data: {
      status:            'FAILED',
      razorpayPaymentId: paymentId,
      failureReason:     'Razorpay capture failed',
    },
  }).catch(() => { /* order may not exist if webhook arrives before order create — ignore */ })
  logger.warn({ orderId, paymentId }, 'PaymentOrder failed')
}
