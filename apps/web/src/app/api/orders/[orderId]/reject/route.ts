import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId } = params
    const { reason } = await request.json().catch(() => ({ reason: '' }))

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.shop.ownerId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const rejectable = ['AWAITING_APPROVAL', 'PAYMENT_CONFIRMED', 'QUEUED']
    if (!rejectable.includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be rejected in its current state' }, { status: 400 })
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        rejectionReason: reason || 'Rejected by shop owner',
        cancelledAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: auth.id,
        shopId: order.shopId,
        orderId,
        action: 'ORDER_STATUS_CHANGED',
        details: { from: order.status, to: 'CANCELLED', reason },
      },
    })

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('[ORDER REJECT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

