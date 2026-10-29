import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getSignedUrl } from '@/lib/storage'

// GET /api/connector/jobs — long-poll for pending print jobs
export async function GET(request: NextRequest) {
  try {
    // Connector auth via Bearer token or shop auth
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Find pending jobs for this shop
    const jobs = await prisma.printJob.findMany({
      where: {
        order: { shopId: shop.id },
        status: { in: ['PENDING'] },
        attempts: { lt: 3 },
      },
      include: {
        order: {
          include: {
            orderFiles: {
              include: { printSettings: true },
            },
          },
        },
        printer: true,
      },
      take: 5,
    })

    // Generate signed URLs for each job's files
    const jobsWithUrls = await Promise.all(
      jobs.map(async (job) => {
        const filesWithUrls = await Promise.all(
          job.order.orderFiles.map(async (file) => {
            const url = await getSignedUrl(file.storageKey, 900) // 15 min
            return {
              fileId: file.id,
              originalName: file.originalName,
              pageCount: file.pageCount,
              downloadUrl: url,
              printSettings: file.printSettings,
            }
          })
        )

        // Mark as DOWNLOADING
        await prisma.printJob.update({
          where: { id: job.id },
          data: { status: 'DOWNLOADING', attempts: job.attempts + 1, assignedAt: new Date() },
        })

        return {
          jobId: job.id,
          orderId: job.orderId,
          orderNumber: job.order.orderNumber,
          idempotencyKey: job.idempotencyKey,
          printerName: job.printer?.systemName ?? null,
          files: filesWithUrls,
        }
      })
    )

    return NextResponse.json({ jobs: jobsWithUrls })
  } catch (error) {
    console.error('[CONNECTOR JOBS]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

