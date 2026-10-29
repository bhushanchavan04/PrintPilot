import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, DEFAULT_PRICING_RULES } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  try {
    const { shopId, files } = await request.json()

    if (!shopId || !files?.length) {
      return NextResponse.json({ error: 'shopId and files are required' }, { status: 400 })
    }

    // Get shop pricing rules
    const shop = await prisma.shop.findFirst({
      where: { OR: [{ id: shopId }, { slug: shopId }], isActive: true },
      include: { pricingRules: { where: { isActive: true } } },
    })

    const rules = (shop?.pricingRules ?? []).length > 0
      ? shop!.pricingRules.map(r => ({
          paperSize: r.paperSize,
          colorMode: r.colorMode,
          sides: r.sides,
          pricePerPage: r.pricePerPage,
        }))
      : DEFAULT_PRICING_RULES

    const breakdown = files.map((f: any) => {
      const result = calculatePrice(
        {
          colorMode: f.settings?.colorMode ?? 'BLACK_AND_WHITE',
          sides: f.settings?.sides ?? 'SINGLE',
          paperSize: f.settings?.paperSize ?? 'A4',
          copies: f.settings?.copies ?? 1,
          pageCount: f.pageCount ?? 0,
          pageRange: f.settings?.pageRange,
        },
        rules
      )
      return { ...result, fileId: f.fileId }
    })

    const total = breakdown.reduce((s: number, b: any) => s + b.total, 0)

    return NextResponse.json({ breakdown, total: Math.round(total * 100) / 100 })
  } catch (error) {
    console.error('[PRICING CALCULATE]', error)
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}

