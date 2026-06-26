'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function NavBar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('profiles').select('username').eq('id', data.user.id).single()
          .then(({ data: profile }) => { if (profile) setUsername(profile.username) })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setUsername('')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-black text-gray-900 text-lg tracking-tight">
          Dividela
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/mis-salas" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                Mis salas
              </Link>
              <span className="text-xs text-gray-400 font-medium">{username || user.email?.split('@')[0]}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                Entrar
              </Link>
              <Link href="/registro" className="text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl transition-colors">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
