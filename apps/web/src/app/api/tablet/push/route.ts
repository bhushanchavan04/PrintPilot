import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const RECEIVER_URL = process.env.TABLET_RECEIVER_URL ?? 'http://localhost:8765'
const RECEIVER_TOKEN = process.env.TABLET_RECEIVER_TOKEN ?? 'myprint-tablet-2024'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    // Fetch order with files + settings
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shop: true,
        orderFiles: {
          where: { isDeleted: false },
          include: { printSettings: true },
        },
      },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.shop.ownerId !== auth.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Pick the first file for preview metadata
    const primaryFile = order.orderFiles[0]
    if (!primaryFile) return NextResponse.json({ error: 'Order has no files' }, { status: 400 })

    const settings = primaryFile.printSettings
    const totalPages = order.orderFiles.reduce((sum, f) => sum + (f.pageCount || 0), 0)

    const jobPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      filename: primaryFile.originalName,
      pageCount: totalPages,
      copies: settings?.copies ?? 1,
      colorMode: settings?.colorMode ?? 'BLACK_AND_WHITE',
      sides: settings?.sides ?? 'SINGLE',
      paperSize: settings?.paperSize ?? 'A4',
      // No signed URL sent to tablet – just metadata for the preview card
      previewUrl: '',
    }

    // Forward to the local Python receiver
    let receiverRes: Response
    try {
      receiverRes = await fetch(`${RECEIVER_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Receiver-Token': RECEIVER_TOKEN,
        },
        body: JSON.stringify(jobPayload),
        // @ts-ignore – Node fetch signal
        signal: AbortSignal.timeout(5000),
      })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Cannot reach tablet receiver at ${RECEIVER_URL}. Is it running?` },
        { status: 503 }
      )
    }

    if (!receiverRes.ok) {
      const text = await receiverRes.text()
      return NextResponse.json({ error: `Receiver error: ${text}` }, { status: 502 })
    }

    const result = await receiverRes.json()

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: auth.id,
        shopId: order.shopId,
        orderId: order.id,
        action: 'PRINT_JOB_SUBMITTED',
        details: { target: 'tablet_receiver', jobId: result.jobId },
      },
    })

    return NextResponse.json({ success: true, jobId: result.jobId })
  } catch (error) {
    console.error('[TABLET PUSH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

