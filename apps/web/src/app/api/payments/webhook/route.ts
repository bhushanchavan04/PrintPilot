// POST /api/payments/webhook
// Razorpay webhook endpoint.  Verifies the HMAC-SHA256 signature, then
// updates the order and payment status accordingly.
//
// SECURITY NOTE: Never trust a client-side payment-success claim.
// All payment confirmation must flow through this verified webhook or
// the server-side /api/payments/verify route.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

// Disable body parsing – we need the raw bytes for signature verification
export const dynamic = 'force-dynamic'

async function getRawBody(req: NextRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = req.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

function verifyRazorpaySignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  // In mock mode there is no real webhook – return 200 to avoid noise
  if (process.env.PAYMENT_MODE === 'mock' || !webhookSecret) {
    console.log('[Webhook] Mock mode – skipping signature verification')
    return NextResponse.json({ received: true })
  }

  const signature = req.headers.get('x-razorpay-signature') ?? ''

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing webhook signature' },
      { status: 400 }
    )
  }

  const rawBody = await getRawBody(req)

  // Verify the webhook signature
  if (!verifyRazorpaySignature(rawBody, signature, webhookSecret)) {
    console.error('[Webhook] Invalid signature – rejecting request')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody.toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const event = payload.event as string
  const entity = (payload.payload as Record<string, unknown>)

  console.log(`[Webhook] Received event: ${event}`)

  try {
    switch (event) {
      case 'payment.captured': {
        const paymentData = (entity as { payment?: { entity?: Record<string, unknown> } })
          ?.payment?.entity
        if (!paymentData) break

        const gatewayPaymentId = paymentData.id as string
        const gatewayOrderId = paymentData.order_id as string
        const amountInPaise = paymentData.amount as number

        // Find payment by gateway order ID
        const payment = await prisma.payment.findFirst({
          where: { gatewayOrderId },
          include: { order: true },
        })

        if (!payment) {
          console.error(`[Webhook] Payment not found for order: ${gatewayOrderId}`)
          break
        }

        if (payment.status === 'SUCCESS') {
          console.log(`[Webhook] Payment ${gatewayOrderId} already processed`)
          break
        }

        // Verify amount matches (tolerance for INR rounding)
        const expectedPaise = Math.round(payment.amount * 100)
        if (Math.abs(amountInPaise - expectedPaise) > 1) {
          console.error(
            `[Webhook] Amount mismatch: expected ${expectedPaise} paise, got ${amountInPaise}`
          )
          break
        }

        // Update payment and order in a transaction
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCESS',
              gatewayPaymentId,
              gatewayResponse: paymentData as object,
              webhookVerified: true,
              webhookReceivedAt: new Date(),
              completedAt: new Date(),
            },
          })

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: 'PAYMENT_CONFIRMED',
              confirmedAt: new Date(),
            },
          })

          await tx.auditLog.create({
            data: {
              shopId: payment.order.shopId,
              orderId: payment.orderId,
              action: 'PAYMENT_VERIFIED',
              details: {
                source: 'webhook',
                event,
                gatewayPaymentId,
                gatewayOrderId,
              },
            },
          })
        })

        console.log(`[Webhook] Payment captured for order ${payment.orderId}`)
        break
      }

      case 'payment.failed': {
        const paymentData = (entity as { payment?: { entity?: Record<string, unknown> } })
          ?.payment?.entity
        if (!paymentData) break

        const gatewayOrderId = paymentData.order_id as string
        const errorDescription = paymentData.error_description as string

        const payment = await prisma.payment.findFirst({
          where: { gatewayOrderId },
        })

        if (!payment || payment.status === 'FAILED') break

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failureReason: errorDescription,
            webhookVerified: true,
            webhookReceivedAt: new Date(),
          },
        })

        console.log(`[Webhook] Payment failed for order ${payment.orderId}`)
        break
      }

      case 'refund.created':
      case 'refund.processed': {
        // Handle refund status updates
        const refundData = (entity as { refund?: { entity?: Record<string, unknown> } })
          ?.refund?.entity
        if (!refundData) break

        const gatewayRefundId = refundData.id as string
        const refundStatus = refundData.status as string

        const refund = await prisma.refund.findFirst({
          where: { gatewayRefundId },
        })

        if (refund) {
          await prisma.refund.update({
            where: { id: refund.id },
            data: {
              status: refundStatus === 'processed' ? 'SUCCESS' : 'PENDING',
              processedAt: refundStatus === 'processed' ? new Date() : undefined,
            },
          })
        }
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event}`)
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err)
    // Return 200 to prevent Razorpay from retrying endlessly for processing errors
    // Log the error for manual investigation
  }

  // Always return 200 to Razorpay to acknowledge receipt
  return NextResponse.json({ received: true })
}

