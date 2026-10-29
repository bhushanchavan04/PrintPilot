import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        ownedShops: {
          select: {
            id: true,
            name: true,
            slug: true,
            qrCode: true,
            qrCodeUrl: true,
            isActive: true,
            autoprint: true,
            requireApproval: true,
          },
          take: 1,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user, shop: user.ownedShops[0] ?? null })
  } catch (error) {
    console.error('[ME]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

