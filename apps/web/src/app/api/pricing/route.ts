import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, DEFAULT_PRICING_RULES } from '@/lib/pricing'

// GET /api/pricing — get pricing rules for authenticated shop
// POST /api/pricing — create new pricing rule

export async function GET(request: NextRequest) {
  try {
    // Try auth first (dashboard), fall back to shopId query param (customer)
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shopId')

    let targetShopId: string | null = null

    if (shopId) {
      const shop = await prisma.shop.findFirst({
        where: { OR: [{ id: shopId }, { slug: shopId }], isActive: true },
      })
      targetShopId = shop?.id ?? null
    } else {
      const { getAuthUser } = await import('@/lib/auth')
      const auth = await getAuthUser(request)
      if (auth) {
        const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
        targetShopId = shop?.id ?? null
      }
    }

    if (!targetShopId) {
      return NextResponse.json({ rules: DEFAULT_PRICING_RULES })
    }

    const rules = await prisma.pricingRule.findMany({
      where: { shopId: targetShopId, isActive: true },
      orderBy: [{ paperSize: 'asc' }, { colorMode: 'asc' }, { sides: 'asc' }],
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[PRICING GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { getAuthUser } = await import('@/lib/auth')
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { paperSize, colorMode, sides, pricePerPage } = body

    if (!paperSize || !colorMode || !sides || pricePerPage === undefined) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Upsert (update if exists, create if not)
    const rule = await prisma.pricingRule.upsert({
      where: {
        shopId_paperSize_colorMode_sides: {
          shopId: shop.id,
          paperSize,
          colorMode,
          sides,
        },
      },
      update: { pricePerPage, isActive: true },
      create: {
        shopId: shop.id,
        name: `${paperSize} ${colorMode === 'BLACK_AND_WHITE' ? 'B&W' : 'Colour'} ${sides}`,
        paperSize,
        colorMode,
        sides,
        pricePerPage,
      },
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('[PRICING POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

