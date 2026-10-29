import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createToken, AUTH_COOKIE_NAME } from '@/lib/auth'
import { registerSchema } from '@/lib/validations'
import { slugify, generateOrderNumber } from '@/lib/utils'
import { DEFAULT_PRICING_RULES } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = registerSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, email, password, shopName } = result.data

    // Check for existing user
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Generate unique shop slug
    let slug = slugify(shopName)
    const slugExists = await prisma.shop.findUnique({ where: { slug } })
    if (slugExists) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`
    }

    const passwordHash = await hashPassword(password)

    // Create user + shop + default pricing in a transaction
    const { user, shop } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: 'SHOP_OWNER' },
      })

      const shop = await tx.shop.create({
        data: {
          ownerId: user.id,
          name: shopName,
          slug,
          requireApproval: true,
          autoprint: false,
        },
      })

      // Create default pricing rules
      await tx.pricingRule.createMany({
        data: DEFAULT_PRICING_RULES.map((r) => ({
          shopId: shop.id,
          name: `${r.paperSize} ${r.colorMode === 'BLACK_AND_WHITE' ? 'B&W' : 'Colour'} ${r.sides}`,
          paperSize: r.paperSize as any,
          colorMode: r.colorMode as any,
          sides: r.sides as any,
          pricePerPage: r.pricePerPage,
        })),
      })

      // Provision 14-Day Free Trial subscription for the new shopkeeper
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 14)

      await tx.subscription.create({
        data: {
          shopId: shop.id,
          plan: 'TRIAL',
          status: 'TRIALING',
          amount: 0,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          shopId: shop.id,
          action: 'SHOP_CREATED',
          details: { shopName, slug, plan: 'TRIAL' },
        },
      })

      return { user, shop }
    })

    // Issue JWT
    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      shopId: shop.id,
    })

    const response = NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        shop: { id: shop.id, name: shop.name, slug: shop.slug },
      },
      { status: 201 }
    )

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('[REGISTER]', error)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}

