'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Search, X, ChevronLeft, ChevronRight,
  FileText, Check, Ban, RotateCcw, Tablet
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getOrderStatusColor, getOrderStatusLabel, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import type { Order } from '@/types'

const STATUS_FILTERS = ['ALL', 'AWAITING_PAYMENT', 'AWAITING_APPROVAL', 'QUEUED', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED']

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(status)}`}>
      {getOrderStatusLabel(status)}
    </span>
  )
}

function OrderDetailPanel({ orderId, onClose, onRefresh }: { orderId: string; onClose: () => void; onRefresh: () => void }) {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [tabletStatus, setTabletStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(d => setOrder(d.order))
      .finally(() => setLoading(false))
  }, [orderId])

  const doAction = async (endpoint: string, body?: object) => {
    setActionLoading(endpoint)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.ok) {
        const d = await res.json()
        setOrder(d.order)
        onRefresh()
      }
    } finally {
      setActionLoading('')
    }
  }

  const sendToTablet = async () => {
    setTabletStatus('sending')
    try {
      const res = await fetch('/api/tablet/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      if (res.ok) {
        setTabletStatus('sent')
        setTimeout(() => setTabletStatus('idle'), 4000)
      } else {
        const d = await res.json()
        alert(d.error ?? 'Failed to send to tablet. Is the receiver running?')
        setTabletStatus('error')
        setTimeout(() => setTabletStatus('idle'), 3000)
      }
    } catch {
      alert('Cannot reach tablet receiver. Make sure receiver.py is running.')
      setTabletStatus('error')
      setTimeout(() => setTabletStatus('idle'), 3000)
    }
  }

  if (loading) return (
    <div className="fixed inset-0 z-40 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] bg-white shadow-2xl flex items-center justify-center border-l border-gray-100">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  if (!order) return null

  const canApprove = ['AWAITING_APPROVAL', 'PAYMENT_CONFIRMED'].includes(order.status)
  const canReject = ['AWAITING_APPROVAL', 'PAYMENT_CONFIRMED', 'QUEUED'].includes(order.status)

  return (
    <div className="fixed inset-0 z-40 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] bg-white shadow-2xl border-l border-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-mono font-bold text-gray-900">{order.orderNumber}</p>
          <StatusBadge status={order.status} />
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
        {/* Customer */}
        {(order.customerName || order.customerPhone) && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Customer</p>
            <p className="text-sm font-medium text-gray-900">{order.customerName || 'Anonymous'}</p>
            {order.customerPhone && <p className="text-xs text-gray-500">{order.customerPhone}</p>}
          </section>
        )}

        {/* Files */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Files & Settings</p>
          <div className="space-y-3">
            {order.orderFiles?.map((file: any) => (
              <div key={file.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
                    <p className="text-xs text-gray-500">{file.pageCount} pages</p>
                    {file.printSettings && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[
                          file.printSettings.colorMode === 'COLOR' ? 'Colour' : 'B&W',
                          file.printSettings.sides === 'DOUBLE' ? 'Duplex' : 'Single',
                          `${file.printSettings.copies}× copies`,
                          `${file.printSettings.paperSize}`,
                        ].map(t => (
                          <span key={t} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-700 flex-shrink-0">₹{file.fileAmount?.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Payment */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment</p>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{order.payment?.method ?? 'Not paid'}</p>
              <p className="text-sm font-bold text-gray-900">₹{order.totalAmount?.toFixed(2)}</p>
            </div>
            {order.payment && (
              <StatusBadge status={order.payment.status} />
            )}
          </div>
        </section>

        {/* Print jobs */}
        {order.printJobs?.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Print Jobs</p>
            {order.printJobs.map((job: any) => (
              <div key={job.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-600 font-mono">{job.id.slice(0, 8)}…</p>
                  <StatusBadge status={job.status} />
                </div>
                {job.lastError && <p className="text-xs text-red-500 mt-1">{job.lastError}</p>}
              </div>
            ))}
          </section>
        )}

        {/* Timestamps */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Timeline</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-700">{formatDate(order.createdAt)}</span>
            </div>
            {order.confirmedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Confirmed</span>
                <span className="text-gray-700">{formatDate(order.confirmedAt)}</span>
              </div>
            )}
            {order.completedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Completed</span>
                <span className="text-green-700 font-medium">{formatDate(order.completedAt)}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-100 p-4 space-y-2">
        {canApprove && (
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            loading={actionLoading === `/api/orders/${orderId}/approve`}
            onClick={() => doAction(`/api/orders/${orderId}/approve`)}
          >
            <Check className="w-4 h-4 mr-2" /> Approve & Queue for Printing
          </Button>
        )}

        {showRejectInput ? (
          <div className="space-y-2">
            <input
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowRejectInput(false); setRejectionReason('') }}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                loading={actionLoading === `/api/orders/${orderId}/reject`}
                onClick={() => { doAction(`/api/orders/${orderId}/reject`, { reason: rejectionReason }); setShowRejectInput(false) }}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        ) : canReject && (
          <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowRejectInput(true)}>
            <Ban className="w-4 h-4 mr-2" /> Reject Order
          </Button>
        )}

        {order.status === 'COMPLETED' && (
          <Button variant="outline" className="w-full" onClick={() => doAction(`/api/orders/${orderId}/approve`)}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reprint
          </Button>
        )}

        {/* ── Send to Tablet Receiver ── */}
        <Button
          variant="outline"
          className={`w-full transition-all ${
            tabletStatus === 'sent'
              ? 'border-green-400 text-green-700 bg-green-50'
              : tabletStatus === 'error'
              ? 'border-red-300 text-red-600'
              : 'border-blue-200 text-blue-700 hover:bg-blue-50'
          }`}
          loading={tabletStatus === 'sending'}
          onClick={sendToTablet}
          disabled={tabletStatus === 'sending'}
        >
          <Tablet className="w-4 h-4 mr-2" />
          {tabletStatus === 'sent'
            ? '✅ Sent to Tablet!'
            : tabletStatus === 'error'
            ? '❌ Receiver offline'
            : '📱 Send to Tablet'}
        </Button>
      </div>
    </div>
  )
}

function OrdersContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get('id'))
  const [receiverInfo, setReceiverInfo] = useState<{ online: boolean; lanIp: string; tabletUrl: string } | null>(null)

  useEffect(() => {
    fetch('/api/tablet/status')
      .then(r => r.json())
      .then(d => setReceiverInfo(d))
      .catch(() => {})
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/orders?${params}`)
      const d = await res.json()
      if (d.orders) {
        setOrders(d.orders)
        setTotalPages(d.pagination?.pages ?? 1)
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => {
    const id = setInterval(fetchOrders, 15000)
    return () => clearInterval(id)
  }, [fetchOrders])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
      </div>

      {/* Tablet Receiver Banner */}
      {receiverInfo && (
        <div className={`mb-5 p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          receiverInfo.online ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${receiverInfo.online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">
                {receiverInfo.online ? 'Wi-Fi Tablet Print Receiver Active' : 'Tablet Print Receiver Offline'}
              </p>
              <p className="text-sm">
                Open on Android Tablet: <code className="font-mono font-bold bg-white/70 px-2 py-0.5 rounded border text-blue-700">{receiverInfo.tabletUrl}</code>
              </p>
            </div>
          </div>
          {receiverInfo.online && (
            <a
              href={receiverInfo.tabletUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold bg-white px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1 shadow-sm"
            >
              Open Tablet View ↗
            </a>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by order number or customer…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.slice(0, 6).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'All' : getOrderStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No orders found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 uppercase tracking-wide">Order</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 uppercase tracking-wide hidden sm:table-cell">Customer</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 uppercase tracking-wide hidden md:table-cell">Files</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 uppercase tracking-wide">Status</th>
                      <th className="text-right text-xs font-medium text-gray-400 px-5 py-3 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrderId === order.id ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <p className="text-sm font-mono font-medium text-gray-900">{order.orderNumber}</p>
                          <p className="text-xs text-gray-400">{formatRelativeTime(order.createdAt)}</p>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <p className="text-sm text-gray-700">{order.customerName || <span className="text-gray-400 italic">Anonymous</span>}</p>
                          {order.customerPhone && <p className="text-xs text-gray-400">{order.customerPhone}</p>}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <p className="text-sm text-gray-700">{order.orderFiles?.length ?? 0} file{(order.orderFiles?.length ?? 0) !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-gray-400">{order.totalPages} pages</p>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-sm font-bold text-gray-900">₹{order.totalAmount.toFixed(0)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selectedOrderId && (
        <OrderDetailPanel
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onRefresh={fetchOrders}
        />
      )}
      {selectedOrderId && (
        <div className="fixed inset-0 z-30 md:hidden bg-black/20" onClick={() => setSelectedOrderId(null)} />
      )}
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading orders...</div>}>
      <OrdersContent />
    </Suspense>
  )
}

