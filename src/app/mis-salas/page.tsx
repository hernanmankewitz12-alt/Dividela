import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { formatCLP } from '@/lib/utils'
import type { RoomWithItems } from '@/lib/types'

export default async function MisSalasPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()
  const { data: rooms } = await supabase
    .from('rooms').select('*, items(*, claims(*))')
    .eq('user_id', user.id).order('created_at', { ascending: false })

  const salas = (rooms ?? []) as RoomWithItems[]

  return (
    <main className="min-h-[calc(100vh-56px)] px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="inline-block text-gray-400 hover:text-gray-600 text-xl mb-6">&larr;</Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mis divisiones</h1>
          <p className="text-sm text-gray-400 mt-0.5">{profile?.username ?? user.email}</p>
        </div>
        <Link
          href="/crear"
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all"
        >
          + Nueva
        </Link>
      </div>

      {salas.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
            <span className="text-3xl">🧾</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">Aún no has creado ninguna división.</p>
          <Link href="/crear" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Crear primera boleta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {salas.map((sala) => {
            const totalBoleta = sala.items.reduce((acc, i) => acc + i.precio * (i.cantidad ?? 1), 0)
            const totalConPropina = sala.incluir_propina ? totalBoleta * (1 + sala.propina_porcentaje / 100) : totalBoleta
            const itemsClamados = sala.items.filter((i) => i.claims.length > 0).length

            return (
              <Link
                key={sala.id}
                href={`/sala/${sala.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{sala.nombre_lugar}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(sala.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${sala.estado === 'completa' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sala.estado === 'completa' ? 'Completa' : 'Abierta'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{sala.items.length} productos · {itemsClamados} anotados</span>
                  <span className="font-bold text-gray-900">{formatCLP(totalConPropina)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
