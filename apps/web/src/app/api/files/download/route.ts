// GET /api/files/download?key=...
// Serves files stored locally when MinIO/S3 is in fallback mode.
// Only accessible for valid keys.

import { NextRequest, NextResponse } from 'next/server'
import { readFileBuffer } from '@/lib/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    // Security check: verify this storage key belongs to a known order file or print job
    const file = await prisma.orderFile.findFirst({
      where: {
        OR: [{ storageKey: key }, { convertedKey: key }],
        isDeleted: false,
      },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const buffer = await readFileBuffer(key)
    if (!buffer) {
      return NextResponse.json({ error: 'File data not found on disk' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('File download error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

