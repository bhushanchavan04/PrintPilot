import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper: directly dispatch print request to Wi-Fi tablet receiver
async function dispatchToTabletReceiver(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderFiles: {
          where: { isDeleted: false },
          include: { printSettings: true },
        },
      },
    })
    if (!order || !order.orderFiles.length) return

    const primaryFile = order.orderFiles[0]
    const settings = primaryFile.printSettings
    const receiverUrl = process.env.TABLET_RECEIVER_URL || 'http://localhost:8765'
    const receiverToken = process.env.TABLET_RECEIVER_TOKEN || 'myprint-tablet-2024'

    await fetch(`${receiverUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Receiver-Token': receiverToken,
      },
      body: JSON.stringify({
        orderId: order.id,
        orderNumber: order.orderNumber,
        filename: primaryFile.originalName,
        pageCount: order.totalPages || primaryFile.pageCount || 1,
        copies: settings?.copies ?? 1,
        colorMode: settings?.colorMode ?? 'BLACK_AND_WHITE',
        sides: settings?.sides ?? 'SINGLE',
        paperSize: settings?.paperSize ?? 'A4',
      }),
      // @ts-ignore
      signal: AbortSignal.timeout(2500),
    })
  } catch (err) {
    console.warn('[PAYMENT] Best-effort tablet dispatch:', err)
  }
}

// POST /api/payments/verify — verify payment and confirm order
export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentId } = await request.json()

    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, shop: true },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const payment = order.payment
    if (!payment) return NextResponse.json({ error: 'No payment found for this order' }, { status: 404 })

    if (payment.status === 'SUCCESS') {
      return NextResponse.json({ message: 'Payment already verified', order })
    }

    // Default printer lookup if any
    const defaultPrinter = await prisma.printer.findFirst({
      where: { shopId: order.shopId, isDefault: true, isActive: true },
    })

    // For MOCK, direct UPI, or CASH payment modes (0% platform commission, direct to shopkeeper)
    if (payment.isMockPayment || payment.method === 'UPI' || payment.method === 'CASH') {
      const [updatedPayment, updatedOrder] = await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            isMockPayment: payment.isMockPayment,
            webhookVerified: true,
            completedAt: new Date(),
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PRINTING', // Directly moving to PRINTING so tablet/printer acts as printer
            confirmedAt: new Date(),
          },
        }),
        prisma.printJob.create({
          data: {
            orderId,
            printerId: defaultPrinter?.id ?? null,
            status: 'PRINTING',
          },
        }),
        prisma.auditLog.create({
          data: {
            shopId: order.shopId,
            orderId,
            action: 'PAYMENT_VERIFIED',
            details: { method: payment.method, amount: payment.amount, autoDispatchedToTablet: true },
          },
        }),
      ])

      // Immediately post print job to tablet receiver over Wi-Fi
      await dispatchToTabletReceiver(orderId)

      return NextResponse.json({ order: updatedOrder, payment: updatedPayment })
    }

    // For real Razorpay — verify signature
    const crypto = await import('crypto')
    const { razorpayPaymentId, razorpaySignature } = await request.json().catch(() => ({}))

    if (razorpayPaymentId && razorpaySignature) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${payment.gatewayOrderId}|${razorpayPaymentId}`)
        .digest('hex')

      if (expectedSignature !== razorpaySignature) {
        return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 })
      }

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            gatewayPaymentId: razorpayPaymentId,
            gatewaySignature: razorpaySignature,
            webhookVerified: true,
            completedAt: new Date(),
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PRINTING',
            confirmedAt: new Date(),
          },
        }),
        prisma.printJob.create({
          data: {
            orderId,
            printerId: defaultPrinter?.id ?? null,
            status: 'PRINTING',
          },
        }),
      ])

      // Immediately post print job to tablet receiver over Wi-Fi
      await dispatchToTabletReceiver(orderId)
    }

    const finalOrder = await prisma.order.findUnique({ where: { id: orderId } })
    return NextResponse.json({ order: finalOrder })
  } catch (error: any) {
    console.error('[PAYMENT VERIFY]', error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}

