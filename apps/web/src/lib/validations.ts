import { z } from 'zod'

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const shopSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  autoprint: z.boolean().default(false),
  requireApproval: z.boolean().default(true),
  documentRetention: z.number().min(1).max(168).default(24),
  maxFileSize: z.number().min(1).max(200).default(50),
  // Payment settings
  upiId: z.string().optional().or(z.literal('')),
  upiName: z.string().optional().or(z.literal('')),
  acceptCashAtCounter: z.boolean().default(true),
})

export const pricingRuleSchema = z.object({
  paperSize: z.enum(['A4', 'A3', 'A5', 'LETTER', 'LEGAL']),
  colorMode: z.enum(['BLACK_AND_WHITE', 'COLOR']),
  sides: z.enum(['SINGLE', 'DOUBLE']),
  pricePerPage: z.number().min(0.1).max(1000),
})

export const printSettingsSchema = z.object({
  colorMode: z.enum(['BLACK_AND_WHITE', 'COLOR']).default('BLACK_AND_WHITE'),
  sides: z.enum(['SINGLE', 'DOUBLE']).default('SINGLE'),
  paperSize: z.enum(['A4', 'A3', 'A5', 'LETTER', 'LEGAL']).default('A4'),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).default('PORTRAIT'),
  copies: z.number().min(1).max(99).default(1),
  pageRange: z.string().optional(),
})

export const orderCreateSchema = z.object({
  shopId: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  fileIds: z.array(z.string()).min(1, 'At least one file is required'),
  printSettings: z.array(
    z.object({
      fileId: z.string(),
      settings: printSettingsSchema,
    })
  ),
})

export const printerSchema = z.object({
  name: z.string().min(1),
  systemName: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  supportsColor: z.boolean().default(false),
  supportsDuplex: z.boolean().default(false),
  paperSizes: z.array(z.enum(['A4', 'A3', 'A5', 'LETTER', 'LEGAL'])).default(['A4']),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ShopInput = z.infer<typeof shopSchema>
export type PricingRuleInput = z.infer<typeof pricingRuleSchema>
export type PrintSettingsInput = z.infer<typeof printSettingsSchema>
export type OrderCreateInput = z.infer<typeof orderCreateSchema>
export type PrinterInput = z.infer<typeof printerSchema>
export type SubscriptionPlan = 'TRIAL' | 'STARTER_MONTHLY' | 'PRO_MONTHLY' | 'PRO_YEARLY'
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'

