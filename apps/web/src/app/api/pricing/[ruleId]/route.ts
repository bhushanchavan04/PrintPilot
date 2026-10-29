import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { ruleId } = params
    const { pricePerPage, isActive } = await request.json()

    const rule = await prisma.pricingRule.findFirst({ where: { id: ruleId, shopId: shop.id } })
    if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

    const updated = await prisma.pricingRule.update({
      where: { id: ruleId },
      data: {
        ...(pricePerPage !== undefined && { pricePerPage }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ rule: updated })
  } catch (error) {
    console.error('[PRICING RULE PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { ruleId } = params
    const rule = await prisma.pricingRule.findFirst({ where: { id: ruleId, shopId: shop.id } })
    if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

    await prisma.pricingRule.delete({ where: { id: ruleId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PRICING RULE DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

