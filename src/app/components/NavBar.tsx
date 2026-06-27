import Link from 'next/link'

export default function NavBar() {
  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-black text-gray-900 text-lg tracking-tight">
          Dividela
        </Link>
        <Link
          href="/mis-salas"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
        >
          Mis salas
        </Link>
      </div>
    </nav>
  )
}
