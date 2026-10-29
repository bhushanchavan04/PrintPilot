import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const printUrl = `${appUrl}/print/${shop.slug}`

    const qrDataUrl = await QRCode.toDataURL(printUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })

    return NextResponse.json({ qrDataUrl, printUrl, shopSlug: shop.slug })
  } catch (error) {
    console.error('[QR GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findFirst({ where: { ownerId: auth.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Regenerate QR code (same URL, just regenerate)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const printUrl = `${appUrl}/print/${shop.slug}`

    const qrDataUrl = await QRCode.toDataURL(printUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })

    await prisma.auditLog.create({
      data: { userId: auth.id, shopId: shop.id, action: 'QR_CODE_REGENERATED' },
    })

    return NextResponse.json({ qrDataUrl, printUrl, shopSlug: shop.slug })
  } catch (error) {
    console.error('[QR POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

