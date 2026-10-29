import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Generate a unique order number like MP-20241028-AB3F2 */
export function generateOrderNumber(): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `MP-${y}${m}${d}-${rand}`
}

/** Format a date as "28 Oct 2024, 8:30 PM" */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** Format a date as relative time: "2 minutes ago" */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Format bytes as human-readable size */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/** Human-readable label for an order status */
export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    UPLOADED: 'Uploaded',
    AWAITING_PAYMENT: 'Awaiting Payment',
    PAYMENT_CONFIRMED: 'Payment Confirmed',
    AWAITING_APPROVAL: 'Awaiting Approval',
    QUEUED: 'Queued',
    PRINTING: 'Printing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    REFUND_PENDING: 'Refund Pending',
    REFUNDED: 'Refunded',
  }
  return labels[status] ?? status
}

/** Tailwind badge classes for a given order status */
export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    UPLOADED: 'bg-gray-100 text-gray-700',
    AWAITING_PAYMENT: 'bg-yellow-100 text-yellow-800',
    PAYMENT_CONFIRMED: 'bg-blue-100 text-blue-800',
    AWAITING_APPROVAL: 'bg-orange-100 text-orange-800',
    QUEUED: 'bg-purple-100 text-purple-800',
    PRINTING: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-500',
    REFUND_PENDING: 'bg-orange-100 text-orange-700',
    REFUNDED: 'bg-teal-100 text-teal-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Retry an async function up to maxAttempts times with a delay between tries */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await sleep(delayMs * attempt)
    }
  }
  throw lastError
}

/** Slugify a string for use in URLs */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
}

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']

export const MAX_FILE_SIZE_MB = 50
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export { formatCurrency } from './pricing'

