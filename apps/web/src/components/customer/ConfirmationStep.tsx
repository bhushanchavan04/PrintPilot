'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Printer, Clock, Package } from 'lucide-react'
import { getOrderStatusLabel, getOrderStatusColor, formatRelativeTime } from '@/lib/utils'
import type { Order } from '@/types'

interface ConfirmationStepProps {
  orderId: string
  orderNumber: string
  shopName: string
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PAYMENT_CONFIRMED: <CheckCircle className="w-5 h-5 text-green-500" />,
  AWAITING_APPROVAL: <Clock className="w-5 h-5 text-orange-500" />,
  QUEUED: <Package className="w-5 h-5 text-purple-500" />,
  PRINTING: <Printer className="w-5 h-5 text-blue-500 animate-pulse" />,
  COMPLETED: <CheckCircle className="w-5 h-5 text-green-600" />,
}

export function ConfirmationStep({ orderId, orderNumber, shopName }: ConfirmationStepProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasVibrated, setHasVibrated] = useState(false)

  const pollOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
        if (data.order?.status === 'COMPLETED' && !hasVibrated) {
          setHasVibrated(true)
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([150, 80, 150])
          }
        }
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    pollOrder()
    // Poll fast (every 2.5 seconds) so customer is notified immediately when tablet finishes printing
    const interval = setInterval(() => {
      if (order?.status === 'COMPLETED' || order?.status === 'FAILED' || order?.status === 'CANCELLED') {
        clearInterval(interval)
        return
      }
      pollOrder()
    }, 2500)

    return () => clearInterval(interval)
  }, [orderId, order?.status, hasVibrated])

  const status = order?.status ?? 'PRINTING'
  const isCompleted = status === 'COMPLETED'
  const isPrinting = status === 'PRINTING'
  const isFailed = status === 'FAILED' || status === 'CANCELLED'

  return (
    <div className="space-y-6 text-center">
      {/* Big status illustration */}
      <div className="flex flex-col items-center pt-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${
          isCompleted
            ? 'bg-green-100 ring-8 ring-green-50 scale-105'
            : isFailed
            ? 'bg-red-100 ring-8 ring-red-50'
            : isPrinting
            ? 'bg-blue-100 ring-8 ring-blue-50 animate-pulse'
            : 'bg-indigo-100 ring-8 ring-indigo-50'
        }`}>
          {isCompleted ? (
            <CheckCircle className="w-10 h-10 text-green-600 animate-bounce" />
          ) : isFailed ? (
            <CheckCircle className="w-10 h-10 text-red-500" />
          ) : isPrinting ? (
            <Printer className="w-10 h-10 text-blue-600" />
          ) : (
            <CheckCircle className="w-10 h-10 text-indigo-600" />
          )}
        </div>

        <h2 className={`text-2xl font-bold tracking-tight ${
          isCompleted ? 'text-green-700' : isPrinting ? 'text-blue-700' : 'text-gray-900'
        }`}>
          {isCompleted
            ? '🎉 Your Print is Ready!'
            : isPrinting
            ? '🖨️ Printing Your Copy Now…'
            : isFailed
            ? 'Order Cancelled'
            : 'Order Confirmed!'}
        </h2>

        <p className="text-sm font-medium text-gray-600 mt-1 max-w-sm">
          {isCompleted
            ? 'Your documents have finished printing! Please collect your printout from the counter.'
            : isPrinting
            ? 'The printer is actively processing your pages. It will be ready in a moment.'
            : isFailed
            ? 'Please contact the shop staff.'
            : 'Your payment was received and the job is queued for printing.'}
        </p>
      </div>

      {/* Celebratory Banner on Completion */}
      {isCompleted && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-4 shadow-lg shadow-green-100 animate-pulse">
          <p className="text-sm font-bold uppercase tracking-wider">Ready for Collection</p>
          <p className="text-xs text-green-100 mt-0.5">Please show your order number at the counter</p>
        </div>
      )}

      {/* Order number */}
      <div className={`rounded-2xl p-5 border transition-all ${
        isCompleted ? 'bg-green-50/60 border-green-200' : 'bg-gray-50 border-gray-100'
      }`}>
        <p className="text-xs text-gray-500 mb-1">Order Number</p>
        <p className="text-3xl font-extrabold font-mono text-gray-900 tracking-wider">{orderNumber}</p>
        <p className="text-xs text-gray-400 mt-1">Show this to the counter staff to collect</p>
      </div>

      {/* Status tracker */}
      <div className="border border-gray-100 rounded-2xl p-4 text-left">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Status</p>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {STATUS_ICONS[status] ?? <Clock className="w-5 h-5 text-gray-400" />}
            <div>
              <p className="text-sm font-medium text-gray-900">{getOrderStatusLabel(status)}</p>
              {order?.updatedAt && (
                <p className="text-xs text-gray-400">Updated {formatRelativeTime(order.updatedAt)}</p>
              )}
            </div>
            <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${getOrderStatusColor(status)}`}>
              {getOrderStatusLabel(status)}
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isCompleted && !isFailed && (
        <div className="bg-blue-50 rounded-2xl p-4 text-left">
          <p className="text-sm font-semibold text-blue-900 mb-2">What happens next?</p>
          <ol className="space-y-1.5">
            {[
              'Your order has been received by ' + shopName,
              'Documents will be reviewed and queued for printing',
              'The printer will process your files',
              'Collect your documents from the counter',
            ].map((step, i) => (
              <li key={i} className="text-xs text-blue-700 flex items-start gap-2">
                <span className="font-bold text-blue-400 flex-shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-xs text-gray-400">
        📄 Your documents will be securely deleted after printing is complete.
      </p>
    </div>
  )
}

