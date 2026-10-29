import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getSignedUrl } from '@/lib/storage'

// GET /api/orders/[orderId]
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    const auth = await getAuthUser(request)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderFiles: {
          include: { printSettings: true },
        },
        payment: true,
        printJobs: { orderBy: { createdAt: 'desc' } },
        shop: { select: { id: true, name: true, ownerId: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Auth check: shop owner can see all orders for their shop
    // Customer can see order if they know the orderId (anonymous session-based access)
    if (auth) {
      const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
      if (shop && shop.id !== order.shopId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[ORDER GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/orders/[orderId] — update status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId } = params
    const body = await request.json()
    const { status, rejectionReason } = body

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.shop.ownerId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      AWAITING_APPROVAL: ['QUEUED', 'CANCELLED'],
      QUEUED: ['PRINTING', 'CANCELLED'],
      PRINTING: ['COMPLETED', 'FAILED'],
      PAYMENT_CONFIRMED: ['AWAITING_APPROVAL', 'QUEUED'],
      FAILED: ['QUEUED', 'CANCELLED'],
    }

    const allowed = validTransitions[order.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${order.status} to ${status}` },
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
      ...(status === 'PRINTING' && { printedAt: new Date() }),
      ...(rejectionReason && { rejectionReason }),
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    // If moving to QUEUED, create a PrintJob
    if (status === 'QUEUED') {
      const defaultPrinter = await prisma.printer.findFirst({
        where: { shopId: order.shopId, isDefault: true, isActive: true },
      })

      await prisma.printJob.create({
        data: {
          orderId,
          printerId: defaultPrinter?.id ?? null,
          status: 'PENDING',
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: auth.id,
        shopId: order.shopId,
        orderId,
        action: 'ORDER_STATUS_CHANGED',
        details: { from: order.status, to: status },
      },
    })

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('[ORDER PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

