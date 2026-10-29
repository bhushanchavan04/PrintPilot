import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getSignedUrl, deleteFile } from '@/lib/storage'
import { generateOrderNumber } from '@/lib/utils'
import { calculatePrice, DEFAULT_PRICING_RULES } from '@/lib/pricing'

// POST /api/orders — create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shopId, customerName, customerPhone, customerEmail, fileIds, printSettings } = body

    if (!shopId || !fileIds?.length) {
      return NextResponse.json({ error: 'shopId and at least one fileId are required' }, { status: 400 })
    }

    // Validate shop
    const shop = await prisma.shop.findFirst({
      where: { OR: [{ id: shopId }, { slug: shopId }], isActive: true },
      include: { pricingRules: { where: { isActive: true } } },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Fetch uploaded files
    const files = await prisma.orderFile.findMany({
      where: { id: { in: fileIds } },
    })

    if (files.length !== fileIds.length) {
      return NextResponse.json({ error: 'One or more files not found' }, { status: 400 })
    }

    // Calculate price for each file
    const rules = shop.pricingRules.length > 0
      ? shop.pricingRules.map(r => ({
          paperSize: r.paperSize,
          colorMode: r.colorMode,
          sides: r.sides,
          pricePerPage: r.pricePerPage,
        }))
      : DEFAULT_PRICING_RULES

    let totalAmount = 0
    let totalPages = 0
    const fileCalculations: Array<{
      fileId: string
      settings: any
      priceBreakdown: ReturnType<typeof calculatePrice>
    }> = []

    for (const fileId of fileIds) {
      const file = files.find(f => f.id === fileId)!
      const settingForFile = printSettings?.find((s: any) => s.fileId === fileId)?.settings ?? {
        colorMode: 'BLACK_AND_WHITE',
        sides: 'SINGLE',
        paperSize: 'A4',
        orientation: 'PORTRAIT',
        copies: 1,
        pageRange: '',
      }

      const breakdown = calculatePrice(
        {
          colorMode: settingForFile.colorMode,
          sides: settingForFile.sides,
          paperSize: settingForFile.paperSize,
          copies: settingForFile.copies,
          pageCount: file.pageCount,
          pageRange: settingForFile.pageRange,
        },
        rules
      )

      totalAmount += breakdown.total
      totalPages += breakdown.effectivePages * settingForFile.copies
      fileCalculations.push({ fileId, settings: settingForFile, priceBreakdown: breakdown })
    }

    const orderNumber = generateOrderNumber()

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          shopId: shop.id,
          orderNumber,
          status: 'AWAITING_PAYMENT',
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          totalPages,
          totalAmount: Math.round(totalAmount * 100) / 100,
        },
      })

      // Link files to order and create print settings
      for (const { fileId, settings, priceBreakdown } of fileCalculations) {
        await tx.orderFile.update({
          where: { id: fileId },
          data: {
            orderId: order.id,
            fileAmount: priceBreakdown.total,
          },
        })

        await tx.printSettings.create({
          data: {
            orderFileId: fileId,
            colorMode: settings.colorMode,
            sides: settings.sides,
            paperSize: settings.paperSize,
            orientation: settings.orientation,
            copies: settings.copies,
            pageRange: settings.pageRange || null,
            pagesCount: priceBreakdown.effectivePages,
            pricePerPage: priceBreakdown.pricePerPage,
            totalAmount: priceBreakdown.total,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          shopId: shop.id,
          orderId: order.id,
          action: 'ORDER_CREATED',
          details: { orderNumber, totalAmount, fileCount: fileIds.length },
        },
      })

      return order
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error: any) {
    console.error('[ORDER CREATE]', error)
    return NextResponse.json({ error: 'Failed to create order. Please try again.' }, { status: 500 })
  }
}

// GET /api/orders — list orders for shop owner
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const search = searchParams.get('search')
    const skip = (page - 1) * limit

    const where: any = { shopId: shop.id }
    if (status && status !== 'ALL') where.status = status
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderFiles: { select: { id: true, originalName: true, pageCount: true, fileAmount: true, printSettings: true } },
          payment: { select: { id: true, status: true, method: true, amount: true } },
          _count: { select: { printJobs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[ORDERS GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

