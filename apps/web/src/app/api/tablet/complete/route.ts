import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const RECEIVER_TOKEN = process.env.TABLET_RECEIVER_TOKEN ?? 'myprint-tablet-2024'

// POST /api/tablet/complete — called by the tablet receiver when print simulation finishes
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('X-Receiver-Token')
    if (token !== RECEIVER_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, jobId } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const now = new Date()

    // Update order to COMPLETED
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          printedAt: now,
        },
      }),
      // Complete any pending/printing print jobs
      prisma.printJob.updateMany({
        where: { orderId, status: { in: ['PENDING', 'PRINTING', 'SUBMITTED_TO_QUEUE'] } },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      }),
      // Audit log
      prisma.auditLog.create({
        data: {
          shopId: order.shopId,
          orderId: order.id,
          action: 'PRINT_JOB_COMPLETED',
          details: { source: 'tablet_receiver', tabletJobId: jobId, completedAt: now.toISOString() },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Order marked as COMPLETED and customer notified.',
      order: updatedOrder,
    })
  } catch (error: any) {
    console.error('[TABLET COMPLETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

