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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.shop.ownerId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!['AWAITING_APPROVAL', 'PAYMENT_CONFIRMED'].includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be approved in its current state' }, { status: 400 })
    }

    // Move to QUEUED + create print job
    const defaultPrinter = await prisma.printer.findFirst({
      where: { shopId: order.shopId, isDefault: true, isActive: true },
    })

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'QUEUED' },
      }),
      prisma.printJob.create({
        data: {
          orderId,
          printerId: defaultPrinter?.id ?? null,
          status: 'PENDING',
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: auth.id,
          shopId: order.shopId,
          orderId,
          action: 'ORDER_STATUS_CHANGED',
          details: { from: order.status, to: 'QUEUED', triggeredBy: 'manual_approval' },
        },
      }),
    ])

    // Best-effort push to Wi-Fi tablet receiver if running
    try {
      const primaryFile = await prisma.orderFile.findFirst({
        where: { orderId, isDeleted: false },
        include: { printSettings: true },
      })
      if (primaryFile) {
        const receiverUrl = process.env.TABLET_RECEIVER_URL || 'http://localhost:8765'
        const receiverToken = process.env.TABLET_RECEIVER_TOKEN || 'myprint-tablet-2024'
        fetch(`${receiverUrl}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Receiver-Token': receiverToken,
          },
          body: JSON.stringify({
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            filename: primaryFile.originalName,
            pageCount: updatedOrder.totalPages || primaryFile.pageCount || 1,
            copies: primaryFile.printSettings?.copies ?? 1,
            colorMode: primaryFile.printSettings?.colorMode ?? 'BLACK_AND_WHITE',
            sides: primaryFile.printSettings?.sides ?? 'SINGLE',
            paperSize: primaryFile.printSettings?.paperSize ?? 'A4',
          }),
          // @ts-ignore
          signal: AbortSignal.timeout(1500),
        }).catch(() => {})
      }
    } catch {
      // Ignore if tablet receiver is offline
    }

    return NextResponse.json({ order: updatedOrder })
  } catch (error) {
    console.error('[ORDER APPROVE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

