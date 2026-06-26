import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-5">
            <span className="text-3xl">🧾</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Dividela</h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Divide cualquier boleta al instante.<br />Sin cuentas, sin drama, sin calculadora.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 mb-12">
          <Link
            href="/crear"
            className="block w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-base py-4 rounded-2xl transition-all text-center"
          >
            Dividir una boleta
          </Link>
          <Link
            href="/mis-salas"
            className="block w-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-semibold text-base py-4 rounded-2xl transition-all text-center"
          >
            Mis divisiones
          </Link>
        </div>

        {/* Pasos */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '📷', text: 'Foto o ingresa la boleta' },
            { icon: '🔗', text: 'Comparte el link' },
            { icon: '✅', text: 'Cada uno se anota' },
          ].map((step, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-3 text-center">
              <div className="text-2xl mb-1.5">{step.icon}</div>
              <p className="text-xs text-gray-500 leading-tight">{step.text}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
