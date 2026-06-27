'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })
    setLoading(false)
    if (error) return setError(error.message)
    setSent(true)
  }

  if (sent) {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-5">
            <span className="text-3xl">📬</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Revisa tu email</h1>
          <p className="text-gray-500 text-sm mb-6">
            Te enviamos un link a <strong>{email}</strong> para restablecer tu contraseña.
          </p>
          <Link href="/login" className="text-blue-600 font-semibold hover:underline text-sm">
            Volver al inicio de sesión
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/login" className="inline-block text-gray-400 hover:text-gray-600 text-xl mb-6">&larr;</Link>
        <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">Recuperar contraseña</h1>
        <p className="text-gray-400 text-sm mb-8">Te enviamos un link para crear una nueva.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              placeholder="tu@email.com"
              required
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all"
          >
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
      </div>
    </main>
  )
}
