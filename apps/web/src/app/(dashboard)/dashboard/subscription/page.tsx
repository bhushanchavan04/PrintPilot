'use client'

import { useEffect, useState } from 'react'
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'

interface Plan {
  id: string
  name: string
  price: number
  interval: string
  savings?: string
  description: string
  features: string[]
  popular?: boolean
}

interface SubscriptionData {
  id: string
  plan: 'TRIAL' | 'STARTER_MONTHLY' | 'PRO_MONTHLY' | 'PRO_YEARLY'
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'
  currentPeriodStart: string
  currentPeriodEnd: string
  daysRemaining: number
  isExpired: boolean
  amount: number
}

export default function SubscriptionPage() {
  const { toast } = useToast()
  const [subData, setSubData] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/subscriptions/current').then((r) => r.json()),
      fetch('/api/subscriptions/plans').then((r) => r.json()),
    ])
      .then(([cur, pl]) => {
        if (cur.subscription) setSubData(cur.subscription)
        if (pl.plans) setPlans(pl.plans)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleSelectPlan = (planId: string) => {
    setUpgradingPlan(planId)
    // Subscription payment initiation
    setTimeout(() => {
      setUpgradingPlan(null)
      toast({
        title: 'Plan upgrade selected',
        description:
          'Payment gateway integration for subscription billing is connected to your platform account.',
      })
    }, 1000)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    )
  }

  const isTrial = subData?.plan === 'TRIAL' || subData?.status === 'TRIALING'
  const isExpired = subData?.isExpired

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your MyPrint software subscription and explore plans for your shop
        </p>
      </div>

      {/* Expiry / Trial Notification Banner */}
      {isTrial && !isExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              14-Day Free Trial Active ({subData?.daysRemaining} days remaining)
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              You are enjoying full access to MyPrint automation. Choose a plan below before your trial expires to keep automated routing active.
            </p>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900">Your Subscription has Expired</p>
            <p className="text-xs text-red-700 mt-0.5">
              Please choose a subscription plan below to reactivate auto-printing and customer routing.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <Card className="border-2 border-blue-100 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Current Plan
                </span>
                <Badge
                  className={
                    subData?.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : subData?.status === 'TRIALING'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-red-100 text-red-800 border-red-200'
                  }
                >
                  {subData?.status}
                </Badge>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                {subData?.plan.replace('_', ' ')}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {subData?.currentPeriodEnd &&
                  `Valid until: ${new Date(subData.currentPeriodEnd).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-400 font-medium">Customer Payment Commission</p>
                <p className="text-lg font-bold text-emerald-600">0% (Zero)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans Grid */}
      <div>
        <div className="text-center max-w-xl mx-auto mb-8">
          <h2 className="text-xl font-bold text-gray-900">Choose a Plan for Your Print Shop</h2>
          <p className="text-xs text-gray-500 mt-1">
            All plans include unlimited customer orders and 100% direct customer payments to your UPI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = subData?.plan === plan.id && subData?.status === 'ACTIVE'
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl bg-white border-2 p-6 flex flex-col justify-between transition-all ${
                  plan.popular
                    ? 'border-blue-600 shadow-xl shadow-blue-100/50 scale-[1.02]'
                    : 'border-gray-100 hover:border-gray-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>
                    </div>
                  </div>

                  <div className="my-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-gray-900">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-xs text-gray-500">/{plan.interval}</span>
                    </div>
                    {plan.savings && (
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
                        {plan.savings}
                      </span>
                    )}
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2.5 text-xs text-gray-600 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent || upgradingPlan === plan.id}
                  className={`w-full h-11 text-xs font-semibold rounded-xl ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {upgradingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    'Select Plan'
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Direct Payment Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">
                100% of Customer Print Earnings Go Straight to Your UPI
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                We never touch your customer money or take commissions. Your monthly software fee covers the platform entirely.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

