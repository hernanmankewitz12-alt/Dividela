'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/mis-salas'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError('Email o contraseña incorrectos')
    router.push(redirectTo)
    router.refresh()
  }

  return (
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          placeholder="••••••••"
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
        {loading ? 'Entrando...' : 'Iniciar sesión'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block text-gray-400 hover:text-gray-600 text-xl mb-6">&larr;</Link>
        <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">Bienvenido</h1>
        <p className="text-gray-400 text-sm mb-8">Inicia sesión para ver tus divisiones</p>
        <Suspense fallback={<div className="h-48 animate-pulse bg-gray-100 rounded-2xl" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-gray-400">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-blue-600 font-semibold hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  )
}
