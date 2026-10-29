import { NextResponse } from 'next/server'

export async function GET() {
  const plans = [
    {
      id: 'STARTER_MONTHLY',
      name: 'Starter Monthly',
      price: 299,
      interval: 'month',
      description: 'Ideal for small single-counter xerox and stationery shops.',
      features: [
        '1 Connected Printer / Tablet',
        'Direct UPI & Cash Payments (0% commission)',
        'Unique Shop QR Code',
        'Customer Web Upload Portal',
        'Standard Support',
      ],
      popular: false,
    },
    {
      id: 'PRO_MONTHLY',
      name: 'Pro Monthly',
      price: 599,
      interval: 'month',
      description: 'Perfect for busy digital print centers and commercial shops.',
      features: [
        'Up to 3 Connected Printers / Tablets',
        'Direct UPI & Cash Payments (0% commission)',
        'Auto-Print & Approval Workflows',
        'Real-Time Job Notifications',
        'Priority Phone & Chat Support',
      ],
      popular: true,
    },
    {
      id: 'PRO_YEARLY',
      name: 'Pro Yearly',
      price: 4999,
      interval: 'year',
      savings: 'Save over 30%',
      description: 'Maximum value for established print businesses.',
      features: [
        'Unlimited Connected Printers / Tablets',
        'Direct UPI & Cash Payments (0% commission)',
        'Auto-Print & Custom Rules',
        'Comprehensive Analytics & Reports',
        'Dedicated VIP Support & Setup',
      ],
      popular: false,
    },
  ]

  return NextResponse.json({ plans })
}

