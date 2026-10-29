'use client'

import { useState } from 'react'
import { FileText, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatFileSize } from '@/lib/utils'
import type { FileWithSettings } from '@/types'

interface ReviewStepProps {
  files: FileWithSettings[]
  shopId: string
  onConfirm: (customerInfo: { name?: string; phone?: string; email?: string }) => Promise<void>
  onBack: () => void
  isSubmitting: boolean
}

export function ReviewStep({ files, shopId, onConfirm, onBack, isSubmitting }: ReviewStepProps) {
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' })

  const totalAmount = files.reduce((sum, f) => sum + (f.calculatedPrice ?? 0), 0)
  const totalPages = files.reduce((sum, f) => sum + f.pageCount * f.settings.copies, 0)

  const colorLabel = (mode: string) => mode === 'COLOR' ? 'Colour' : 'B&W'
  const sidesLabel = (s: string) => s === 'DOUBLE' ? 'Duplex' : 'Single'

  return (
    <div className="space-y-6">
      {/* Files summary */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Files & Print Settings</h3>
        </div>
        {files.map((file, i) => (
          <div key={file.id} className={`p-4 ${i < files.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {file.pageCount} pages
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {colorLabel(file.settings.colorMode)}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {sidesLabel(file.settings.sides)}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {file.settings.copies}× copies
                  </span>
                  {file.settings.pageRange && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      Pages: {file.settings.pageRange}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                {formatCurrency(file.calculatedPrice ?? 0)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Price total */}
      <div className="bg-blue-600 rounded-2xl p-5 text-white">
        <div className="flex justify-between items-center mb-2">
          <span className="text-blue-100 text-sm">{files.length} file{files.length !== 1 ? 's' : ''} · {totalPages} total pages</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">Total Amount</span>
          <span className="text-3xl font-bold">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Optional customer info */}
      <div className="border border-gray-100 rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Your details <span className="text-gray-400 font-normal">(optional)</span></h3>
        <div className="space-y-3">
          <div>
            <Label htmlFor="name" className="text-xs">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo((c) => ({ ...c, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="phone" className="text-xs">Phone</Label>
            <Input
              id="phone"
              placeholder="10-digit mobile number"
              type="tel"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo((c) => ({ ...c, phone: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={isSubmitting}>Back</Button>
        <Button
          onClick={() => onConfirm(customerInfo)}
          className="flex-1 flex-grow-[2]"
          loading={isSubmitting}
          size="lg"
        >
          Confirm & Pay {formatCurrency(totalAmount)}
        </Button>
      </div>
    </div>
  )
}

