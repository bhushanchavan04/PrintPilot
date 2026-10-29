import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting MyPrint database seed...')

  // 1. Create Demo Shop Owner User
  const passwordHash = await bcrypt.hash('password123', 10)

  const owner = await prisma.user.upsert({
    where: { email: 'demo@printshop.com' },
    update: {},
    create: {
      email: 'demo@printshop.com',
      name: 'Ramesh Sharma',
      passwordHash,
      role: 'SHOP_OWNER',
      phone: '+91 98765 43210',
      emailVerified: true,
    },
  })

  console.log(`👤 Demo shop owner created: ${owner.email}`)

  // 2. Create Demo Shop
  const shop = await prisma.shop.upsert({
    where: { slug: 'quickprint' },
    update: {},
    create: {
      ownerId: owner.id,
      name: 'QuickPrint Hub & Xerox',
      slug: 'quickprint',
      description: 'High-speed xerox, digital color printing, spiral binding, and project reports.',
      address: 'Shop No. 4, College Road, Near University Gate',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411007',
      phone: '+91 98765 43210',
      email: 'demo@printshop.com',
      autoprint: false,
      requireApproval: true,
      maxFileSize: 50,
      allowedFormats: ['PDF', 'DOC', 'DOCX', 'JPG', 'JPEG', 'PNG'],
      documentRetention: 24,
    },
  })

  console.log(`🏪 Demo shop created: ${shop.name} (/print/${shop.slug})`)

  // 3. Create Pricing Rules
  const defaultRules = [
    { paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: 2.0 },
    { paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'DOUBLE', pricePerPage: 1.5 },
    { paperSize: 'A4', colorMode: 'COLOR', sides: 'SINGLE', pricePerPage: 10.0 },
    { paperSize: 'A4', colorMode: 'COLOR', sides: 'DOUBLE', pricePerPage: 8.0 },
    { paperSize: 'A3', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: 5.0 },
    { paperSize: 'A3', colorMode: 'BLACK_AND_WHITE', sides: 'DOUBLE', pricePerPage: 4.0 },
    { paperSize: 'A3', colorMode: 'COLOR', sides: 'SINGLE', pricePerPage: 25.0 },
    { paperSize: 'A3', colorMode: 'COLOR', sides: 'DOUBLE', pricePerPage: 20.0 },
  ] as const

  for (const rule of defaultRules) {
    await prisma.pricingRule.upsert({
      where: {
        shopId_paperSize_colorMode_sides: {
          shopId: shop.id,
          paperSize: rule.paperSize,
          colorMode: rule.colorMode,
          sides: rule.sides,
        },
      },
      update: { pricePerPage: rule.pricePerPage },
      create: {
        shopId: shop.id,
        name: `${rule.paperSize} ${rule.colorMode} (${rule.sides})`,
        paperSize: rule.paperSize,
        colorMode: rule.colorMode,
        sides: rule.sides,
        pricePerPage: rule.pricePerPage,
      },
    })
  }

  console.log(`💰 Added ${defaultRules.length} pricing rules`)

  // 4. Create Detected Physical Printer
  await prisma.printer.upsert({
    where: { id: 'demo-printer-hp' },
    update: { isOnline: true },
    create: {
      id: 'demo-printer-hp',
      shopId: shop.id,
      name: 'HP LaserJet Pro MFP M126nw',
      systemName: 'HP LaserJet Pro MFP M126nw',
      description: 'Counter Main B&W Laser Printer',
      isDefault: true,
      isActive: true,
      isOnline: true,
      supportsColor: false,
      supportsDuplex: false,
      paperSizes: ['A4'],
    },
  })

  // Also add Microsoft Print to PDF as fallback virtual printer
  await prisma.printer.upsert({
    where: { id: 'demo-printer-pdf' },
    update: { isOnline: true },
    create: {
      id: 'demo-printer-pdf',
      shopId: shop.id,
      name: 'Microsoft Print to PDF',
      systemName: 'Microsoft Print to PDF',
      description: 'Virtual PDF printer for testing',
      isDefault: false,
      isActive: true,
      isOnline: true,
      supportsColor: true,
      supportsDuplex: false,
      paperSizes: ['A4', 'A3', 'A5', 'LETTER', 'LEGAL'],
    },
  })

  console.log('🖨️ Added default printers')

  // 5. Create Sample Orders
  const sampleOrder1 = await prisma.order.upsert({
    where: { orderNumber: 'MP-20261028-DEMO1' },
    update: {},
    create: {
      shopId: shop.id,
      orderNumber: 'MP-20261028-DEMO1',
      status: 'AWAITING_APPROVAL',
      customerName: 'Ananya Verma',
      customerPhone: '+91 91234 56789',
      totalPages: 12,
      totalAmount: 24.0,
      notes: 'Please print cleanly, needed for college submission.',
      createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
      payment: {
        create: {
          method: 'MOCK',
          status: 'SUCCESS',
          amount: 24.0,
          isMockPayment: true,
          completedAt: new Date(Date.now() - 1000 * 60 * 14),
        },
      },
      orderFiles: {
        create: {
          originalName: 'Final_Project_Report_v2.pdf',
          storedName: 'sample-project-report.pdf',
          storageKey: `shops/${shop.id}/uploads/sample-project-report.pdf`,
          mimeType: 'application/pdf',
          format: 'PDF',
          sizeBytes: 1024 * 750,
          pageCount: 12,
          fileAmount: 24.0,
          printSettings: {
            create: {
              colorMode: 'BLACK_AND_WHITE',
              sides: 'SINGLE',
              paperSize: 'A4',
              copies: 1,
              pagesCount: 12,
              pricePerPage: 2.0,
              totalAmount: 24.0,
            },
          },
        },
      },
    },
  })

  const sampleOrder2 = await prisma.order.upsert({
    where: { orderNumber: 'MP-20261028-DEMO2' },
    update: {},
    create: {
      shopId: shop.id,
      orderNumber: 'MP-20261028-DEMO2',
      status: 'COMPLETED',
      customerName: 'Vikas Patil',
      customerPhone: '+91 98220 12345',
      totalPages: 4,
      totalAmount: 40.0,
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      payment: {
        create: {
          method: 'UPI',
          status: 'SUCCESS',
          amount: 40.0,
          isMockPayment: true,
          completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
      },
      orderFiles: {
        create: {
          originalName: 'Resume_Color.pdf',
          storedName: 'sample-resume.pdf',
          storageKey: `shops/${shop.id}/uploads/sample-resume.pdf`,
          mimeType: 'application/pdf',
          format: 'PDF',
          sizeBytes: 1024 * 320,
          pageCount: 2,
          fileAmount: 40.0,
          printSettings: {
            create: {
              colorMode: 'COLOR',
              sides: 'SINGLE',
              paperSize: 'A4',
              copies: 2,
              pagesCount: 2,
              pricePerPage: 10.0,
              totalAmount: 40.0,
            },
          },
        },
      },
    },
  })

  console.log(`📦 Seeded sample orders: ${sampleOrder1.orderNumber}, ${sampleOrder2.orderNumber}`)
  console.log('✅ Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

