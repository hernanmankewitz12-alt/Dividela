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
  const [showPass, setShowPass] = useState(false)
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
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Contraseña</label>
          <Link href="/recuperar" className="text-xs text-blue-600 hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3.5 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPass ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </button>
        </div>
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
          <Link href="/registro" className="text-blue-600 font-semibold hover:underline">Regístrate</Link>
        </p>
      </div>
    </main>
  )
}
