'use client'

import { useEffect, useState } from 'react'
import { Printer, Wifi, WifiOff, Star, Plus, Terminal, ExternalLink, AlertCircle, Tablet, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

export default function PrintersPage() {
  const { toast } = useToast()
  const [printers, setPrinters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [connectorToken, setConnectorToken] = useState('')
  const [tabletInfo, setTabletInfo] = useState<{ online: boolean; lanIp: string; tabletUrl: string; laptopUrl: string } | null>(null)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    fetch('/api/shops')
      .then(r => r.json())
      .then(d => { if (d.shop) { setPrinters(d.shop.printers ?? []) } })
      .finally(() => setLoading(false))

    fetch('/api/tablet/status')
      .then(r => r.json())
      .then(d => setTabletInfo(d))
      .catch(() => {})

    setConnectorToken(typeof window !== 'undefined' ? btoa(`connector:${Date.now()}`) : '')
  }, [])

  const sendTestPrint = async () => {
    setSendingTest(true)
    try {
      // Find an order or push a sample test job
      const res = await fetch('/api/orders?limit=1')
      const data = await res.json()
      const firstOrder = data.orders?.[0]
      if (firstOrder) {
        const pushRes = await fetch('/api/tablet/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: firstOrder.id }),
        })
        if (pushRes.ok) {
          toast({ title: 'Test job sent!', description: `Document pushed to tablet at ${tabletInfo?.tabletUrl}` })
        } else {
          toast({ variant: 'destructive', title: 'Failed to send', description: 'Could not push to tablet receiver.' })
        }
      } else {
        toast({ variant: 'destructive', title: 'No orders found', description: 'Create an order first to test sending.' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Make sure tablet receiver is running.' })
    } finally {
      setSendingTest(false)
    }
  }

  const setDefault = async (id: string) => {
    // Update locally first
    setPrinters(p => p.map(pr => ({ ...pr, isDefault: pr.id === id })))
    toast({ title: 'Default printer updated' })
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Printers & Connector</h1>
        <p className="text-sm text-gray-500">Manage your print connector and connected printers</p>
      </div>

      {/* Wi-Fi Tablet Print Receiver (Virtual Testing) */}
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-blue-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tablet className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-base text-indigo-950">Wi-Fi Tablet Print Receiver (Virtual Testing)</CardTitle>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              tabletInfo?.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${tabletInfo?.online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {tabletInfo?.online ? 'Receiver Online' : 'Receiver Offline'}
            </span>
          </div>
          <CardDescription className="text-indigo-800">
            Preview and test print output on your Android tablet over local Wi-Fi without needing a physical printer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-indigo-100 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Laptop Local IP</p>
                <p className="text-base font-mono font-bold text-gray-900 mt-1">{tabletInfo?.lanIp || 'Detecting…'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Tablet Chrome URL</p>
                <code className="text-sm font-mono font-bold text-blue-600 mt-1 block select-all">
                  {tabletInfo?.tabletUrl || 'http://...:8765'}
                </code>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2 items-center justify-between">
              <p className="text-xs text-gray-500">
                Open the Tablet URL in Chrome on your Android device connected to the same Wi-Fi.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-indigo-700 border-indigo-200"
                  onClick={sendTestPrint}
                  disabled={!tabletInfo?.online || sendingTest}
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {sendingTest ? 'Sending…' : 'Send Test Job to Tablet'}
                </Button>
                {tabletInfo?.online && (
                  <a
                    href={tabletInfo.tabletUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Open Tablet Dashboard <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connector status */}
      <Card className="border-blue-100 bg-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base text-blue-900">Local Print Connector</CardTitle>
          </div>
          <CardDescription className="text-blue-700">
            Install the connector on your shop computer to receive and print jobs automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Quick Setup</p>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                <span>Make sure Python 3.11+ is installed on your shop computer</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                <div>
                  <span>Copy the connector folder from your project:</span>
                  <code className="block mt-1 bg-gray-900 text-green-400 text-xs rounded-lg px-3 py-2 font-mono">
                    cd apps/print-connector<br />
                    pip install -r requirements.txt<br />
                    python setup.py
                  </code>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                <span>Run the setup wizard and enter your shop credentials when prompted</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
                <span>Start the connector: <code className="bg-gray-100 px-1 rounded text-xs">python main.py</code></span>
              </li>
            </ol>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">
                <strong>Important:</strong> A successful print submission only means the job was sent to your Windows print queue. 
                Physical printing depends on your printer being online, loaded with paper, and functioning correctly.
                Always verify physical output and mark orders as complete manually if needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printers list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Connected Printers</CardTitle>
            <CardDescription>Printers discovered by your local connector</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
          ) : printers.length === 0 ? (
            <div className="py-12 text-center">
              <Printer className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-1">No printers detected</p>
              <p className="text-xs text-gray-400">Install and run the Local Print Connector on your shop computer to automatically detect installed printers.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {printers.map(printer => (
                <div key={printer.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${printer.isDefault ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${printer.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{printer.name}</p>
                      {printer.isDefault && <Badge variant="info" className="text-xs">Default</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{printer.systemName}</p>
                    <div className="flex gap-2 mt-1.5">
                      {printer.supportsColor && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Colour</span>}
                      {printer.supportsDuplex && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Duplex</span>}
                      {printer.paperSizes?.map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${printer.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                      {printer.isOnline ? '● Online' : '○ Offline'}
                    </span>
                    {!printer.isDefault && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setDefault(printer.id)}>
                        <Star className="w-3 h-3 mr-1" /> Set Default
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

