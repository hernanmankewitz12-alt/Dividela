'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCLP } from '@/lib/utils'
import type { RoomWithBoletas } from '@/lib/types'

const ROOMS_KEY = 'dividiendola_rooms'

export default function MisSalasPage() {
  const [salas, setSalas] = useState<RoomWithBoletas[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '[]')
    if (!ids.length) { setLoading(false); return }

    supabase
      .from('rooms')
      .select('*, boletas(*, items(*, claims(*)))')
      .in('id', ids)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSalas((data ?? []) as RoomWithBoletas[])
        setLoading(false)
      })
  }, [])

  return (
    <main className="min-h-[calc(100vh-56px)] px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="inline-block text-gray-400 hover:text-gray-600 text-xl mb-6">&larr;</Link>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mis divisiones</h1>
        <Link
          href="/crear"
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all"
        >
          + Nueva
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Cargando...</div>
      ) : salas.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
            <span className="text-3xl">🧾</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">Aún no has creado ni te has unido a ninguna división.</p>
          <Link href="/crear" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Crear primera boleta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {salas.map((sala) => {
            const allItems = sala.boletas.flatMap(b => b.items)
            const totalFinal = sala.boletas.reduce((acc, boleta) => {
              const totalBoleta = boleta.items.reduce((a, i) => a + i.precio * (i.cantidad ?? 1), 0)
              const propina = boleta.incluir_propina ? totalBoleta * (boleta.propina_porcentaje / 100) : 0
              const descuento = boleta.descuento_tipo === 'porcentaje'
                ? totalBoleta * (boleta.descuento_valor / 100)
                : boleta.descuento_tipo === 'fijo' ? boleta.descuento_valor : 0
              return acc + totalBoleta + propina - descuento
            }, 0)
            const itemsClamados = allItems.filter(i => i.claims.length > 0).length
            const salaTitle = sala.nombre ?? sala.boletas[0]?.nombre_lugar ?? sala.nombre_lugar

            return (
              <Link
                key={sala.id}
                href={`/sala/${sala.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{salaTitle}</p>
                    {sala.boletas.length > 1 && (
                      <p className="text-xs text-gray-400 mt-0.5">{sala.boletas.length} boletas</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(sala.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${sala.estado === 'completa' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sala.estado === 'completa' ? 'Completa' : 'Abierta'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{allItems.length} productos · {itemsClamados} anotados</span>
                  <span className="font-bold text-gray-900">{formatCLP(totalFinal)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
