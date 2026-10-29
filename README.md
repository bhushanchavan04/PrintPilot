# MyPrint – Print Shop Automation Platform 🖨️⚡

MyPrint is an open, production-ready print shop automation software designed for existing print shops. It replaces manual, chaotic WhatsApp-based document sharing with an automated **QR-code-driven customer web portal** and a secure **Local Desktop Print Connector**.

---

## 🌟 Key Features

### 📱 1. Customer Web Application (Mobile-First)
- **Zero App Installation:** Customers scan the counter QR code and open a fast, responsive web interface.
- **Multi-File Upload:** Supports PDF, Office documents (`.doc`, `.docx`), and images (`.jpg`, `.jpeg`, `.png`) up to 50MB.
- **Accurate Page Counting:** Instant server-side PDF page count parsing (`pdf-lib`).
- **Flexible Print Preferences:**
  - Color mode: Black & White / Color
  - Sides: Single-sided / Double-sided
  - Paper sizes: A4, A3, A5, Letter, Legal
  - Page range selection (e.g., `1-5, 8, 11-14`)
  - Orientation & Copy count
- **Live Transparent Pricing:** Automatically calculates prices based on shop-configured rates before checkout.
- **Secure Payment Options:** Integrated mock/live payment workflows (UPI QR, Net Banking, Cards, Cash at counter).
- **Live Order Tracking:** Real-time polling updates (Uploaded → Confirmed → Queued → Printing → Completed).

### 🖥️ 2. Shop Owner Web Dashboard
- **Operational Metrics:** Daily & monthly revenue, total printed pages, active orders, and pending approval queues.
- **Real-Time Order Control:** View incoming print jobs, inspect customer preferences, approve/reject orders, and trigger manual or automatic printing.
- **Dynamic Pricing Engine:** Per-page rates customized by paper size, color mode, and single/duplex configuration.
- **Printer Management:** View connected physical printers, driver names, online/offline status, and active queue counts.
- **QR Code Center:** Downloadable high-resolution QR posters ready for counter display.

### 🔌 3. Local Desktop Print Connector (Windows Service / Agent)
- **Zero Proprietary Hardware:** Works seamlessly with existing printers (HP, Canon, Epson, Brother, Ricoh, Xerox) via Windows print drivers.
- **SumatraPDF & Windows Spooler Integration:** Direct, high-fidelity PDF submission without user interaction.
- **Idempotency & Duplicate Prevention:** Local SQLite / state logging ensures no job is printed twice during network reconnections.
- **Strict Printing Reliability Policy:**
  - Prints are marked `SUBMITTED_TO_QUEUE` upon Windows spooler handoff.
  - Final physical completion requires operator confirmation or driver verification to prevent false completions.
- **Security & Auto-Cleanup:** Downloads documents over short-lived pre-signed URLs and scrubs temporary files immediately after spooling.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Web Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI / shadcn/ui, Zustand |
| **Backend & APIs** | Next.js Route Handlers, Node.js 20+, jose (JWT), Zod validation |
| **Database & ORM** | PostgreSQL 16, Prisma ORM |
| **Document Storage** | MinIO (Local S3-compatible) / AWS S3 |
| **Desktop Agent** | Python 3.10+, `pywin32` (Windows Print Spooler), SumatraPDF CLI fallback, Requests |
| **Infrastructure** | Docker Compose (PostgreSQL, MinIO, Redis) |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** 18.x or 20+ and **npm** / **pnpm**
- **Python** 3.10+ (for Local Print Connector on Windows)
- **Docker Desktop** (for PostgreSQL and MinIO)

---

### 2. Start Supporting Services (Docker)
```bash
cd docker
docker-compose up -d
```
This spins up:
- **PostgreSQL**: `localhost:5432` (User: `myprint_user`, Pass: `myprint_password`, DB: `myprint`)
- **MinIO S3**: `localhost:9000` (Console: `localhost:9001`, User: `myprint_minio`, Pass: `myprint_minio_secret`)
- **Redis**: `localhost:6379`

*Note: Ensure a bucket named `myprint-documents` is created in MinIO or via AWS CLI/MinIO Console.*

---

### 3. Setup Web Application & Database
```bash
# Navigate to web application
cd apps/web

# Copy environment variables
cp .env.example .env

# Install dependencies
npm install

# Push Prisma database schema
npx prisma db push --schema=../../packages/database/prisma/schema.prisma

# Start web development server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

- **Register a Shop:** Visit `http://localhost:3000/register` to create an owner account and setup your shop.
- **Customer Upload Portal:** Accessible at `http://localhost:3000/print/[shop-slug]`.
- **Shop Dashboard:** Accessible at `http://localhost:3000/dashboard`.

---

### 4. Setup Local Desktop Print Connector (Windows)
```bash
# Open a new terminal on the Windows machine connected to printers
cd apps/print-connector

# Setup Python virtual environment
python -m venv venv
venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run initial setup wizard
python main.py --setup

# Start the connector daemon
python main.py
```

The setup wizard will:
1. Prompt for your MyPrint server URL (default: `http://localhost:3000`).
2. Prompt for your shop owner credentials to authenticate securely.
3. Automatically detect all locally installed Windows printers.
4. Allow you to select your preferred default printer.
5. Save configuration into a local `.env` and start listening for jobs.

---

## 🔒 Security & Data Privacy
- **No Public Document URLs:** Documents are stored privately and accessed exclusively via short-lived pre-signed URLs (300s expiration).
- **Auto-Deletion:** Shop settings allow automatic file expiration (default 24h retention) to protect customer data.
- **Server-Side Payment Verification:** Client payments are verified via cryptographic signature matching and backend webhook processing before print queue release.

---

## 📄 License
MIT License. Built for modern, high-efficiency print shop operations.

