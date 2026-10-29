import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/shops/[shopId] — public shop info by slug or id
export async function GET(
  request: NextRequest,
  { params }: { params: { shopId: string } }
) {
  try {
    const { shopId } = params

    // Try by slug first, then by ID
    const shop = await prisma.shop.findFirst({
      where: {
        OR: [{ slug: shopId }, { id: shopId }],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        upiId: true,
        upiName: true,
        acceptCashAtCounter: true,
        allowedFormats: true,
        maxFileSize: true,
        requireApproval: true,
        pricingRules: {
          where: { isActive: true },
          select: {
            id: true,
            paperSize: true,
            colorMode: true,
            sides: true,
            pricePerPage: true,
          },
        },
        printers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            supportsColor: true,
            supportsDuplex: true,
            paperSizes: true,
            isDefault: true,
            isOnline: true,
          },
        },
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Determine supported capabilities from printers
    const supportsColor = shop.printers.some((p) => p.supportsColor)
    const supportsDuplex = shop.printers.some((p) => p.supportsDuplex)
    const paperSizes = [...new Set(shop.printers.flatMap((p) => p.paperSizes))]

    return NextResponse.json({
      shop: {
        ...shop,
        supportsColor,
        supportsDuplex,
        paperSizes: paperSizes.length > 0 ? paperSizes : ['A4'],
      },
    })
  } catch (error) {
    console.error('[SHOP BY ID]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

