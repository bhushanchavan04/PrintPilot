// POST /api/connector/register
// Called by the Local Print Connector on startup to register itself and report
// available printers.  Returns the shop's connector configuration.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RegisterBody {
  connectorVersion: string
  os: string
  hostname: string
  printers: {
    systemName: string
    name?: string
    supportsColor?: boolean
    supportsDuplex?: boolean
    paperSizes?: string[]
    isDefault?: boolean
  }[]
}

const VALID_PAPER_SIZES = ['A4', 'A3', 'A5', 'LETTER', 'LEGAL'] as const
type ValidPaperSize = typeof VALID_PAPER_SIZES[number]

function filterPaperSizes(sizes: string[]): ValidPaperSize[] {
  return sizes
    .map((s) => s.toUpperCase())
    .filter((s): s is ValidPaperSize => VALID_PAPER_SIZES.includes(s as ValidPaperSize))
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await prisma.shop.findFirst({
      where: { ownerId: user.id },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const body: RegisterBody = await req.json()

    if (!Array.isArray(body.printers)) {
      return NextResponse.json(
        { error: 'printers array is required' },
        { status: 400 }
      )
    }

    const connectorVersion = body.connectorVersion || '1.0.0'
    const osInfo = body.os || process.platform
    const hostname = body.hostname || 'desktop'

    const reportedSystemNames = body.printers.map((p) => p.systemName).filter(Boolean)

    // Upsert printers using findFirst + create/update pattern
    const upsertedPrinters = []
    for (const p of body.printers) {
      if (!p.systemName) continue

      const paperSizes = filterPaperSizes(p.paperSizes ?? ['A4'])
      const finalPaperSizes = paperSizes.length > 0 ? paperSizes : ['A4' as ValidPaperSize]

      const existing = await prisma.printer.findFirst({
        where: { shopId: shop.id, systemName: p.systemName },
      })

      if (existing) {
        const updated = await prisma.printer.update({
          where: { id: existing.id },
          data: {
            isOnline: true,
            lastSeenAt: new Date(),
            supportsColor: p.supportsColor ?? existing.supportsColor,
            supportsDuplex: p.supportsDuplex ?? existing.supportsDuplex,
            paperSizes: finalPaperSizes,
            isDefault: p.isDefault ?? existing.isDefault,
          },
        })
        upsertedPrinters.push(updated)
      } else {
        const created = await prisma.printer.create({
          data: {
            shopId: shop.id,
            systemName: p.systemName,
            name: p.name ?? p.systemName,
            supportsColor: p.supportsColor ?? false,
            supportsDuplex: p.supportsDuplex ?? false,
            paperSizes: finalPaperSizes,
            isDefault: p.isDefault ?? false,
            isOnline: true,
            isActive: true,
            lastSeenAt: new Date(),
          },
        })
        upsertedPrinters.push(created)
      }
    }

    // Mark printers NOT in this report as offline
    if (reportedSystemNames.length > 0) {
      await prisma.printer.updateMany({
        where: {
          shopId: shop.id,
          systemName: { notIn: reportedSystemNames },
          isOnline: true,
        },
        data: { isOnline: false },
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        action: 'CONNECTOR_CONNECTED',
        details: {
          connectorVersion,
          os: osInfo,
          hostname,
          printerCount: body.printers.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      shopId: shop.id,
      shopName: shop.name,
      autoprint: shop.autoprint,
      requireApproval: shop.requireApproval,
      printers: upsertedPrinters.map((p) => ({
        id: p.id,
        systemName: p.systemName,
        name: p.name,
        isDefault: p.isDefault,
      })),
    })
  } catch (error) {
    console.error('Connector register error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
