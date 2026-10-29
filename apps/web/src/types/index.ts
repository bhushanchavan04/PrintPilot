// ─── Enum mirrors ─────────────────────────────────────────────────────────────

export const OrderStatus = {
  UPLOADED: 'UPLOADED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  QUEUED: 'QUEUED',
  PRINTING: 'PRINTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
} as const

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus]

export const PaymentStatus = {
  PENDING: 'PENDING',
  INITIATED: 'INITIATED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PrintJobStatus = {
  PENDING: 'PENDING',
  DOWNLOADING: 'DOWNLOADING',
  DOWNLOADED: 'DOWNLOADED',
  SUBMITTED_TO_QUEUE: 'SUBMITTED_TO_QUEUE',
  PRINTING: 'PRINTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

export type PrintJobStatusType = (typeof PrintJobStatus)[keyof typeof PrintJobStatus]

// ─── Domain Interfaces ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  code?: string
  message?: string
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  phone?: string | null
  avatarUrl?: string | null
  isActive: boolean
  lastLoginAt?: string | null
  createdAt: string
}

export interface Shop {
  id: string
  ownerId: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone?: string | null
  email?: string | null
  upiId?: string | null
  upiName?: string | null
  acceptCashAtCounter?: boolean
  qrCode: string
  qrCodeUrl?: string | null
  isActive: boolean
  autoprint: boolean
  requireApproval: boolean
  maxFileSize: number
  allowedFormats: string[]
  documentRetention: number
  createdAt: string
  updatedAt: string
}

export interface PricingRule {
  id: string
  shopId: string
  paperSize: string
  colorMode: string
  sides: string
  pricePerPage: number
  isActive: boolean
}

export interface PrintSettings {
  id: string
  orderFileId: string
  colorMode: string
  sides: string
  paperSize: string
  orientation: string
  copies: number
  pageRange?: string | null
  pagesCount: number
  pricePerPage: number
  totalAmount: number
}

export interface OrderFile {
  id: string
  orderId: string
  originalName: string
  format: string
  sizeBytes: number
  pageCount: number
  fileAmount: number
  printSettings?: PrintSettings | null
  isDeleted: boolean
  createdAt: string
}

export interface Payment {
  id: string
  orderId: string
  method: string
  status: string
  amount: number
  currency: string
  gatewayOrderId?: string | null
  gatewayPaymentId?: string | null
  isMockPayment: boolean
  webhookVerified: boolean
  failureReason?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface PrintJob {
  id: string
  orderId: string
  printerId?: string | null
  status: string
  attempts: number
  maxAttempts: number
  lastError?: string | null
  submittedAt?: string | null
  completedAt?: string | null
  failedAt?: string | null
  createdAt: string
}

export interface Order {
  id: string
  shopId: string
  orderNumber: string
  status: OrderStatusType
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  totalPages: number
  totalAmount: number
  notes?: string | null
  rejectionReason?: string | null
  confirmedAt?: string | null
  printedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  orderFiles?: OrderFile[]
  payment?: Payment | null
  printJobs?: PrintJob[]
}

export interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  printingOrders: number
  completedOrders: number
  failedOrders: number
  todayRevenue: number
  monthRevenue: number
  totalPrintedPages: number
  todayOrders: number
  todayCompleted: number
}

export interface UploadedFile {
  id: string             // from API after upload
  localId: string        // temp ID for frontend tracking
  originalName: string
  sizeBytes: number
  mimeType: string
  pageCount: number
  status: 'uploading' | 'uploaded' | 'error'
  progress: number
  error?: string
}

export interface FileWithSettings extends UploadedFile {
  settings: {
    colorMode: 'BLACK_AND_WHITE' | 'COLOR'
    sides: 'SINGLE' | 'DOUBLE'
    paperSize: 'A4' | 'A3' | 'A5' | 'LETTER' | 'LEGAL'
    orientation: 'PORTRAIT' | 'LANDSCAPE'
    copies: number
    pageRange: string
  }
  calculatedPrice?: number
}

