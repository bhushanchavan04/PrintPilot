import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from '@/lib/utils'
import { PDFDocument } from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILES_PER_ORDER = 10

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const shopId = formData.get('shopId') as string | null
    const orderId = formData.get('orderId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 })
    }

    // Validate shop exists
    const shop = await prisma.shop.findFirst({
      where: { OR: [{ id: shopId }, { slug: shopId }], isActive: true },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // File type validation
    const mimeType = file.type
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return NextResponse.json(
        {
          error: `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`,
        },
        { status: 400 }
      )
    }

    // File size validation
    const maxBytes = shop.maxFileSize * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed: ${shop.maxFileSize}MB` },
        { status: 400 }
      )
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract page count
    let pageCount = 1
    let format: string = ALLOWED_MIME_TYPES[mimeType] === 'pdf' ? 'PDF' : 
                         mimeType === 'application/msword' ? 'DOC' :
                         mimeType.includes('openxmlformats') ? 'DOCX' :
                         mimeType === 'image/png' ? 'PNG' : 'JPG'

    if (mimeType === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
        pageCount = pdfDoc.getPageCount()
      } catch {
        return NextResponse.json({ error: 'Invalid or corrupted PDF file' }, { status: 400 })
      }
    }

    // Generate storage key
    const ext = ALLOWED_MIME_TYPES[mimeType]
    const fileId = uuidv4()
    const storageKey = `shops/${shop.id}/uploads/${fileId}.${ext}`

    // Upload to storage
    await uploadFile(storageKey, buffer, mimeType)

    // Determine the format enum value
    const formatEnum = format as any

    // Create OrderFile record (orderId is nullable — linked when order is confirmed)
    const orderFile = await prisma.orderFile.create({
      data: {
        orderId: orderId || null,
        sessionId: (formData.get('sessionId') as string | null) || null,
        originalName: file.name,
        storedName: `${fileId}.${ext}`,
        storageKey,
        mimeType,
        format: formatEnum,
        sizeBytes: file.size,
        pageCount,
      },
    })

    return NextResponse.json({
      fileId: orderFile.id,
      originalName: file.name,
      pageCount,
      sizeBytes: file.size,
      mimeType,
      format,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[FILE UPLOAD]', error)
    return NextResponse.json({ error: 'File upload failed. Please try again.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

