// GET  /api/files/[fileId] – return a short-lived signed download URL (shop owner only)
// DELETE /api/files/[fileId] – soft-delete file record + remove from storage

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, deleteFile } from '@/lib/storage'

interface Params {
  params: { fileId: string }
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await prisma.shop.findFirst({ where: { ownerId: user.id } })
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const file = await prisma.orderFile.findUnique({
      where: { id: params.fileId },
      include: { order: true },
    })

    if (!file || file.isDeleted) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Verify the file belongs to this shop
    if (file.order?.shopId !== shop.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use the print-ready converted key if available, otherwise the original
    const keyToUse = file.convertedKey ?? file.storageKey

    const signedUrl = await getSignedUrl(keyToUse, 300) // 5 minutes

    return NextResponse.json({
      fileId: file.id,
      originalName: file.originalName,
      signedUrl,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('File GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await prisma.shop.findFirst({ where: { ownerId: user.id } })
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const file = await prisma.orderFile.findUnique({
      where: { id: params.fileId },
      include: { order: true },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.order?.shopId !== shop.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (file.isDeleted) {
      return NextResponse.json({ message: 'File already deleted' })
    }

    // Delete from storage
    try {
      await deleteFile(file.storageKey)
      if (file.convertedKey) {
        await deleteFile(file.convertedKey)
      }
    } catch (storageError) {
      console.error('Storage deletion error (continuing):', storageError)
    }

    // Soft-delete in DB
    await prisma.orderFile.update({
      where: { id: file.id },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        orderId: file.orderId ?? undefined,
        action: 'FILE_DELETED',
        details: { fileId: file.id, originalName: file.originalName },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('File DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

