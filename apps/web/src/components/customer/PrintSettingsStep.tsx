'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/pricing'
import type { UploadedFile, FileWithSettings } from '@/types'

interface PrintSettingsStepProps {
  shopId: string
  files: UploadedFile[]
  fileSettings: FileWithSettings[]
  onSettingsChange: (settings: FileWithSettings[]) => void
  onNext: () => void
  onBack: () => void
  shopConfig?: { supportsColor?: boolean; supportsDuplex?: boolean; paperSizes?: string[] }
}

const defaultSettings = {
  colorMode: 'BLACK_AND_WHITE' as const,
  sides: 'SINGLE' as const,
  paperSize: 'A4' as const,
  orientation: 'PORTRAIT' as const,
  copies: 1,
  pageRange: '',
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function PrintSettingsStep({
  shopId,
  files,
  fileSettings,
  onSettingsChange,
  onNext,
  onBack,
  shopConfig,
}: PrintSettingsStepProps) {
  const [calculating, setCalculating] = useState<Record<string, boolean>>({})

  const uploadedFiles = files.filter((f) => f.status === 'uploaded')

  // Initialize settings for all files
  useEffect(() => {
    if (fileSettings.length !== uploadedFiles.length) {
      const initial: FileWithSettings[] = uploadedFiles.map((f) => ({
        ...f,
        settings: { ...defaultSettings },
        calculatedPrice: undefined,
      }))
      onSettingsChange(initial)
    }
  }, [uploadedFiles.length])

  const updateSetting = useCallback(
    async (fileId: string, key: string, value: any) => {
      const updated = fileSettings.map((fs) =>
        fs.id === fileId
          ? { ...fs, settings: { ...fs.settings, [key]: value } }
          : fs
      )
      onSettingsChange(updated)

      // Recalculate price
      setCalculating((c) => ({ ...c, [fileId]: true }))
      try {
        const file = updated.find((f) => f.id === fileId)
        if (!file) return
        const res = await fetch('/api/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            files: [{ fileId, pageCount: file.pageCount, settings: file.settings }],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const price = data.breakdown?.[0]?.total ?? 0
          onSettingsChange(updated.map((f) => (f.id === fileId ? { ...f, calculatedPrice: price } : f)))
        }
      } catch {}
      setCalculating((c) => ({ ...c, [fileId]: false }))
    },
    [fileSettings, onSettingsChange, shopId]
  )

  const totalPrice = fileSettings.reduce((sum, f) => sum + (f.calculatedPrice ?? 0), 0)

  return (
    <div className="space-y-6">
      {fileSettings.map((file) => (
        <div key={file.id} className="border border-gray-100 rounded-2xl overflow-hidden">
          {/* File header */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
              <p className="text-xs text-gray-500">{file.pageCount} pages</p>
            </div>
            <div className="text-right flex-shrink-0">
              {calculating[file.id] ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              ) : (
                <span className="text-sm font-bold text-blue-600">
                  {formatCurrency(file.calculatedPrice ?? 0)}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Color mode */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Print type</label>
              <ToggleGroup
                value={file.settings.colorMode}
                onChange={(v) => updateSetting(file.id, 'colorMode', v)}
                options={[
                  { label: 'Black & White', value: 'BLACK_AND_WHITE' },
                  ...(shopConfig?.supportsColor !== false ? [{ label: 'Colour', value: 'COLOR' }] : []),
                ]}
              />
            </div>

            {/* Sides */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sides</label>
              <ToggleGroup
                value={file.settings.sides}
                onChange={(v) => updateSetting(file.id, 'sides', v)}
                options={[
                  { label: 'Single-sided', value: 'SINGLE' },
                  ...(shopConfig?.supportsDuplex !== false ? [{ label: 'Double-sided', value: 'DOUBLE' }] : []),
                ]}
              />
            </div>

            {/* Copies + Page range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Copies</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSetting(file.id, 'copies', Math.max(1, file.settings.copies - 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{file.settings.copies}</span>
                  <button
                    onClick={() => updateSetting(file.id, 'copies', Math.min(99, file.settings.copies + 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Pages</label>
                <input
                  type="text"
                  placeholder="e.g. 1-5, 8"
                  value={file.settings.pageRange}
                  onChange={(e) => updateSetting(file.id, 'pageRange', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Total */}
      <div className="bg-blue-50 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Estimated total</span>
          <span className="text-2xl font-bold text-blue-700">{formatCurrency(totalPrice)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Final price confirmed at checkout</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={onNext} className="flex-1 flex-grow-[2]">
          Review Order
        </Button>
      </div>
    </div>
  )
}

