// Zustand store for the customer multi-step print order flow.
// This store is client-side only (no server state).

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Step = 'upload' | 'settings' | 'review' | 'payment' | 'confirmation'

export interface UploadedFile {
  /** Temporary client-side ID (before upload) */
  localId: string
  /** Server-assigned ID after upload */
  fileId?: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  pageCount: number
  sizeBytes: number
}

export interface FilePrintSettings {
  fileId: string
  colorMode: 'BLACK_AND_WHITE' | 'COLOR'
  sides: 'SINGLE' | 'DOUBLE'
  paperSize: 'A4' | 'A3' | 'A5' | 'LETTER' | 'LEGAL'
  orientation: 'PORTRAIT' | 'LANDSCAPE'
  copies: number
  pageRange: string // '' = all pages
  pricePerPage: number
  totalAmount: number
  effectivePages: number
}

export interface CustomerInfo {
  name: string
  phone: string
  email: string
}

export interface OrderSummary {
  orderId: string
  orderNumber: string
  totalAmount: number
  totalPages: number
  status: string
}

export interface ShopInfo {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  autoprint: boolean
  requireApproval: boolean
  maxFileSize: number
  allowedFormats: string[]
  supportsColor: boolean
  supportsDuplex: boolean
  paperSizes: string[]
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface OrderStore {
  // Current step
  currentStep: Step

  // Shop info (loaded from API)
  shop: ShopInfo | null

  // Uploaded files (client-side tracking)
  uploadedFiles: UploadedFile[]

  // Per-file print settings (keyed by fileId)
  fileSettings: Record<string, FilePrintSettings>

  // Customer contact info (optional)
  customerInfo: CustomerInfo

  // Notes
  notes: string

  // Computed order totals
  totalAmount: number
  totalPages: number

  // Confirmed order
  confirmedOrder: OrderSummary | null

  // ── Actions ──────────────────────────────────────────────────────────────

  setShop: (shop: ShopInfo) => void

  goToStep: (step: Step) => void
  goToNextStep: () => void
  goToPrevStep: () => void

  addFile: (file: UploadedFile) => void
  updateFile: (localId: string, updates: Partial<UploadedFile>) => void
  removeFile: (localId: string) => void
  clearFiles: () => void

  setFileSettings: (fileId: string, settings: FilePrintSettings) => void
  removeFileSettings: (fileId: string) => void

  setCustomerInfo: (info: Partial<CustomerInfo>) => void
  setNotes: (notes: string) => void

  recalculateTotals: () => void

  setConfirmedOrder: (order: OrderSummary) => void

  reset: () => void
}

// Step order for navigation
const STEP_ORDER: Step[] = ['upload', 'settings', 'review', 'payment', 'confirmation']

const DEFAULT_CUSTOMER_INFO: CustomerInfo = { name: '', phone: '', email: '' }

const initialState = {
  currentStep: 'upload' as Step,
  shop: null,
  uploadedFiles: [],
  fileSettings: {},
  customerInfo: DEFAULT_CUSTOMER_INFO,
  notes: '',
  totalAmount: 0,
  totalPages: 0,
  confirmedOrder: null,
}

export const useOrderStore = create<OrderStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setShop: (shop) => set({ shop }),

      goToStep: (step) => set({ currentStep: step }),

      goToNextStep: () => {
        const current = get().currentStep
        const idx = STEP_ORDER.indexOf(current)
        if (idx < STEP_ORDER.length - 1) {
          set({ currentStep: STEP_ORDER[idx + 1] })
        }
      },

      goToPrevStep: () => {
        const current = get().currentStep
        const idx = STEP_ORDER.indexOf(current)
        if (idx > 0) {
          set({ currentStep: STEP_ORDER[idx - 1] })
        }
      },

      addFile: (file) =>
        set((state) => ({ uploadedFiles: [...state.uploadedFiles, file] })),

      updateFile: (localId, updates) =>
        set((state) => ({
          uploadedFiles: state.uploadedFiles.map((f) =>
            f.localId === localId ? { ...f, ...updates } : f
          ),
        })),

      removeFile: (localId) =>
        set((state) => {
          const file = state.uploadedFiles.find((f) => f.localId === localId)
          const newSettings = { ...state.fileSettings }
          if (file?.fileId) {
            delete newSettings[file.fileId]
          }
          return {
            uploadedFiles: state.uploadedFiles.filter((f) => f.localId !== localId),
            fileSettings: newSettings,
          }
        }),

      clearFiles: () => set({ uploadedFiles: [], fileSettings: {} }),

      setFileSettings: (fileId, settings) =>
        set((state) => ({
          fileSettings: { ...state.fileSettings, [fileId]: settings },
        })),

      removeFileSettings: (fileId) =>
        set((state) => {
          const newSettings = { ...state.fileSettings }
          delete newSettings[fileId]
          return { fileSettings: newSettings }
        }),

      setCustomerInfo: (info) =>
        set((state) => ({ customerInfo: { ...state.customerInfo, ...info } })),

      setNotes: (notes) => set({ notes }),

      recalculateTotals: () => {
        const { fileSettings } = get()
        let totalAmount = 0
        let totalPages = 0
        for (const s of Object.values(fileSettings)) {
          totalAmount += s.totalAmount
          totalPages += s.effectivePages * s.copies
        }
        set({ totalAmount, totalPages })
      },

      setConfirmedOrder: (order) => set({ confirmedOrder: order }),

      reset: () => set(initialState),
    }),
    { name: 'order-store' }
  )
)

