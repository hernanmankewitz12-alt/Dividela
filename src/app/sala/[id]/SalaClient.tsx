'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCLP, calcItemClaimed } from '@/lib/utils'
import type { RoomWithItems, ItemWithClaims, Claim } from '@/lib/types'

type Modal = { itemId: string } | null
type Mode = 'unidades' | 'dividir'

function detectSplit(claims: Claim[]): number | null {
  const counts = new Map<number, number>()
  for (const c of claims) {
    if (c.fracciones_den > 1) counts.set(c.fracciones_den, (counts.get(c.fracciones_den) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export default function SalaClient({ sala: initialSala }: { sala: RoomWithItems }) {
  const [sala, setSala] = useState(initialSala)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [showIdentity, setShowIdentity] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [mode, setMode] = useState<Mode>('unidades')
  const [unidades, setUnidades] = useState(1)
  const [nPersonas, setNPersonas] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const storageKey = `dividela_user_${sala.id}`

  const fetchSala = useCallback(async () => {
    const res = await fetch(`/api/salas/${sala.id}`)
    if (res.ok) setSala(await res.json())
  }, [sala.id])

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      setCurrentUser(saved)
    } else {
      // Pedir identidad al entrar
      setShowIdentity(true)
    }
  }, [storageKey])

  useEffect(() => {
    const channel = supabase
      .channel(`sala-${sala.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, fetchSala)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchSala)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sala.id, fetchSala])

  function selectUser(nombre: string) {
    localStorage.setItem(storageKey, nombre)
    setCurrentUser(nombre)
    setShowIdentity(false)
  }

  function openModal(item: ItemWithClaims) {
    if (!currentUser) { setShowIdentity(true); return }
    const activeSplit = detectSplit(item.claims)
    setModal({ itemId: item.id })
    setMode(activeSplit ? 'dividir' : 'unidades')
    setUnidades(1)
    setNPersonas(activeSplit ?? 2)
  }

  const modalItem = modal ? sala.items.find(i => i.id === modal.itemId) ?? null : null
  const activeSplit = modalItem ? detectSplit(modalItem.claims) : null

  async function handleClaim() {
    if (!modalItem || !currentUser) return
    setSubmitting(true)

    const cantidad = modalItem.cantidad ?? 1
    const num = mode === 'unidades' ? unidades : 1
    const den = mode === 'unidades' ? cantidad : nPersonas

    await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: modalItem.id,
        nombre_persona: currentUser,
        fracciones_num: num,
        fracciones_den: den,
      }),
    })

    setSubmitting(false)
    setModal(null)
    fetchSala()
  }

  async function deleteClaim(id: string) {
    await fetch(`/api/claims/${id}`, { method: 'DELETE' })
    fetchSala()
  }

  async function toggleEstado() {
    const nuevoEstado = sala.estado === 'abierta' ? 'completa' : 'abierta'
    await fetch(`/api/salas/${sala.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    fetchSala()
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Totales por persona — descuento fijo se aplica UNA SOLA VEZ por persona
  const personData = new Map<string, { subtotal: number; propina: number }>()
  for (const item of sala.items) {
    const precioTotal = item.precio * (item.cantidad ?? 1)
    for (const claim of item.claims) {
      const portion = precioTotal * (claim.fracciones_num / claim.fracciones_den)
      const propina = sala.incluir_propina ? portion * (sala.propina_porcentaje / 100) : 0
      const prev = personData.get(claim.nombre_persona) ?? { subtotal: 0, propina: 0 }
      personData.set(claim.nombre_persona, { subtotal: prev.subtotal + portion, propina: prev.propina + propina })
    }
  }

  const totalesPorPersona = new Map<string, number>()
  for (const [persona, { subtotal, propina }] of personData) {
    let descuento = 0
    if (sala.descuento_tipo === 'porcentaje') descuento = subtotal * (sala.descuento_valor / 100)
    else if (sala.descuento_tipo === 'fijo') descuento = sala.descuento_valor / Math.max(1, sala.descuento_personas)
    totalesPorPersona.set(persona, subtotal + propina - descuento)
  }

  const totalBoleta = sala.items.reduce((acc, i) => acc + i.precio * (i.cantidad ?? 1), 0)
  const propinaMonto = sala.incluir_propina ? totalBoleta * (sala.propina_porcentaje / 100) : 0
  const descuentoMonto = sala.descuento_tipo === 'porcentaje'
    ? totalBoleta * (sala.descuento_valor / 100)
    : sala.descuento_tipo === 'fijo' ? sala.descuento_valor : 0
  const totalFinal = totalBoleta + propinaMonto - descuentoMonto

  // Preview modal
  const cantidad = modalItem?.cantidad ?? 1
  const modalNum = mode === 'unidades' ? unidades : 1
  const modalDen = mode === 'unidades' ? cantidad : nPersonas
  const modalPrecioTotal = modalItem ? modalItem.precio * cantidad : 0
  const modalSubtotal = modalPrecioTotal * (modalNum / modalDen)
  const modalPropina = sala.incluir_propina ? modalSubtotal * (sala.propina_porcentaje / 100) : 0
  const modalDescuento = sala.descuento_tipo === 'porcentaje'
    ? modalSubtotal * (sala.descuento_valor / 100)
    : sala.descuento_tipo === 'fijo' ? sala.descuento_valor / Math.max(1, sala.descuento_personas) : 0
  const modalTotal = modalSubtotal + modalPropina - modalDescuento

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">

      {/* Modal de identidad */}
      {showIdentity && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10">
            <h2 className="font-bold text-xl text-gray-900 mb-1">¡Hola! ¿Quién eres tú?</h2>
            <p className="text-sm text-gray-500 mb-5">Para anotarte en lo que pediste.</p>

            <div className="grid grid-cols-2 gap-2">
              {sala.participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectUser(p.nombre)}
                  className="py-3 px-4 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-gray-200 rounded-xl text-gray-800 font-medium text-sm transition-colors text-left"
                >
                  {p.nombre}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="inline-block text-gray-400 hover:text-gray-600 text-2xl leading-none mb-4">&larr;</Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sala.nombre_lugar}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sala.estado === 'completa' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {sala.estado === 'completa' ? 'Boleta completa' : 'Abierta'}
              </span>
              {currentUser && (
                <button
                  onClick={() => setShowIdentity(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full"
                >
                  Tú: {currentUser}
                </button>
              )}
            </div>
          </div>
          <button onClick={copyLink} className="shrink-0 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl transition-colors">
            {copied ? '¡Copiado!' : 'Copiar link'}
          </button>
        </div>

        <div className="mt-3 space-y-1 text-sm text-gray-500">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCLP(totalBoleta)}</span></div>
          {sala.incluir_propina && <div className="flex justify-between"><span>Propina ({sala.propina_porcentaje}%)</span><span>+{formatCLP(propinaMonto)}</span></div>}
          {sala.descuento_tipo !== 'ninguno' && (
            <div className="flex justify-between text-blue-600">
              <span>Descuento {sala.descuento_tipo === 'porcentaje' ? `(${sala.descuento_valor}%)` : `fijo ÷ ${sala.descuento_personas}`}</span>
              <span>−{formatCLP(descuentoMonto)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-100">
            <span>Total</span><span>{formatCLP(totalFinal)}</span>
          </div>
        </div>
        <button onClick={toggleEstado} className="mt-2 text-xs underline text-gray-400 hover:text-gray-600">
          {sala.estado === 'abierta' ? 'Marcar completa' : 'Reabrir sala'}
        </button>
      </div>

      {/* Items */}
      <div className="space-y-3 mb-8">
        {sala.items.map((item) => {
          const claimed = calcItemClaimed(item.claims)
          const isOver = claimed > 1.001
          const cant = item.cantidad ?? 1
          const precioTotal = item.precio * cant
          const split = detectSplit(item.claims)

          return (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {item.nombre}
                    {cant > 1 && <span className="ml-1.5 text-sm font-normal text-gray-400">×{cant}</span>}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCLP(precioTotal)}
                    {cant > 1 && <span className="text-gray-400"> ({formatCLP(item.precio)} c/u)</span>}
                  </p>
                  {split && <p className="text-xs text-blue-500 mt-0.5">División activa: {split} personas</p>}
                </div>
                {sala.estado === 'abierta' && (
                  <button
                    onClick={() => openModal(item)}
                    className="shrink-0 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3 py-1.5 rounded-xl transition-colors"
                  >
                    Anotarme
                  </button>
                )}
              </div>

              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : 'bg-blue-600'}`}
                  style={{ width: `${Math.min(claimed * 100, 100)}%` }}
                />
              </div>

              {item.claims.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.claims.map((claim) => (
                    <ClaimTag
                      key={claim.id}
                      claim={claim}
                      precio={item.precio}
                      cantidad={cant}
                      incluirPropina={sala.incluir_propina}
                      propinaPct={sala.propina_porcentaje}
                      isMine={claim.nombre_persona === currentUser}
                      onDelete={() => deleteClaim(claim.id)}
                    />
                  ))}
                  {isOver && <span className="text-xs text-red-500 self-center">Supera el 100%</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mi resumen */}
      {currentUser && personData.has(currentUser) && (() => {
        const { subtotal, propina } = personData.get(currentUser)!
        let descuento = 0
        if (sala.descuento_tipo === 'porcentaje') descuento = subtotal * (sala.descuento_valor / 100)
        else if (sala.descuento_tipo === 'fijo') descuento = sala.descuento_valor / Math.max(1, sala.descuento_personas)
        const total = subtotal + propina - descuento

        const misItems = sala.items.flatMap(item =>
          item.claims
            .filter(c => c.nombre_persona === currentUser)
            .map(c => ({
              nombre: item.nombre,
              cantidad: item.cantidad ?? 1,
              precio: item.precio,
              num: c.fracciones_num,
              den: c.fracciones_den,
              monto: item.precio * (item.cantidad ?? 1) * (c.fracciones_num / c.fracciones_den),
            }))
        )

        return (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
            <h2 className="font-bold text-blue-800 mb-3">Tu cuenta, {currentUser}</h2>

            <div className="space-y-1.5 mb-3">
              {misItems.map((it, i) => {
                const label = it.den === 1 ? 'entero' : it.den === it.cantidad && it.cantidad > 1 ? `${it.num} de ${it.cantidad}` : `1 de ${it.den}`
                return (
                  <div key={i} className="flex justify-between text-sm text-blue-700">
                    <span>{it.nombre} <span className="text-blue-400 text-xs">({label})</span></span>
                    <span>{formatCLP(it.monto)}</span>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-blue-200 pt-3 space-y-1 text-xs text-blue-500">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCLP(subtotal)}</span></div>
              {sala.incluir_propina && <div className="flex justify-between"><span>Propina ({sala.propina_porcentaje}%)</span><span>+{formatCLP(propina)}</span></div>}
              {descuento > 0 && <div className="flex justify-between"><span>Descuento</span><span>−{formatCLP(descuento)}</span></div>}
            </div>
            <div className="flex justify-between font-black text-blue-800 text-lg mt-2 pt-2 border-t border-blue-200">
              <span>Tu total</span>
              <span>{formatCLP(total)}</span>
            </div>
          </div>
        )
      })()}

      {/* El resto */}
      {totalesPorPersona.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <h2 className="font-semibold text-gray-700 text-sm mb-3">Lo que paga el resto</h2>
          <div className="space-y-2">
            {[...personData.entries()]
              .filter(([persona]) => persona !== currentUser)
              .map(([persona, { subtotal, propina }]) => {
                let descuento = 0
                if (sala.descuento_tipo === 'porcentaje') descuento = subtotal * (sala.descuento_valor / 100)
                else if (sala.descuento_tipo === 'fijo') descuento = sala.descuento_valor / Math.max(1, sala.descuento_personas)
                const total = subtotal + propina - descuento
                return (
                  <div key={persona} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{persona}</span>
                    <span className="font-semibold text-gray-900">{formatCLP(total)}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Modal de item */}
      {modal && modalItem && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-gray-900">{modalItem.nombre}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 text-2xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              Anotando como <strong className="text-gray-700">{currentUser}</strong>
              {cantidad > 1 && ` · ${cantidad} unidades · ${formatCLP(modalItem.precio)} c/u`}
            </p>

            {/* Tabs */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => { setMode('unidades'); setUnidades(1) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'unidades' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {cantidad > 1 ? 'Por unidades' : 'Entero'}
              </button>
              <button
                type="button"
                onClick={() => setMode('dividir')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'dividir' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Lo dividimos
              </button>
            </div>

            {mode === 'unidades' && cantidad > 1 && (
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4">
                <span className="text-sm text-gray-600">¿Cuántas pagas tú?</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setUnidades(u => Math.max(1, u - 1))} className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium text-lg leading-none">−</button>
                  <span className="font-semibold text-gray-900 min-w-[2rem] text-center">{unidades}</span>
                  <button type="button" onClick={() => setUnidades(u => Math.min(cantidad, u + 1))} className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium text-lg leading-none">+</button>
                  <span className="text-sm text-gray-400">de {cantidad}</span>
                </div>
              </div>
            )}
            {mode === 'unidades' && cantidad === 1 && (
              <p className="text-sm text-gray-500 mb-4 bg-gray-50 rounded-xl px-4 py-3">Te anotamos el item completo.</p>
            )}

            {mode === 'dividir' && (
              <div className="mb-4">
                {activeSplit && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-3 text-sm text-blue-700">
                    División activa de <strong>{activeSplit} personas</strong> — {modalItem.claims.filter(c => c.fracciones_den === activeSplit).length} anotados.
                  </div>
                )}
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-600">{activeSplit ? 'Entre cuántos (puedes cambiar)' : '¿Entre cuántos lo dividen?'}</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setNPersonas(n => Math.max(2, n - 1))} className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium text-lg leading-none">−</button>
                    <span className="font-semibold text-gray-900 min-w-[1.5rem] text-center">{nPersonas}</span>
                    <button type="button" onClick={() => setNPersonas(n => Math.min(30, n + 1))} className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium text-lg leading-none">+</button>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5 text-sm text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>{mode === 'dividir' ? `Tu parte (1 de ${nPersonas})` : cantidad > 1 ? `${unidades} de ${cantidad} unidades` : 'Entero'}</span>
                <span>{formatCLP(modalSubtotal)}</span>
              </div>
              {sala.incluir_propina && <div className="flex justify-between text-gray-400"><span>Propina ({sala.propina_porcentaje}%)</span><span>+{formatCLP(modalPropina)}</span></div>}
              {sala.descuento_tipo !== 'ninguno' && (
                <div className="flex justify-between text-blue-600">
                  <span>
                    Descuento {sala.descuento_tipo === 'porcentaje' ? `(${sala.descuento_valor}%)` : `(÷ ${sala.descuento_personas})`}
                    {sala.descuento_tipo === 'fijo' && <span className="text-xs text-gray-400 ml-1">una sola vez</span>}
                  </span>
                  <span>−{formatCLP(modalDescuento)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 pt-1.5 border-t border-gray-200">
                <span>Tu total (aprox.)</span><span>{formatCLP(modalTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleClaim}
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition-colors"
            >
              {submitting ? 'Guardando...' : 'Anotarme'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClaimTag({ claim, precio, cantidad, incluirPropina, propinaPct, isMine, onDelete }: {
  claim: Claim; precio: number; cantidad: number; incluirPropina: boolean; propinaPct: number; isMine: boolean; onDelete: () => void
}) {
  const monto = precio * cantidad * (claim.fracciones_num / claim.fracciones_den)
  const total = incluirPropina ? monto * (1 + propinaPct / 100) : monto
  const [confirming, setConfirming] = useState(false)

  function claimLabel() {
    const { fracciones_num: num, fracciones_den: den } = claim
    if (den === 1) return 'entero'
    if (den === cantidad && cantidad > 1) return `${num} de ${cantidad}`
    return `1 de ${den}`
  }

  return (
    <div className={`flex items-center gap-1 rounded-full pl-3 pr-1 py-1 text-xs ${isMine ? 'bg-blue-100' : 'bg-gray-100'}`}>
      <span className={`font-medium ${isMine ? 'text-blue-700' : 'text-gray-700'}`}>{claim.nombre_persona}</span>
      <span className={isMine ? 'text-blue-500' : 'text-gray-400'}>{claimLabel()} · {formatCLP(total)}</span>
      {confirming ? (
        <>
          <button onClick={onDelete} className="text-red-500 hover:text-red-700 ml-1 font-medium">¿Eliminar?</button>
          <button onClick={() => setConfirming(false)} className="text-gray-400 hover:text-gray-600 ml-1">No</button>
        </>
      ) : (
        <button onClick={() => setConfirming(true)} className="text-gray-400 hover:text-gray-600 ml-1 leading-none text-base">&times;</button>
      )}
    </div>
  )
}
