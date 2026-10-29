'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { QrCode, Download, RefreshCw, Shield, Clock, FileText, Smartphone, IndianRupee } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { shopSchema, type ShopInput } from '@/lib/validations'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { toast } = useToast()
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [activeTab, setActiveTab] = useState<'general' | 'printing' | 'payment' | 'qr'>('general')

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ShopInput>({
    resolver: zodResolver(shopSchema),
  })

  const autoprint = watch('autoprint')
  const requireApproval = watch('requireApproval')
  const acceptCashAtCounter = watch('acceptCashAtCounter') ?? true

  useEffect(() => {
    Promise.all([
      fetch('/api/shops').then(r => r.json()),
      fetch('/api/qr').then(r => r.json()),
    ]).then(([shopData, qrData]) => {
      if (shopData.shop) {
        setShop(shopData.shop)
        reset({
          name: shopData.shop.name,
          description: shopData.shop.description ?? '',
          address: shopData.shop.address ?? '',
          city: shopData.shop.city ?? '',
          state: shopData.shop.state ?? '',
          pincode: shopData.shop.pincode ?? '',
          phone: shopData.shop.phone ?? '',
          email: shopData.shop.email ?? '',
          website: shopData.shop.website ?? '',
          autoprint: shopData.shop.autoprint,
          requireApproval: shopData.shop.requireApproval,
          documentRetention: shopData.shop.documentRetention,
          maxFileSize: shopData.shop.maxFileSize,
          upiId: shopData.shop.upiId ?? '',
          upiName: shopData.shop.upiName ?? '',
          acceptCashAtCounter: shopData.shop.acceptCashAtCounter ?? true,
        })
      }
      if (qrData.qrDataUrl) setQrDataUrl(qrData.qrDataUrl)
    }).finally(() => setLoading(false))
  }, [])

  const onSubmit = async (data: ShopInput) => {
    setSaving(true)
    try {
      const res = await fetch('/api/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast({ title: 'Settings saved successfully' })
      } else {
        const d = await res.json()
        toast({ variant: 'destructive', title: 'Save failed', description: d.error })
      }
    } finally {
      setSaving(false)
    }
  }

  const regenerateQR = async () => {
    if (!confirm('Regenerate QR code? The old QR will still work (same URL).')) return
    const res = await fetch('/api/qr', { method: 'POST' })
    const d = await res.json()
    if (d.qrDataUrl) {
      setQrDataUrl(d.qrDataUrl)
      toast({ title: 'QR code regenerated' })
    }
  }

  const downloadQR = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `myprint-qr-${shop?.slug}.png`
    a.click()
  }

  if (loading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-gray-200 rounded" /></div></div>

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'printing', label: 'Printing' },
    { id: 'payment', label: 'Direct Payments' },
    { id: 'qr', label: 'QR Code' },
  ] as const

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Shop Settings</h1>
        <p className="text-sm text-gray-500">Configure your print shop details and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* General Tab */}
        {activeTab === 'general' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shop Information</CardTitle>
              <CardDescription>This information is shown to customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Shop Name *</Label>
                  <Input {...register('name')} placeholder="Your shop name" />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Description</Label>
                  <Input {...register('description')} placeholder="Brief description of your shop" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Address</Label>
                  <Input {...register('address')} placeholder="Street address" />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input {...register('city')} placeholder="City" />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input {...register('state')} placeholder="State" />
                </div>
                <div className="space-y-1.5">
                  <Label>PIN Code</Label>
                  <Input {...register('pincode')} placeholder="PIN code" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input {...register('phone')} placeholder="Contact number" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input {...register('email')} placeholder="shop@example.com" type="email" />
                </div>
              </div>
              <div className="pt-2">
                <Button type="submit" loading={saving}>Save General Settings</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Printing Tab */}
        {activeTab === 'printing' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Print Workflow</CardTitle>
                <CardDescription>Control how print jobs are processed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Require Approval</p>
                    <p className="text-xs text-gray-500 mt-0.5">Manually review each order before sending to printer</p>
                  </div>
                  <Switch
                    checked={requireApproval}
                    onCheckedChange={v => setValue('requireApproval', v)}
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Auto-Print</p>
                    <p className="text-xs text-gray-500 mt-0.5">Automatically print after payment verification (connector must be running)</p>
                  </div>
                  <Switch
                    checked={autoprint}
                    onCheckedChange={v => setValue('autoprint', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">File Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Max File Size (MB)</Label>
                    <Input {...register('maxFileSize', { valueAsNumber: true })} type="number" min="1" max="200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Document Retention (hours)</Label>
                    <Input {...register('documentRetention', { valueAsNumber: true })} type="number" min="1" max="168" />
                    <p className="text-xs text-gray-400">Files deleted after this many hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex gap-2">
                <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">Privacy & Security</p>
                  <p className="text-xs text-blue-700 mt-0.5">Documents are stored with short-lived signed URLs and automatically deleted after the retention period. No public access to customer documents.</p>
                </div>
              </div>
            </div>

            <Button type="submit" loading={saving}>Save Printing Settings</Button>
          </div>
        )}

        {/* Direct Payment Tab */}
        {activeTab === 'payment' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Direct Customer Payments (0% Commission)</CardTitle>
                <CardDescription>
                  Customer print fees go directly to your personal or business UPI account. Our platform charges 0% commission on your print earnings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Shopkeeper UPI ID</Label>
                  <Input
                    {...register('upiId')}
                    placeholder="e.g. yourname@oksbi, shop@icici, 9876543210@paytm"
                  />
                  <p className="text-xs text-gray-500">
                    Customers will scan a QR code with this UPI ID to pay you directly.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Payee Name</Label>
                  <Input
                    {...register('upiName')}
                    placeholder="e.g. Pooja Digital Prints or Pooja Sharma"
                  />
                  <p className="text-xs text-gray-500">
                    Display name shown inside Google Pay / PhonePe when customer scans.
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Accept Cash at Counter</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Allow walk-in customers to choose "Pay Cash at Counter" instead of UPI
                    </p>
                  </div>
                  <Switch
                    checked={acceptCashAtCounter}
                    onCheckedChange={(v) => setValue('acceptCashAtCounter', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex gap-2.5">
                <IndianRupee className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">Direct Settlement Guarantee</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your customers pay into your bank account instantly via UPI. We do not hold your money, deduct marketplace percentages, or delay payouts.
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" loading={saving}>Save Payment Settings</Button>
          </div>
        )}
      </form>

      {/* QR Code Tab */}
      {activeTab === 'qr' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Shop QR Code</CardTitle>
              <CardDescription>Display this at your counter so customers can scan it</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <img src={qrDataUrl} alt="Shop QR Code" className="w-48 h-48 rounded-xl border-4 border-gray-100" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">Customer URL</p>
                    <a
                      href={`/print/${shop?.slug}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline break-all"
                    >
                      {typeof window !== 'undefined' ? window.location.origin : ''}/print/{shop?.slug}
                    </a>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={regenerateQR}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                    </Button>
                    <Button onClick={downloadQR}>
                      <Download className="w-4 h-4 mr-2" /> Download PNG
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Loading QR code…</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Printing Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span>•</span>Print the QR at A5 or A4 size and laminate it</li>
                <li className="flex gap-2"><span>•</span>Place it on the counter, near the entrance, or on your signboard</li>
                <li className="flex gap-2"><span>•</span>Add text: "Scan to print your documents instantly"</li>
                <li className="flex gap-2"><span>•</span>Test by scanning with a phone before displaying</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

