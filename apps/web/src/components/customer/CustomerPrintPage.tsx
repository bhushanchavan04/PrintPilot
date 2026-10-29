'use client'

import { useState, useEffect } from 'react'
import { Printer, CheckCircle } from 'lucide-react'
import { UploadStep } from '@/components/customer/UploadStep'
import { PrintSettingsStep } from '@/components/customer/PrintSettingsStep'
import { ReviewStep } from '@/components/customer/ReviewStep'
import { PaymentStep } from '@/components/customer/PaymentStep'
import { ConfirmationStep } from '@/components/customer/ConfirmationStep'
import type { UploadedFile, FileWithSettings, Shop } from '@/types'

interface CustomerPrintPageProps {
  shopSlug: string
}

const STEPS = ['Upload', 'Settings', 'Review', 'Payment', 'Done']

export function CustomerPrintPage({ shopSlug }: CustomerPrintPageProps) {
  const [step, setStep] = useState(0)
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [fileSettings, setFileSettings] = useState<FileWithSettings[]>([])
  const [orderId, setOrderId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [orderAmount, setOrderAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/shops/${shopSlug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.shop) setShop(d.shop)
        else setError('Shop not found or unavailable')
      })
      .catch(() => setError('Failed to load shop'))
      .finally(() => setLoading(false))
  }, [shopSlug])

  const handleCreateOrder = async (customerInfo: { name?: string; phone?: string; email?: string }) => {
    setIsSubmitting(true)
    try {
      const uploadedFiles = fileSettings.filter((f) => f.status === 'uploaded')
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop!.id,
          customerName: customerInfo.name || undefined,
          customerPhone: customerInfo.phone || undefined,
          customerEmail: customerInfo.email || undefined,
          fileIds: uploadedFiles.map((f) => f.id),
          printSettings: uploadedFiles.map((f) => ({
            fileId: f.id,
            settings: f.settings,
          })),
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to create order')
      }

      const data = await res.json()
      setOrderId(data.order.id)
      setOrderNumber(data.order.orderNumber)
      setOrderAmount(data.order.totalAmount)
      setStep(3) // Go to payment
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Printer className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Shop not found</h1>
          <p className="text-sm text-gray-500">{error || 'This print shop is not available.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{shop.name}</p>
              <p className="text-xs text-gray-500">Print service</p>
            </div>
          </div>

          {/* Step progress */}
          {step < 4 && (
            <div className="flex items-center gap-1">
              {STEPS.slice(0, 4).map((s, i) => (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`w-full h-1.5 rounded-full transition-all ${
                      i < step ? 'bg-blue-600' : i === step ? 'bg-blue-400' : 'bg-gray-200'
                    }`}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between mt-1">
            {STEPS.slice(0, 4).map((s, i) => (
              <span
                key={s}
                className={`text-xs ${i === step ? 'text-blue-600 font-medium' : i < step ? 'text-blue-400' : 'text-gray-400'}`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4 pb-24">
        {step === 0 && (
          <UploadStep
            shopId={shop.slug}
            files={files}
            onFilesChange={setFiles}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <PrintSettingsStep
            shopId={shop.slug}
            files={files}
            fileSettings={fileSettings}
            onSettingsChange={setFileSettings}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            shopConfig={{
              supportsColor: (shop as any).supportsColor,
              supportsDuplex: (shop as any).supportsDuplex,
              paperSizes: (shop as any).paperSizes,
            }}
          />
        )}

        {step === 2 && (
          <ReviewStep
            files={fileSettings}
            shopId={shop.id}
            onConfirm={handleCreateOrder}
            onBack={() => setStep(1)}
            isSubmitting={isSubmitting}
          />
        )}

        {step === 3 && (
          <PaymentStep
            orderId={orderId}
            orderNumber={orderNumber}
            amount={orderAmount}
            shopUpiId={shop.upiId ?? undefined}
            shopUpiName={shop.upiName ?? undefined}
            shopName={shop.name}
            acceptCashAtCounter={shop.acceptCashAtCounter ?? true}
            onPaymentSuccess={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <ConfirmationStep
            orderId={orderId}
            orderNumber={orderNumber}
            shopName={shop.name}
          />
        )}
      </div>
    </div>
  )
}

