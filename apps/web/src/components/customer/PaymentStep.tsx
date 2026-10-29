'use client'

import { useState, useEffect } from 'react'
import { Shield, Smartphone, Loader2, CheckCircle, Banknote, ArrowLeft, ExternalLink, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import QRCode from 'qrcode'

interface PaymentStepProps {
  orderId: string
  orderNumber: string
  amount: number
  shopUpiId?: string
  shopUpiName?: string
  shopName: string
  acceptCashAtCounter?: boolean
  onPaymentSuccess: () => void
  onBack: () => void
}

export function PaymentStep({
  orderId,
  orderNumber,
  amount,
  shopUpiId,
  shopUpiName,
  shopName,
  acceptCashAtCounter = true,
  onPaymentSuccess,
  onBack,
}: PaymentStepProps) {
  const [step, setStep] = useState<'pay' | 'verifying' | 'done'>('pay')
  const [paymentMode, setPaymentMode] = useState<'upi' | 'cash' | 'mock'>('upi')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const activeUpiId = shopUpiId || ''
  const payeeName = shopUpiName || shopName || 'Print Shop'

  // Standard NPCI UPI URI
  const upiUri = activeUpiId
    ? `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Print_${orderNumber}`)}`
    : ''

  // Generate QR code data URL whenever upiUri changes
  useEffect(() => {
    if (activeUpiId && upiUri) {
      QRCode.toDataURL(upiUri, {
        width: 300,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Failed to generate UPI QR:', err))
    }
  }, [activeUpiId, upiUri])

  const copyUpiId = () => {
    if (!activeUpiId) return
    navigator.clipboard.writeText(activeUpiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const completePayment = async (method: 'UPI' | 'CASH' | 'MOCK') => {
    setIsProcessing(true)
    setStep('verifying')
    setError('')

    try {
      // 1. Initiate payment record
      const initRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, method }),
      })

      if (!initRes.ok) {
        const d = await initRes.json()
        // If already initiated, proceed to verify
        if (initRes.status !== 409) {
          throw new Error(d.error ?? 'Failed to initiate payment')
        }
      }

      // 2. Short pause for pleasant UX
      await new Promise((r) => setTimeout(r, 1200))

      // 3. Verify and transition order to PRINTING
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })

      if (!verifyRes.ok) {
        const d = await verifyRes.json()
        throw new Error(d.error ?? 'Payment confirmation failed')
      }

      setStep('done')
      setTimeout(onPaymentSuccess, 1000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStep('pay')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Order reference summary */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-medium">Order Number</p>
            <p className="text-base font-bold text-gray-900">{orderNumber}</p>
            <p className="text-xs text-gray-400 mt-0.5">Payable to: {shopName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
            <p className="text-2xl font-extrabold text-blue-600">{formatCurrency(amount)}</p>
          </div>
        </div>
      </div>

      {step === 'pay' && (
        <div className="space-y-4">
          {/* Payment Method Selector Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setPaymentMode('upi')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                paymentMode === 'upi'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Direct UPI (0% Fee)
            </button>

            {acceptCashAtCounter && (
              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'cash'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                Pay Cash
              </button>
            )}

            {/* Dev mode tab for easy local testing */}
            <button
              type="button"
              onClick={() => setPaymentMode('mock')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                paymentMode === 'mock'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-orange-600 hover:bg-orange-50'
              }`}
            >
              Simulate
            </button>
          </div>

          {/* UPI Direct View */}
          {paymentMode === 'upi' && (
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-center space-y-4 shadow-sm">
              {activeUpiId ? (
                <>
                  <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    Direct 100% Payment to {shopName}
                  </div>

                  {qrCodeDataUrl ? (
                    <div className="flex flex-col items-center">
                      <div className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <img
                          src={qrCodeDataUrl}
                          alt="Shopkeeper UPI QR Code"
                          className="w-52 h-52 object-contain"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Scan using Google Pay, PhonePe, Paytm, or BHIM
                      </p>
                    </div>
                  ) : (
                    <div className="w-52 h-52 mx-auto flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  )}

                  {/* UPI Details Box */}
                  <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Shop UPI ID:</span>
                      <button
                        onClick={copyUpiId}
                        className="flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                      >
                        <span>{activeUpiId}</span>
                        {copiedUpi ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span>Payee:</span>
                      <span className="font-medium text-gray-700">{payeeName}</span>
                    </div>
                  </div>

                  {/* Mobile Deep Link */}
                  {upiUri && (
                    <a
                      href={upiUri}
                      className="inline-flex sm:hidden w-full items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
                    >
                      <Smartphone className="w-4 h-4" />
                      Open in UPI App
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>
                  )}

                  <Button
                    onClick={() => completePayment('UPI')}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-sm font-semibold rounded-xl"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    I have paid {formatCurrency(amount)}
                  </Button>
                </>
              ) : (
                <div className="py-6 space-y-3">
                  <Smartphone className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-800">No UPI ID set by shopkeeper</p>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    The shopkeeper has not configured their direct UPI ID yet. You can pay with cash at the counter or test using Simulation mode.
                  </p>
                  {acceptCashAtCounter && (
                    <Button
                      onClick={() => setPaymentMode('cash')}
                      variant="outline"
                      className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                    >
                      Pay Cash at Counter
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cash Payment View */}
          {paymentMode === 'cash' && (
            <div className="bg-white border-2 border-emerald-100 rounded-2xl p-6 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Pay at the Counter</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Please show your Order #{orderNumber} and hand over {formatCurrency(amount)} cash to the shopkeeper.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
                💵 Your print job will be sent to the shopkeeper's printer queue.
              </div>

              <Button
                onClick={() => completePayment('CASH')}
                disabled={isProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-sm font-semibold rounded-xl"
              >
                Confirm Cash Order
              </Button>
            </div>
          )}

          {/* Mock Simulation View */}
          {paymentMode === 'mock' && (
            <div className="bg-orange-50 border-2 border-dashed border-orange-300 rounded-2xl p-5 text-center space-y-3">
              <span className="text-xs bg-orange-100 text-orange-800 px-2.5 py-1 rounded font-bold">
                DEV / TESTING MODE
              </span>
              <p className="text-xs text-orange-700">
                Simulates instant successful payment without real money. Use this to verify print jobs and tablet receiver.
              </p>
              <Button
                onClick={() => completePayment('MOCK')}
                disabled={isProcessing}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium"
              >
                Simulate Successful Payment
              </Button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 text-center bg-red-50 p-2.5 rounded-xl border border-red-100">
              {error}
            </p>
          )}

          <button
            onClick={onBack}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 flex items-center justify-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to review
          </button>
        </div>
      )}

      {step === 'verifying' && (
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center space-y-3 shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm font-bold text-gray-900">Routing Order to Printer...</p>
          <p className="text-xs text-gray-400">Notifying shopkeeper and preparing documents</p>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center space-y-3 shadow-sm">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <p className="text-base font-bold text-gray-900">Order Placed Successfully!</p>
          <p className="text-xs text-gray-500">Redirecting to order confirmation...</p>
        </div>
      )}
    </div>
  )
}
