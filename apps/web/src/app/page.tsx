import Link from 'next/link'
import { Printer, ArrowRight, QrCode, Upload, CheckCircle, Shield, Zap, BarChart3 } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">MyPrint</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Zap className="w-4 h-4" />
            Built for Indian print shops
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Stop the WhatsApp printing{' '}
            <span className="text-blue-600">chaos</span>
          </h1>
          <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
            Give your customers a QR code. They scan, upload, pay, and collect. 
            You just watch jobs come in and get printed automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start free trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/print/quickprint"
              className="inline-flex items-center justify-center gap-2 bg-gray-50 text-gray-900 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors border border-gray-200"
            >
              See customer view
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-gray-50 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-gray-500 text-lg">Four simple steps — no app download needed</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                icon: <QrCode className="w-8 h-8 text-blue-600" />,
                title: 'Customer scans QR',
                desc: 'Display your unique shop QR at the counter. Customers scan with any phone camera.',
              },
              {
                step: '02',
                icon: <Upload className="w-8 h-8 text-blue-600" />,
                title: 'Upload & configure',
                desc: 'Customer uploads documents, picks B&W or colour, single or double-sided, copies.',
              },
              {
                step: '03',
                icon: <CheckCircle className="w-8 h-8 text-blue-600" />,
                title: 'Pay instantly',
                desc: 'Price is auto-calculated. Customer pays via UPI — your rates, your control.',
              },
              {
                step: '04',
                icon: <Printer className="w-8 h-8 text-blue-600" />,
                title: 'Print & collect',
                desc: 'Job arrives at your counter. Print automatically or review and approve first.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-xs font-bold text-blue-400 mb-4">{item.step}</div>
                <div className="mb-4">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need</h2>
            <p className="text-gray-500 text-lg">Built for serious print shop owners</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Shield className="w-6 h-6" />, title: 'Document privacy', desc: 'Files auto-deleted after printing. Signed URLs only. No public document access.' },
              { icon: <Zap className="w-6 h-6" />, title: 'Auto-print mode', desc: 'Enable automatic printing for verified payments. Zero counter friction.' },
              { icon: <BarChart3 className="w-6 h-6" />, title: 'Live dashboard', desc: 'Track orders, revenue, and print queue in real-time.' },
              { icon: <QrCode className="w-6 h-6" />, title: 'Branded QR codes', desc: 'Download printable QR posters for your shop counter.' },
              { icon: <Printer className="w-6 h-6" />, title: 'Works with your printer', desc: 'No new hardware. Uses your existing HP, Canon, Epson, Brother printers.' },
              { icon: <CheckCircle className="w-6 h-6" />, title: 'Smart pricing', desc: 'Set your own per-page rates. A4, A3, B&W, colour, single, duplex.' },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to modernise your print shop?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Join print shops across India already using MyPrint to automate their workflow.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Create your free account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">MyPrint</span>
          </div>
          <p className="text-sm text-gray-400">© 2024 MyPrint. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-400 hover:text-gray-600">Privacy</a>
            <a href="#" className="text-sm text-gray-400 hover:text-gray-600">Terms</a>
            <a href="#" className="text-sm text-gray-400 hover:text-gray-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

