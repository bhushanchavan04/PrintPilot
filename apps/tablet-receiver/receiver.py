"""
MyPrint – Wi-Fi Tablet Print Receiver
======================================
Runs on your laptop and listens on port 8765 (all interfaces).
Open http://<LAN-IP>:8765 on your Android tablet to see live print jobs.

Start:
    cd apps/tablet-receiver
    python receiver.py
"""

import os
import sys
import json
import uuid
import socket
import threading
from datetime import datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import queue as queue_module

# Force UTF-8 stdout on Windows
try:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')  # type: ignore
except Exception:
    pass

# ── Configuration ────────────────────────────────────────────────────────────
PORT = 8765
TOKEN = os.environ.get("TABLET_RECEIVER_TOKEN", "myprint-tablet-2024")

# ── In-memory job store ──────────────────────────────────────────────────────
jobs: list[dict] = []
jobs_lock = threading.Lock()
sse_clients: list = []
sse_lock = threading.Lock()


def get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def broadcast_sse(event: str, data: dict):
    msg = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    with sse_lock:
        dead = []
        for q in sse_clients:
            try:
                q.put(msg)
            except Exception:
                dead.append(q)
        for q in dead:
            try:
                sse_clients.remove(q)
            except Exception:
                pass


def notify_order_completed(order_id: str, job_id: str, order_number: str = ""):
    """Notify Next.js backend that printing is completed so the customer sees 'Your Print is Ready!'"""
    if not order_id:
        return

    def _worker():
        try:
            import urllib.request
            laptop_url = os.environ.get("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000").replace("localhost", "127.0.0.1")
            payload = json.dumps({"orderId": order_id, "jobId": job_id}).encode("utf-8")
            req = urllib.request.Request(
                f"{laptop_url}/api/tablet/complete",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Receiver-Token": TOKEN,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                print(f"  [+] Notified MyPrint: Order {order_number or order_id} is COMPLETED (customer notified!)")
        except Exception as e:
            print(f"  [!] Note: Could not notify Next.js ({e})")

    threading.Thread(target=_worker, daemon=True).start()


# ── Tablet Dashboard HTML ────────────────────────────────────────────────────
DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>📱 MyPrint Tablet Receiver</title>
<style>
  :root {
    --primary: #2563eb;
    --primary-dark: #1d4ed8;
    --success: #16a34a;
    --bg: #f1f5f9;
    --card-bg: #ffffff;
    --border: #e2e8f0;
    --text-main: #0f172a;
    --text-muted: #64748b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text-main);
    min-height: 100vh;
    padding-bottom: 40px;
  }
  .header {
    background: linear-gradient(135deg, #1e3a8a, #2563eb);
    color: white;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 50;
    box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .pulse-dot {
    width: 12px; height: 12px; border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 0 4px rgba(74,222,128,0.35);
    animation: pulse 2s infinite ease-in-out;
    flex-shrink: 0;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.9); } }
  .title-wrap h1 { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; }
  .title-wrap .sub { font-size: 0.78rem; opacity: 0.85; margin-top: 2px; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .btn-sm {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    color: white;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 7px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .btn-sm:hover { background: rgba(255,255,255,0.25); }

  .container {
    max-width: 860px;
    margin: 20px auto 0;
    padding: 0 16px;
  }

  .banner {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 16px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .banner strong { color: var(--text-main); }
  .banner code {
    background: #eff6ff;
    color: var(--primary);
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-family: monospace;
    font-size: 0.88rem;
  }

  .empty-state {
    text-align: center;
    padding: 70px 24px;
    background: #ffffff;
    border: 2px dashed #cbd5e1;
    border-radius: 20px;
    margin-top: 18px;
  }
  .empty-state .icon { font-size: 3.8rem; margin-bottom: 14px; }
  .empty-state h2 { font-size: 1.2rem; color: #334155; margin-bottom: 8px; }
  .empty-state p { font-size: 0.9rem; color: #64748b; line-height: 1.5; max-width: 440px; margin: 0 auto; }

  .job-card {
    background: #ffffff;
    border-radius: 18px;
    border: 1px solid var(--border);
    box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    margin-bottom: 20px;
    overflow: hidden;
    transition: all 0.2s ease;
  }
  .job-card.completed { border-left: 5px solid var(--success); }
  .job-card.printing { border-left: 5px solid #0284c7; }
  .job-card.received { border-left: 5px solid var(--primary); }

  .card-top {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #f1f5f9;
  }
  .file-meta h3 { font-size: 1.05rem; font-weight: 700; color: #0f172a; word-break: break-all; }
  .file-meta .order-tag {
    font-size: 0.8rem;
    font-family: monospace;
    color: #64748b;
    margin-top: 3px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .badge {
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .badge-received  { background: #dbeafe; color: #1e40af; }
  .badge-printing  { background: #e0f2fe; color: #0369a1; animation: pulse 1.5s infinite; }
  .badge-completed { background: #dcfce7; color: #15803d; }

  .card-content {
    padding: 18px 20px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 640px) {
    .card-content { grid-template-columns: 220px 1fr; }
  }

  /* Document Preview Sheet */
  .preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 14px;
  }
  .paper-sheet {
    width: 100%;
    max-width: 175px;
    aspect-ratio: 1 / 1.414;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    padding: 12px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .paper-corner {
    position: absolute;
    top: 0; right: 0;
    width: 0; height: 0;
    border-style: solid;
    border-width: 0 16px 16px 0;
    border-color: transparent #e2e8f0 transparent transparent;
  }
  .paper-header {
    height: 10px;
    border-radius: 3px;
    margin-bottom: 10px;
    width: 55%;
  }
  .paper-sheet.color .paper-header { background: linear-gradient(90deg, #3b82f6, #06b6d4); }
  .paper-sheet.bw .paper-header { background: #475569; }

  .paper-lines {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
  }
  .line {
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    width: 100%;
  }
  .line.short { width: 60%; }
  .line.half { width: 45%; }
  .line.accent { height: 6px; margin: 3px 0; }
  .paper-sheet.color .line.accent { background: #60a5fa; }
  .paper-sheet.bw .line.accent { background: #94a3b8; }

  .paper-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 8px 0;
  }
  .paper-box {
    height: 22px;
    background: #f1f5f9;
    border-radius: 4px;
    border: 1px dashed #cbd5e1;
  }

  .paper-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #94a3b8;
    border-top: 1px solid #f1f5f9;
    padding-top: 6px;
    margin-top: auto;
    font-family: monospace;
  }
  .preview-caption {
    font-size: 0.76rem;
    color: #64748b;
    margin-top: 8px;
    font-weight: 600;
  }

  /* Details Column */
  .details-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  @media (min-width: 480px) {
    .specs-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .spec-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px 10px;
  }
  .spec-label { font-size: 0.68rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
  .spec-val { font-size: 0.92rem; font-weight: 700; color: #0f172a; margin-top: 2px; }

  .progress-wrap {
    background: #e2e8f0;
    border-radius: 8px;
    height: 8px;
    overflow: hidden;
    margin: 12px 0 6px;
    display: none;
  }
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #0284c7, #38bdf8);
    width: 0%;
    transition: width 0.3s ease;
  }
  .progress-text {
    font-size: 0.78rem;
    color: #0369a1;
    font-weight: 600;
    display: none;
    margin-bottom: 6px;
  }

  .btn-simulate {
    width: 100%;
    padding: 13px 18px;
    background: linear-gradient(135deg, #16a34a, #22c55e);
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(22,163,74,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
  }
  .btn-simulate:hover { transform: translateY(-1px); }
  .btn-simulate:disabled { background: #94a3b8; box-shadow: none; cursor: not-allowed; }

  .completed-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    padding: 12px;
    border-radius: 12px;
    text-align: center;
    font-weight: 700;
    font-size: 0.92rem;
  }

  .card-footer {
    padding: 10px 20px;
    background: #fafafa;
    border-top: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #94a3b8;
  }
</style>
</head>
<body>

<div class="header">
  <div class="brand">
    <div class="pulse-dot" id="connDot"></div>
    <div class="title-wrap">
      <h1>Tablet Print Receiver</h1>
      <div class="sub" id="connText">Connecting to laptop…</div>
    </div>
  </div>
  <div class="header-actions">
    <button class="btn-sm" id="autoPrintBtn" onclick="toggleAutoPrint()">⚡ Auto-Print: ON</button>
    <button class="btn-sm" onclick="clearCompleted()">Clear Finished</button>
  </div>
</div>

<div class="container">
  <div class="banner">
    <div>
      <strong>Receiver Online</strong> · Tablet URL: <code id="dispUrl">http://...</code>
    </div>
    <span id="jobCountBadge" style="font-weight:700;color:var(--primary);">0 Jobs</span>
  </div>

  <div id="jobsList"></div>
</div>

<script>
let jobs = [];
let autoPrint = localStorage.getItem('tablet_autoprint') !== 'false'; // default ON

function updateAutoPrintBtn() {
  const btn = document.getElementById('autoPrintBtn');
  if (btn) {
    btn.textContent = autoPrint ? '⚡ Auto-Print: ON' : '⚡ Auto-Print: OFF';
    btn.style.background = autoPrint ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.15)';
    btn.style.borderColor = autoPrint ? '#4ade80' : 'rgba(255,255,255,0.25)';
  }
}

function toggleAutoPrint() {
  autoPrint = !autoPrint;
  localStorage.setItem('tablet_autoprint', autoPrint ? 'true' : 'false');
  updateAutoPrintBtn();
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  return Math.floor(diff/3600) + 'h ago';
}

function render() {
  const container = document.getElementById('jobsList');
  document.getElementById('dispUrl').textContent = window.location.origin;
  document.getElementById('jobCountBadge').textContent = jobs.length + (jobs.length === 1 ? ' Job' : ' Jobs');
  updateAutoPrintBtn();

  if (!jobs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🖨️</div>
        <h2>Ready for Print Jobs</h2>
        <p>Your tablet is connected as a printer! When a customer pays on their phone or computer, the print job will directly post here, print, and notify the customer that their print is ready.</p>
      </div>`;
    return;
  }

  container.innerHTML = jobs.slice().reverse().map(job => {
    const isCompleted = job.status === 'COMPLETED';
    const isPrinting = job.status === 'PRINTING';
    const isColor = job.colorMode === 'COLOR';

    return `
      <div class="job-card ${job.status.toLowerCase()}" id="card-${job.id}">
        <div class="card-top">
          <div class="file-meta">
            <h3>${esc(job.filename)}</h3>
            <div class="order-tag">
              <span>Order: <strong>${esc(job.orderNumber || 'N/A')}</strong></span>
              <span>·</span>
              <span>${job.pageCount} ${job.pageCount === 1 ? 'Page' : 'Pages'}</span>
            </div>
          </div>
          <div>
            ${
              isCompleted ? '<span class="badge badge-completed">✅ Completed</span>' :
              isPrinting  ? '<span class="badge badge-printing">🖨️ Printing…</span>' :
                            '<span class="badge badge-received">📥 Received</span>'
            }
          </div>
        </div>

        <div class="card-content">
          <!-- Document Preview Visual Sheet -->
          <div class="preview-container">
            <div class="paper-sheet ${isColor ? 'color' : 'bw'}">
              <div class="paper-corner"></div>
              <div class="paper-header"></div>
              <div class="paper-lines">
                <div class="line"></div>
                <div class="line short"></div>
                <div class="line accent"></div>
                <div class="paper-grid">
                  <div class="paper-box"></div>
                  <div class="paper-box"></div>
                </div>
                <div class="line"></div>
                <div class="line half"></div>
                <div class="line"></div>
              </div>
              <div class="paper-footer">
                <span>${esc(job.paperSize || 'A4')}</span>
                <span>Page 1 / ${job.pageCount}</span>
              </div>
            </div>
            <div class="preview-caption">📄 ${esc(job.paperSize || 'A4')} Preview</div>
          </div>

          <!-- Specs and Action Column -->
          <div class="details-col">
            <div class="specs-grid">
              <div class="spec-item">
                <div class="spec-label">Paper Size</div>
                <div class="spec-val">${esc(job.paperSize || 'A4')}</div>
              </div>
              <div class="spec-item">
                <div class="spec-label">Color Mode</div>
                <div class="spec-val">${isColor ? '🎨 Colour' : '⬛ B&amp;W'}</div>
              </div>
              <div class="spec-item">
                <div class="spec-label">Sides</div>
                <div class="spec-val">${job.sides === 'DOUBLE' ? '📖 Duplex' : '📃 Single'}</div>
              </div>
              <div class="spec-item">
                <div class="spec-label">Copies</div>
                <div class="spec-val">${job.copies || 1}×</div>
              </div>
            </div>

            <!-- Printing Animation / Action -->
            <div id="action-area-${job.id}">
              <div class="progress-text" id="prog-text-${job.id}">Simulating print run…</div>
              <div class="progress-wrap" id="prog-wrap-${job.id}">
                <div class="progress-bar" id="prog-bar-${job.id}"></div>
              </div>

              ${
                isCompleted ? `
                  <div class="completed-box">
                    ✅ Print Completed · Customer Notified!
                  </div>
                ` : `
                  <button class="btn-simulate" id="btn-print-${job.id}" onclick="startSimulatePrint('${job.id}', ${job.pageCount || 1})">
                    <span>🖨️</span>
                    <span>Simulate Print (${job.pageCount} Pages)</span>
                  </button>
                `
              }
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span>Job ID: <code style="font-family:monospace">${job.id.substring(0,8)}…</code></span>
          <span>Received ${timeAgo(job.receivedAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function startSimulatePrint(jobId, pageCount) {
  const btn = document.getElementById('btn-print-' + jobId);
  const progWrap = document.getElementById('prog-wrap-' + jobId);
  const progBar = document.getElementById('prog-bar-' + jobId);
  const progText = document.getElementById('prog-text-' + jobId);

  if (btn) btn.style.display = 'none';
  if (progWrap) progWrap.style.display = 'block';
  if (progText) progText.style.display = 'block';

  const job = jobs.find(j => j.id === jobId);
  if (job) job.status = 'PRINTING';

  // Animate printing page by page
  const totalSteps = 10;
  for (let i = 1; i <= totalSteps; i++) {
    const percent = Math.round((i / totalSteps) * 100);
    const currPage = Math.min(pageCount, Math.ceil((i / totalSteps) * pageCount));
    if (progBar) progBar.style.width = percent + '%';
    if (progText) progText.textContent = `Printing page ${currPage} of ${pageCount}… (${percent}%)`;
    await new Promise(r => setTimeout(r, 200));
  }

  // Complete on backend receiver -> calls laptop Next.js /api/tablet/complete
  try {
    const res = await fetch(`/jobs/${jobId}/simulate-print`, { method: 'POST' });
    const data = await res.json();
    if (job) {
      job.status = data.status || 'COMPLETED';
      job.completedAt = new Date().toISOString();
    }
  } catch (err) {
    if (job) {
      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
    }
  }

  render();
}

function clearCompleted() {
  jobs = jobs.filter(j => j.status !== 'COMPLETED');
  render();
}

// ── SSE for Real-Time Updates from Laptop ──
function connectSSE() {
  const es = new EventSource('/stream');

  es.onopen = () => {
    document.getElementById('connText').textContent = 'Live · Connected to Laptop';
    document.getElementById('connDot').style.background = '#4ade80';
  };

  es.addEventListener('job', e => {
    const job = JSON.parse(e.data);
    const existing = jobs.find(j => j.id === job.id);
    if (!existing) {
      jobs.push(job);
      render();
      if (navigator.vibrate) navigator.vibrate(120);

      // Auto-Print: if enabled, start printing automatically!
      if (autoPrint && job.status !== 'COMPLETED') {
        setTimeout(() => {
          startSimulatePrint(job.id, job.pageCount || 1);
        }, 600);
      }
    }
  });

  es.addEventListener('job_update', e => {
    const update = JSON.parse(e.data);
    const job = jobs.find(j => j.id === update.id);
    if (job) {
      Object.assign(job, update);
      render();
    }
  });

  es.onerror = () => {
    document.getElementById('connText').textContent = 'Reconnecting to laptop…';
    document.getElementById('connDot').style.background = '#f87171';
    es.close();
    setTimeout(connectSSE, 2500);
  };
}

fetch('/jobs')
  .then(r => r.json())
  .then(d => {
    jobs = d.jobs || [];
    render();
  })
  .catch(() => { render(); });

connectSSE();
setInterval(render, 30000);
</script>

</body>
</html>
"""


# ── HTTP Request Handler ──────────────────────────────────────────────────────
class ReceiverHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} {format % args}")

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, html: str):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def check_token(self) -> bool:
        auth = self.headers.get("X-Receiver-Token", "")
        return auth == TOKEN

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Receiver-Token")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/":
            self.send_html(DASHBOARD_HTML)

        elif path == "/health":
            self.send_json({"status": "ok", "lanIp": get_lan_ip(), "jobsCount": len(jobs)})

        elif path == "/jobs":
            with jobs_lock:
                self.send_json({"jobs": jobs})

        elif path == "/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            q: queue_module.Queue = queue_module.Queue()
            with sse_lock:
                sse_clients.append(q)

            # Send current jobs immediately
            with jobs_lock:
                for job in jobs:
                    msg = f"event: job\ndata: {json.dumps(job)}\n\n"
                    try:
                        self.wfile.write(msg.encode("utf-8"))
                        self.wfile.flush()
                    except Exception:
                        break

            try:
                while True:
                    try:
                        msg = q.get(timeout=20)
                        self.wfile.write(msg.encode("utf-8"))
                        self.wfile.flush()
                    except queue_module.Empty:
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except Exception:
                pass
            finally:
                with sse_lock:
                    try:
                        sse_clients.remove(q)
                    except ValueError:
                        pass

        elif path.startswith("/jobs/") and path.endswith("/simulate-print"):
            job_id = path.split("/")[2]
            with jobs_lock:
                job = next((j for j in jobs if j["id"] == job_id), None)
                if job:
                    job["status"] = "COMPLETED"
                    job["completedAt"] = datetime.utcnow().isoformat() + "Z"
            if job:
                broadcast_sse("job_update", {"id": job_id, "status": "COMPLETED"})
                notify_order_completed(job.get("orderId", ""), job_id, job.get("orderNumber", ""))
                self.send_json({"status": "COMPLETED"})
            else:
                self.send_json({"error": "Job not found"}, 404)

        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/jobs":
            if not self.check_token():
                self.send_json({"error": "Unauthorized"}, 401)
                return

            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_json({"error": "Invalid JSON"}, 400)
                return

            job = {
                "id": str(uuid.uuid4()),
                "orderId": data.get("orderId", ""),
                "orderNumber": data.get("orderNumber", ""),
                "filename": data.get("filename", "document.pdf"),
                "pageCount": data.get("pageCount", 1),
                "copies": data.get("copies", 1),
                "colorMode": data.get("colorMode", "BLACK_AND_WHITE"),
                "sides": data.get("sides", "SINGLE"),
                "paperSize": data.get("paperSize", "A4"),
                "previewUrl": data.get("previewUrl", ""),
                "status": "RECEIVED",
                "receivedAt": datetime.utcnow().isoformat() + "Z",
                "completedAt": None,
            }

            with jobs_lock:
                jobs.append(job)

            broadcast_sse("job", job)
            print(f"  [+] Job received from customer payment: {job['filename']} ({job['pageCount']} pages)")
            self.send_json({"jobId": job["id"], "status": "RECEIVED"}, 201)

        elif path.endswith("/simulate-print"):
            job_id = path.split("/")[2]
            with jobs_lock:
                job = next((j for j in jobs if j["id"] == job_id), None)
                if job:
                    job["status"] = "COMPLETED"
                    job["completedAt"] = datetime.utcnow().isoformat() + "Z"
            if job:
                broadcast_sse("job_update", {"id": job_id, "status": "COMPLETED"})
                notify_order_completed(job.get("orderId", ""), job_id, job.get("orderNumber", ""))
                self.send_json({"status": "COMPLETED"})
            else:
                self.send_json({"error": "Job not found"}, 404)

        else:
            self.send_json({"error": "Not found"}, 404)


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    lan_ip = get_lan_ip()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), ReceiverHandler)
    server.daemon_threads = True

    print("=" * 60)
    print("  MyPrint Tablet Print Receiver")
    print("=" * 60)
    print(f"  Laptop URL : http://localhost:{PORT}")
    print(f"  Tablet URL : http://{lan_ip}:{PORT}   <-- open in Chrome on Android")
    print(f"  LAN IP     : {lan_ip}")
    print(f"  Port       : {PORT}")
    print(f"  Token      : {TOKEN}")
    print("=" * 60)
    print("  Auto-print & customer notification pipeline ACTIVE.")
    print("  Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Receiver stopped.")
        server.server_close()
