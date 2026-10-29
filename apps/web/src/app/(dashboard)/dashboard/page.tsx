'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag, CheckCircle, Printer, AlertCircle,
  TrendingUp, Clock, Download, QrCode, Zap, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils'
import type { DashboardStats, Order } from '@/types'

function StatCard({
  title, value, sub, icon: Icon, color = 'blue', urgent = false
}: {
  title: string; value: string | number; sub?: string
  icon: any; color?: string; urgent?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card className={urgent ? 'border-orange-200 bg-orange-50' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${urgent ? 'text-orange-700' : 'text-gray-900'}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [shop, setShop] = useState<any>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, shopRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/orders?limit=8'),
        fetch('/api/shops'),
      ])
      const [statsData, ordersData, shopData] = await Promise.all([
        statsRes.json(), ordersRes.json(), shopRes.json(),
      ])
      if (statsData.stats) setStats(statsData.stats)
      if (ordersData.orders) setOrders(ordersData.orders)
      if (shopData.shop) setShop(shopData.shop)
    } catch {}
    setLoading(false)
  }

  const loadQR = async () => {
    try {
      const res = await fetch('/api/qr')
      const d = await res.json()
      if (d.qrDataUrl) setQrDataUrl(d.qrDataUrl)
    } catch {}
  }

  useEffect(() => {
    fetchData()
    loadQR()
    const id = setInterval(fetchData, 20000)
    return () => clearInterval(id)
  }, [])

  const downloadQR = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'myprint-qr-code.png'
    a.click()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {shop ? `${shop.name} · ` : ''}
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          {qrDataUrl && (
            <Button size="sm" onClick={() => setShowQR(true)}>
              <QrCode className="w-4 h-4 mr-1" /> QR Code
            </Button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders ?? 0}
          sub={`${stats?.todayOrders ?? 0} today`}
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          title="Pending"
          value={stats?.pendingOrders ?? 0}
          sub="awaiting action"
          icon={Clock}
          color="orange"
          urgent={(stats?.pendingOrders ?? 0) > 0}
        />
        <StatCard
          title="Completed"
          value={stats?.completedOrders ?? 0}
          sub={`${stats?.todayCompleted ?? 0} today`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Today's Revenue"
          value={`₹${(stats?.todayRevenue ?? 0).toFixed(0)}`}
          sub={`₹${(stats?.monthRevenue ?? 0).toFixed(0)} this month`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Quick setup banner (if no orders yet) */}
      {stats?.totalOrders === 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Get started in 3 steps</h3>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Download and display your QR code at the counter</li>
                  <li>2. Install the Local Print Connector on your shop computer</li>
                  <li>3. Configure your pricing rules</li>
                </ol>
              </div>
              <Button size="sm" onClick={() => setShowQR(true)}>Get QR Code</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <Link href="/dashboard/orders">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No orders yet</p>
                  <p className="text-xs text-gray-400 mt-1">Orders will appear here when customers scan your QR code</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {orders.map(order => (
                    <Link
                      key={order.id}
                      href={`/dashboard/orders?id=${order.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium text-gray-900">{order.orderNumber}</span>
                          {order.customerName && (
                            <span className="text-xs text-gray-400">· {order.customerName}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {order.orderFiles?.length ?? 0} file{(order.orderFiles?.length ?? 0) !== 1 ? 's' : ''} · {formatRelativeTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getOrderStatusColor(order.status)}`}>
                          {getOrderStatusLabel(order.status)}
                        </span>
                        <p className="text-xs font-semibold text-gray-700 mt-1">₹{order.totalAmount.toFixed(0)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={downloadQR}>
                <Download className="w-4 h-4" /> Download QR Code
              </Button>
              <Link href="/dashboard/pricing">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TrendingUp className="w-4 h-4" /> Configure Pricing
                </Button>
              </Link>
              <Link href="/dashboard/printers">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Printer className="w-4 h-4" /> Manage Printers
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Printer status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Printers</CardTitle>
            </CardHeader>
            <CardContent>
              {shop?.printers?.length > 0 ? (
                shop.printers.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 py-2">
                    <div className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                    {p.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                  </div>
                ))
              ) : (
                <div className="py-4 text-center">
                  <Printer className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No printers connected</p>
                  <Link href="/dashboard/printers">
                    <Button variant="link" size="sm" className="text-xs mt-1">Set up connector →</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Your Shop QR Code</h2>
            <p className="text-sm text-gray-500 mb-4">Display this at your counter so customers can scan it.</p>
            {qrDataUrl && <img src={qrDataUrl} alt="Shop QR Code" className="w-full rounded-xl border border-gray-100" />}
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowQR(false)}>Close</Button>
              <Button className="flex-1" onClick={downloadQR}>
                <Download className="w-4 h-4 mr-2" /> Download PNG
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

