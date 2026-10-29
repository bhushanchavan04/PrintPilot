import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { orderId, method = 'MOCK' } = await request.json()

    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.payment) {
      return NextResponse.json({ error: 'Payment already initiated for this order' }, { status: 409 })
    }

    if (method === 'UPI' || method === 'CASH' || method === 'MOCK' || !process.env.RAZORPAY_KEY_ID) {
      // Direct shopkeeper payment or mock mode
      const payment = await prisma.payment.create({
        data: {
          orderId,
          method,
          status: 'INITIATED',
          amount: order.totalAmount,
          isMockPayment: method === 'MOCK',
          initiatedAt: new Date(),
        },
      })

      return NextResponse.json({
        paymentId: payment.id,
        method,
        amount: order.totalAmount,
        isMock: method === 'MOCK',
        message:
          method === 'UPI'
            ? 'Direct UPI payment to shopkeeper'
            : method === 'CASH'
            ? 'Pay cash at counter'
            : 'Development mode — no real payment will be charged',
      })
    }

    // Razorpay integration
    let RazorpayClass: any
    try {
      // @ts-ignore
      const rzpMod = await import('razorpay')
      RazorpayClass = rzpMod.default || rzpMod
    } catch {
      return NextResponse.json(
        { error: 'Razorpay package not installed. Run in mock mode or install razorpay.' },
        { status: 501 }
      )
    }

    const razorpay = new RazorpayClass({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(order.totalAmount * 100), // paise
      currency: 'INR',
      receipt: order.orderNumber,
    })

    const payment = await prisma.payment.create({
      data: {
        orderId,
        method: 'UPI',
        status: 'INITIATED',
        amount: order.totalAmount,
        gatewayOrderId: rzpOrder.id,
        isMockPayment: false,
        initiatedAt: new Date(),
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      gatewayOrderId: rzpOrder.id,
      amount: order.totalAmount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      method: 'RAZORPAY',
    })
  } catch (error: any) {
    console.error('[PAYMENT INITIATE]', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}

