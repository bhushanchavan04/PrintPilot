import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({
      where: { ownerId: auth.id },
      include: { subscription: true },
    })

    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    let subscription = shop.subscription

    // Auto-create trial if missing for any legacy shop
    if (!subscription) {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 14)

      subscription = await prisma.subscription.create({
        data: {
          shopId: shop.id,
          plan: 'TRIAL',
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
          amount: 0,
        },
      })
    }

    const now = new Date()
    const endDate = new Date(subscription.currentPeriodEnd)
    const diffTime = endDate.getTime() - now.getTime()
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    const isExpired = subscription.status === 'EXPIRED' || daysRemaining === 0

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: isExpired && subscription.status !== 'ACTIVE' ? 'EXPIRED' : subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        daysRemaining,
        isExpired,
        amount: subscription.amount,
      },
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
      },
    })
  } catch (error) {
    console.error('[SUBSCRIPTIONS CURRENT GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

