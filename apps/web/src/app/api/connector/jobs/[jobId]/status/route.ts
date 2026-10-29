import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { jobId } = params
    const { status, error: jobError } = await request.json()

    const job = await prisma.printJob.findUnique({
      where: { id: jobId },
      include: { order: { include: { shop: true } } },
    })

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.order.shop.ownerId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updateData: any = { status }

    if (status === 'SUBMITTED_TO_QUEUE') {
      updateData.submittedAt = new Date()
      // Update order to PRINTING
      await prisma.order.update({
        where: { id: job.orderId },
        data: { status: 'PRINTING', printedAt: new Date() },
      })
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date()
      // IMPORTANT: COMPLETED here means submitted to OS queue, not necessarily physically printed.
      // The order remains in PRINTING state. Physical completion requires operator confirmation.
      await prisma.auditLog.create({
        data: {
          shopId: job.order.shopId,
          orderId: job.orderId,
          action: 'PRINT_JOB_COMPLETED',
          details: { jobId, note: 'Submitted to OS print queue. Physical output not verified.' },
        },
      })
    } else if (status === 'FAILED') {
      updateData.failedAt = new Date()
      updateData.lastError = jobError ?? 'Unknown error'

      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached — mark order as failed
        await prisma.order.update({
          where: { id: job.orderId },
          data: { status: 'FAILED' },
        })
        await prisma.auditLog.create({
          data: {
            shopId: job.order.shopId,
            orderId: job.orderId,
            action: 'PRINT_JOB_FAILED',
            details: { jobId, attempts: job.attempts, error: jobError },
          },
        })
      } else {
        // Requeue for retry
        updateData.status = 'PENDING'
        updateData.failedAt = null
      }
    }

    const updated = await prisma.printJob.update({
      where: { id: jobId },
      data: updateData,
    })

    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error('[JOB STATUS UPDATE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

