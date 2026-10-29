import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalOrders,
      pendingOrders,
      printingOrders,
      completedOrders,
      failedOrders,
      todayOrders,
      todayCompleted,
      todayRevenue,
      monthRevenue,
      totalPages,
    ] = await Promise.all([
      prisma.order.count({ where: { shopId: shop.id } }),
      prisma.order.count({ where: { shopId: shop.id, status: { in: ['AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'AWAITING_APPROVAL', 'QUEUED'] } } }),
      prisma.order.count({ where: { shopId: shop.id, status: 'PRINTING' } }),
      prisma.order.count({ where: { shopId: shop.id, status: 'COMPLETED' } }),
      prisma.order.count({ where: { shopId: shop.id, status: 'FAILED' } }),
      prisma.order.count({ where: { shopId: shop.id, createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { shopId: shop.id, status: 'COMPLETED', completedAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { shopId: shop.id, status: { in: ['PAYMENT_CONFIRMED', 'AWAITING_APPROVAL', 'QUEUED', 'PRINTING', 'COMPLETED'] }, confirmedAt: { gte: todayStart } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { shopId: shop.id, status: { in: ['PAYMENT_CONFIRMED', 'AWAITING_APPROVAL', 'QUEUED', 'PRINTING', 'COMPLETED'] }, confirmedAt: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { shopId: shop.id, status: 'COMPLETED' },
        _sum: { totalPages: true },
      }),
    ])

    return NextResponse.json({
      stats: {
        totalOrders,
        pendingOrders,
        printingOrders,
        completedOrders,
        failedOrders,
        todayOrders,
        todayCompleted,
        todayRevenue: todayRevenue._sum.totalAmount ?? 0,
        monthRevenue: monthRevenue._sum.totalAmount ?? 0,
        totalPrintedPages: totalPages._sum.totalPages ?? 0,
      },
    })
  } catch (error) {
    console.error('[DASHBOARD STATS]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

