import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: {
    default: 'MyPrint — Smart Print Shop Automation',
    template: '%s | MyPrint',
  },
  description:
    'Replace WhatsApp printing chaos with a professional QR-code-based document upload and automatic printing system for your print shop.',
  keywords: ['print shop', 'printing automation', 'QR code printing', 'document printing', 'India'],
  authors: [{ name: 'MyPrint Team' }],
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased min-h-screen bg-background font-sans text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
