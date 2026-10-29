// Not-found page for invalid shop QR codes / slugs

import Link from 'next/link'

export default function ShopNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        {/* Printer icon placeholder */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-6 0h4v4H8v-4h4z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Shop Not Found</h1>
        <p className="text-gray-500 mb-6">
          The print shop QR code you scanned is invalid, expired, or the shop
          may no longer be active.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          Please ask the shop owner for an updated QR code or contact the shop
          directly.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}

