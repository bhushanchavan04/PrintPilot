'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const PAPER_SIZES = ['A4', 'A3', 'A5', 'LETTER', 'LEGAL']
const COLOR_MODES = [{ value: 'BLACK_AND_WHITE', label: 'Black & White' }, { value: 'COLOR', label: 'Colour' }]
const SIDES = [{ value: 'SINGLE', label: 'Single-sided' }, { value: 'DOUBLE', label: 'Double-sided / Duplex' }]

function RuleRow({ rule, onUpdate, onDelete }: { rule: any; onUpdate: (id: string, price: number) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(String(rule.pricePerPage))

  const save = () => {
    const n = parseFloat(price)
    if (isNaN(n) || n <= 0) return
    onUpdate(rule.id, n)
    setEditing(false)
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-5 py-3 text-sm text-gray-700 font-medium">{rule.paperSize}</td>
      <td className="px-3 py-3 text-sm text-gray-700">
        {rule.colorMode === 'BLACK_AND_WHITE' ? 'Black & White' : 'Colour'}
      </td>
      <td className="px-3 py-3 text-sm text-gray-700 hidden sm:table-cell">
        {rule.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'}
      </td>
      <td className="px-3 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">₹</span>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-20 text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.5"
              min="0.1"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            />
          </div>
        ) : (
          <span className="text-sm font-bold text-gray-900">₹{rule.pricePerPage}/page</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button onClick={save} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setEditing(false); setPrice(String(rule.pricePerPage)) }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => onDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function PricingPage() {
  const { toast } = useToast()
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newRule, setNewRule] = useState({ paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: '2' })
  const [saving, setSaving] = useState(false)

  const fetchRules = async () => {
    const res = await fetch('/api/pricing')
    const d = await res.json()
    if (d.rules) setRules(d.rules)
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  const handleUpdate = async (id: string, pricePerPage: number) => {
    const res = await fetch(`/api/pricing/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricePerPage }),
    })
    if (res.ok) {
      setRules(r => r.map(rule => rule.id === id ? { ...rule, pricePerPage } : rule))
      toast({ title: 'Price updated' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pricing rule?')) return
    const res = await fetch(`/api/pricing/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRules(r => r.filter(rule => rule.id !== id))
      toast({ title: 'Rule deleted' })
    }
  }

  const handleAdd = async () => {
    setSaving(true)
    const res = await fetch('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRule, pricePerPage: parseFloat(newRule.pricePerPage) }),
    })
    if (res.ok) {
      await fetchRules()
      setShowAdd(false)
      setNewRule({ paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: '2' })
      toast({ title: 'Pricing rule added' })
    } else {
      const d = await res.json()
      toast({ variant: 'destructive', title: 'Error', description: d.error })
    }
    setSaving(false)
  }

  const resetToDefaults = async () => {
    if (!confirm('Reset all pricing to Indian defaults? This will overwrite your current rates.')) return
    const defaults = [
      { paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: 2 },
      { paperSize: 'A4', colorMode: 'BLACK_AND_WHITE', sides: 'DOUBLE', pricePerPage: 1.5 },
      { paperSize: 'A4', colorMode: 'COLOR', sides: 'SINGLE', pricePerPage: 10 },
      { paperSize: 'A4', colorMode: 'COLOR', sides: 'DOUBLE', pricePerPage: 8 },
      { paperSize: 'A3', colorMode: 'BLACK_AND_WHITE', sides: 'SINGLE', pricePerPage: 4 },
      { paperSize: 'A3', colorMode: 'COLOR', sides: 'SINGLE', pricePerPage: 20 },
    ]
    for (const r of defaults) {
      await fetch('/api/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
    }
    await fetchRules()
    toast({ title: 'Pricing reset to defaults' })
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pricing Rules</h1>
          <p className="text-sm text-gray-500">Set per-page rates for your shop</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="w-4 h-4 mr-1" /> Defaults
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Rule
          </Button>
        </div>
      </div>

      {/* Add rule form */}
      {showAdd && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Pricing Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Paper Size</label>
                <select value={newRule.paperSize} onChange={e => setNewRule(r => ({ ...r, paperSize: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Color Mode</label>
                <select value={newRule.colorMode} onChange={e => setNewRule(r => ({ ...r, colorMode: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {COLOR_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sides</label>
                <select value={newRule.sides} onChange={e => setNewRule(r => ({ ...r, sides: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SIDES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Price per page (₹)</label>
                <input type="number" value={newRule.pricePerPage} onChange={e => setNewRule(r => ({ ...r, pricePerPage: e.target.value }))}
                  step="0.5" min="0.1"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleAdd}>Save Rule</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">No pricing rules configured</p>
              <Button size="sm" className="mt-3" onClick={() => setShowAdd(true)}>Add your first rule</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 uppercase">Paper</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 uppercase">Color</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 uppercase hidden sm:table-cell">Sides</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 uppercase">Price</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <RuleRow key={rule.id} rule={rule} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">💡 Pricing tip</p>
          <p className="text-xs text-blue-700">
            Standard Indian print shop rates: A4 B&W ₹1–3/page, A4 Colour ₹8–15/page.
            Double-sided is typically slightly cheaper than single. Set prices that work for your business.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

