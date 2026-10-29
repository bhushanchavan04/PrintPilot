import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { shopSchema } from '@/lib/validations'

// GET /api/shops — get current user's shop
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({
      where: { ownerId: auth.id },
      include: {
        pricingRules: { where: { isActive: true } },
        printers: { where: { isActive: true } },
        _count: { select: { orders: true } },
      },
    })

    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    return NextResponse.json({ shop })
  } catch (error) {
    console.error('[SHOPS GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/shops — update shop settings
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const result = shopSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.flatten().fieldErrors }, { status: 400 })
    }

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        name: result.data.name,
        description: result.data.description,
        address: result.data.address,
        city: result.data.city,
        state: result.data.state,
        pincode: result.data.pincode,
        phone: result.data.phone,
        email: result.data.email || null,
        website: result.data.website || null,
        autoprint: result.data.autoprint,
        requireApproval: result.data.requireApproval,
        documentRetention: result.data.documentRetention,
        maxFileSize: result.data.maxFileSize,
        upiId: result.data.upiId || null,
        upiName: result.data.upiName || null,
        acceptCashAtCounter: result.data.acceptCashAtCounter,
      },
    })

    await prisma.auditLog.create({
      data: { userId: auth.id, shopId: shop.id, action: 'SHOP_UPDATED' },
    })

    return NextResponse.json({ shop: updated })
  } catch (error) {
    console.error('[SHOPS PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

