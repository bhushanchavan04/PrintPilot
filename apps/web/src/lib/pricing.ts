// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrintSettingsInput {
  colorMode: 'BLACK_AND_WHITE' | 'COLOR'
  sides: 'SINGLE' | 'DOUBLE'
  paperSize: 'A4' | 'A3' | 'A5' | 'LETTER' | 'LEGAL'
  copies: number
  pageCount: number     // total pages in document
  pageRange?: string    // e.g. "1-5,8,10-12" — null means all pages
}

export interface PricingRule {
  paperSize: string
  colorMode: string
  sides: string
  pricePerPage: number
}

export interface PriceBreakdown {
  effectivePages: number        // pages after applying range
  effectivePrintPages: number   // physical pages considering duplex
  copies: number
  pricePerPage: number
  subtotal: number
  total: number
  breakdown: string             // human-readable
}

// ─── Default Pricing ──────────────────────────────────────────────────────────

export const DEFAULT_PRICING_RULES: PricingRule[] = [
  { paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: 2 },
  { paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'DOUBLE', pricePerPage: 1.5 },
  { paperSize: 'A4', colorMode: 'COLOR',           sides: 'SINGLE', pricePerPage: 10 },
  { paperSize: 'A4', colorMode: 'COLOR',           sides: 'DOUBLE', pricePerPage: 8 },
  { paperSize: 'A3', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: 4 },
  { paperSize: 'A3', colorMode: 'BLACK_AND_WHITE', sides: 'DOUBLE', pricePerPage: 3 },
  { paperSize: 'A3', colorMode: 'COLOR',           sides: 'SINGLE', pricePerPage: 20 },
  { paperSize: 'A3', colorMode: 'COLOR',           sides: 'DOUBLE', pricePerPage: 16 },
]

// ─── Page Range Parser ────────────────────────────────────────────────────────

/**
 * Parse a page range string like "1-5,8,10-12" into an array of 1-based page numbers.
 */
export function parsePageRange(range: string, totalPages: number): number[] {
  if (!range || !range.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>()
  const parts = range.split(',').map(p => p.trim())

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
          pages.add(p)
        }
      }
    } else {
      const p = parseInt(part, 10)
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p)
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b)
}

/**
 * Calculate effective physical page count (sheets of paper) considering duplex.
 */
export function getEffectivePageCount(pageNumbers: number[], sides: string): number {
  const numPages = pageNumbers.length
  if (numPages === 0) return 0
  if (sides === 'DOUBLE') {
    return Math.ceil(numPages / 2)
  }
  return numPages
}

// ─── Main Calculator ──────────────────────────────────────────────────────────

/**
 * Calculate price for a single file with given settings and pricing rules.
 */
export function calculatePrice(
  settings: PrintSettingsInput,
  rules: PricingRule[]
): PriceBreakdown {
  const {
    colorMode,
    sides,
    paperSize,
    copies,
    pageCount,
    pageRange,
  } = settings

  // Safety checks
  const safeCopies = Math.max(1, Math.floor(copies || 1))
  const safePageCount = Math.max(0, Math.floor(pageCount || 0))

  // Find matching rule
  const rule = rules.find(
    r =>
      r.paperSize === paperSize &&
      r.colorMode === colorMode &&
      r.sides === sides
  )

  const pricePerPage = rule?.pricePerPage ?? (colorMode === 'COLOR' ? 10 : 2)

  // Calculate effective pages
  const selectedPages = parsePageRange(pageRange || '', safePageCount)
  const effectivePages = selectedPages.length
  const effectivePrintPages = getEffectivePageCount(selectedPages, sides)

  // Cost = physical pages * copies * pricePerPage
  const subtotal = effectivePrintPages * safeCopies * pricePerPage
  const total = subtotal

  const sidesLabel = sides === 'DOUBLE' ? 'duplex' : 'single-sided'
  const colorLabel = colorMode === 'BLACK_AND_WHITE' ? 'B&W' : 'Colour'
  const breakdown = `${effectivePages} page${effectivePages !== 1 ? 's' : ''} × ${safeCopies} cop${safeCopies !== 1 ? 'ies' : 'y'} (${sidesLabel}, ${colorLabel}) @ ₹${pricePerPage}/page = ₹${total.toFixed(2)}`

  return {
    effectivePages,
    effectivePrintPages,
    copies: safeCopies,
    pricePerPage,
    subtotal,
    total,
    breakdown,
  }
}

/**
 * Calculate total price for multiple files.
 */
export function calculateOrderTotal(
  files: Array<{ settings: PrintSettingsInput }>,
  rules: PricingRule[]
): { breakdown: PriceBreakdown[]; total: number } {
  const breakdown = files.map(f => calculatePrice(f.settings, rules))
  const total = breakdown.reduce((sum, b) => sum + b.total, 0)
  return { breakdown, total }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`
}

