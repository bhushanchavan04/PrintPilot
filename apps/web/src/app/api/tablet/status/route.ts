import { NextResponse } from 'next/server'
import os from 'os'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Detect laptop LAN IP
  let lanIp = '127.0.0.1'
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    const list = nets[name] || []
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        lanIp = net.address
        break
      }
    }
    if (lanIp !== '127.0.0.1') break
  }

  const port = 8765
  const receiverUrl = process.env.TABLET_RECEIVER_URL || `http://localhost:${port}`

  // Check if receiver is online
  let online = false
  try {
    const res = await fetch(`${receiverUrl}/jobs`, {
      method: 'GET',
      // @ts-ignore
      signal: AbortSignal.timeout(1200),
    })
    online = res.ok
  } catch {
    online = false
  }

  return NextResponse.json({
    online,
    lanIp,
    port,
    tabletUrl: `http://${lanIp}:${port}`,
    laptopUrl: `http://localhost:${port}`,
  })
}

