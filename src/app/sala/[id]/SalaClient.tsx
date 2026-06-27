'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCLP, calcItemClaimed } from '@/lib/utils'
import type { RoomWithBoletas, BoletaWithItems, ItemWithClaims, Claim } from '@/lib/types'

type Modal = { itemId: string; boletaId: string } | null
type Mode = 'unidades' | 'dividir'
type ItemInput = { nombre: string; precio: string; cantidad: number }
type DescuentoTipo = 'ninguno' | 'porcentaje' | 'fijo'

function detectSplit(claims: Claim[]): number | null {
  const counts = new Map<number, number>()
  for (const c of claims) {
    if (c.fracciones_den > 1) counts.set(c.fracciones_den, (counts.get(c.fracciones_den) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export default function SalaClient({ sala: initialSala }: { sala: RoomWithBoletas }) {
  const [sala, setSala] = useState(initialSala)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [showIdentity, setShowIdentity] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [mode, setMode] = useState<Mode>('unidades')
  const [unidades, setUnidades] = useState(1)
  const [nPersonas, setNPersonas] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAgregarBoleta, setShowAgregarBoleta] = useState(false)

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
      setShowIdentity(true)
    }
  }, [storageKey])

  useEffect(() => {
    const channel = supabase
      .channel(`sala-${sala.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, fetchSala)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchSala)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boletas' }, fetchSala)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchSala)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sala.id, fetchSala])

  function selectUser(nombre: string) {
    localStorage.setItem(storageKey, nombre)
    setCurrentUser(nombre)
    setShowIdentity(false)

    const existing: string[] = JSON.parse(localStorage.getItem('dividiendola_rooms') ?? '[]')
    if (!existing.includes(sala.id)) {
      localStorage.setItem('dividiendola_rooms', JSON.stringify([sala.id, ...existing]))
    }
  }

  function openModal(item: ItemWithClaims, boleta: BoletaWithItems) {
    if (!currentUser) { setShowIdentity(true); return }
    const activeSplit = detectSplit(item.claims)
    setModal({ itemId: item.id, boletaId: boleta.id })
    setMode(activeSplit ? 'dividir' : 'unidades')
    setUnidades(1)
    setNPersonas(activeSplit ?? 2)
  }

  const modalBoleta = modal ? sala.boletas.find(b => b.id === modal.boletaId) ?? null : null
  const modalItem = modal ? sala.boletas.flatMap(b => b.items).find(i => i.id === modal.itemId) ?? null : null
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

  // Totales por persona: agrega a través de todas las boletas, cada una con su propia propina/descuento
  const personData = new Map<string, { subtotal: number; propina: number; descuento: number }>()
  for (const boleta of sala.boletas) {
    const boletaPersonData = new Map<string, { subtotal: number; propina: number }>()
    for (const item of boleta.items) {
      const precioTotal = item.precio * (item.cantidad ?? 1)
      for (const claim of item.claims) {
        const portion = precioTotal * (claim.fracciones_num / claim.fracciones_den)
        const propina = boleta.incluir_propina ? portion * (boleta.propina_porcentaje / 100) : 0
        const prev = boletaPersonData.get(claim.nombre_persona) ?? { subtotal: 0, propina: 0 }
        boletaPersonData.set(claim.nombre_persona, { subtotal: prev.subtotal + portion, propina: prev.propina + propina })
      }
    }
    for (const [persona, { subtotal, propina }] of boletaPersonData) {
      let descuento = 0
      if (boleta.descuento_tipo === 'porcentaje') descuento = subtotal * (boleta.descuento_valor / 100)
      else if (boleta.descuento_tipo === 'fijo') descuento = boleta.descuento_valor / Math.max(1, boleta.descuento_personas)
      const prev = personData.get(persona) ?? { subtotal: 0, propina: 0, descuento: 0 }
      personData.set(persona, { subtotal: prev.subtotal + subtotal, propina: prev.propina + propina, descuento: prev.descuento + descuento })
    }
  }

  // Total global de la sala
  const totalFinal = sala.boletas.reduce((acc, boleta) => {
    const totalBoleta = boleta.items.reduce((a, i) => a + i.precio * (i.cantidad ?? 1), 0)
    const propina = boleta.incluir_propina ? totalBoleta * (boleta.propina_porcentaje / 100) : 0
    const descuento = boleta.descuento_tipo === 'porcentaje'
      ? totalBoleta * (boleta.descuento_valor / 100)
      : boleta.descuento_tipo === 'fijo' ? boleta.descuento_valor : 0
    return acc + totalBoleta + propina - descuento
  }, 0)

  // Modal de item
  const cantidad = modalItem?.cantidad ?? 1
  const modalNum = mode === 'unidades' ? unidades : 1
  const modalDen = mode === 'unidades' ? cantidad : nPersonas
  const modalPrecioTotal = modalItem ? modalItem.precio * cantidad : 0
  const modalSubtotal = modalPrecioTotal * (modalNum / modalDen)
  const modalPropina = modalBoleta?.incluir_propina ? modalSubtotal * (modalBoleta.propina_porcentaje / 100) : 0
  const modalDescuento = modalBoleta?.descuento_tipo === 'porcentaje'
    ? modalSubtotal * ((modalBoleta.descuento_valor) / 100)
    : modalBoleta?.descuento_tipo === 'fijo'
      ? (modalBoleta.descuento_valor) / Math.max(1, modalBoleta.descuento_personas)
      : 0
  const modalTotal = modalSubtotal + modalPropina - modalDescuento

  const salaTitle = sala.nombre ?? sala.boletas[0]?.nombre_lugar ?? sala.nombre_lugar

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">

      {/* Modal identidad */}
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
            <h1 className="text-2xl font-bold text-gray-900">{salaTitle}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sala.estado === 'completa' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {sala.estado === 'completa' ? 'Boleta completa' : 'Abierta'}
              </span>
              {sala.boletas.length > 1 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sala.boletas.length} boletas</span>
              )}
              {currentUser && (
                <button onClick={() => setShowIdentity(true)} className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                  Tú: {currentUser}
                </button>
              )}
            </div>
          </div>
          <button onClick={copyLink} className="shrink-0 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl transition-colors">
            {copied ? '¡Copiado!' : 'Copiar link'}
          </button>
        </div>

        <div className="mt-3 flex justify-between items-center text-sm">
          <span className="text-gray-500">Total {sala.boletas.length > 1 ? `(${sala.boletas.length} boletas)` : ''}</span>
          <span className="font-semibold text-gray-800">{formatCLP(totalFinal)}</span>
        </div>
        <button onClick={toggleEstado} className="mt-1 text-xs underline text-gray-400 hover:text-gray-600">
          {sala.estado === 'abierta' ? 'Marcar completa' : 'Reabrir sala'}
        </button>
      </div>

      {/* Boletas */}
      <div className="mb-6 space-y-8">
        {sala.boletas.map((boleta) => {
          const boletaSubtotal = boleta.items.reduce((acc, i) => acc + i.precio * (i.cantidad ?? 1), 0)
          const boletaPropina = boleta.incluir_propina ? boletaSubtotal * (boleta.propina_porcentaje / 100) : 0
          const boletaDescuento = boleta.descuento_tipo === 'porcentaje'
            ? boletaSubtotal * (boleta.descuento_valor / 100)
            : boleta.descuento_tipo === 'fijo' ? boleta.descuento_valor : 0
          const boletaTotal = boletaSubtotal + boletaPropina - boletaDescuento

          return (
            <div key={boleta.id}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <div>
                  <span className="font-semibold text-gray-800">{boleta.nombre_lugar}</span>
                  <div className="flex gap-2 mt-0.5">
                    {boleta.incluir_propina && (
                      <span className="text-xs text-gray-400">Propina {boleta.propina_porcentaje}%</span>
                    )}
                    {boleta.descuento_tipo !== 'ninguno' && (
                      <span className="text-xs text-blue-500">Descuento</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-600">{formatCLP(boletaTotal)}</span>
              </div>

              <div className="space-y-3">
                {boleta.items.map((item) => {
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
                            onClick={() => openModal(item, boleta)}
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
                              incluirPropina={boleta.incluir_propina}
                              propinaPct={boleta.propina_porcentaje}
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
            </div>
          )
        })}
      </div>

      {/* Agregar boleta */}
      {sala.estado === 'abierta' && !showAgregarBoleta && (
        <button
          onClick={() => setShowAgregarBoleta(true)}
          className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50 text-gray-500 hover:text-blue-600 font-medium py-4 rounded-2xl transition-colors mb-6 text-sm"
        >
          + Agregar otra boleta
        </button>
      )}

      {showAgregarBoleta && (
        <AgregarBoletaForm
          roomId={sala.id}
          participantsCount={sala.participants.length}
          onSuccess={() => { fetchSala(); setShowAgregarBoleta(false) }}
          onCancel={() => setShowAgregarBoleta(false)}
        />
      )}

      {/* Mi resumen */}
      {currentUser && personData.has(currentUser) && (() => {
        const { subtotal, propina, descuento } = personData.get(currentUser)!
        const total = subtotal + propina - descuento

        const misItems = sala.boletas.flatMap(boleta =>
          boleta.items.flatMap(item =>
            item.claims
              .filter(c => c.nombre_persona === currentUser)
              .map(c => ({
                boletaNombre: boleta.nombre_lugar,
                nombre: item.nombre,
                cantidad: item.cantidad ?? 1,
                num: c.fracciones_num,
                den: c.fracciones_den,
                monto: item.precio * (item.cantidad ?? 1) * (c.fracciones_num / c.fracciones_den),
              }))
          )
        )

        const byBoleta = new Map<string, typeof misItems>()
        for (const it of misItems) {
          byBoleta.set(it.boletaNombre, [...(byBoleta.get(it.boletaNombre) ?? []), it])
        }

        return (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
            <h2 className="font-bold text-blue-800 mb-3">Tu cuenta, {currentUser}</h2>

            <div className="space-y-3 mb-3">
              {[...byBoleta.entries()].map(([boletaNombre, items]) => (
                <div key={boletaNombre}>
                  {sala.boletas.length > 1 && (
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">{boletaNombre}</p>
                  )}
                  {items.map((it, i) => {
                    const label = it.den === 1 ? 'entero' : it.den === it.cantidad && it.cantidad > 1 ? `${it.num} de ${it.cantidad}` : `1 de ${it.den}`
                    return (
                      <div key={i} className="flex justify-between text-sm text-blue-700">
                        <span>{it.nombre} <span className="text-blue-400 text-xs">({label})</span></span>
                        <span>{formatCLP(it.monto)}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="border-t border-blue-200 pt-3 space-y-1 text-xs text-blue-500">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCLP(subtotal)}</span></div>
              {propina > 0 && <div className="flex justify-between"><span>Propina</span><span>+{formatCLP(propina)}</span></div>}
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
      {personData.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <h2 className="font-semibold text-gray-700 text-sm mb-3">Lo que paga el resto</h2>
          <div className="space-y-2">
            {[...personData.entries()]
              .filter(([persona]) => persona !== currentUser)
              .map(([persona, { subtotal, propina, descuento }]) => (
                <div key={persona} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{persona}</span>
                  <span className="font-semibold text-gray-900">{formatCLP(subtotal + propina - descuento)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal de item */}
      {modal && modalItem && modalBoleta && (
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

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5 text-sm text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>{mode === 'dividir' ? `Tu parte (1 de ${nPersonas})` : cantidad > 1 ? `${unidades} de ${cantidad} unidades` : 'Entero'}</span>
                <span>{formatCLP(modalSubtotal)}</span>
              </div>
              {modalBoleta.incluir_propina && (
                <div className="flex justify-between text-gray-400">
                  <span>Propina ({modalBoleta.propina_porcentaje}%)</span>
                  <span>+{formatCLP(modalPropina)}</span>
                </div>
              )}
              {modalBoleta.descuento_tipo !== 'ninguno' && (
                <div className="flex justify-between text-blue-600">
                  <span>
                    Descuento {modalBoleta.descuento_tipo === 'porcentaje' ? `(${modalBoleta.descuento_valor}%)` : `(÷ ${modalBoleta.descuento_personas})`}
                    {modalBoleta.descuento_tipo === 'fijo' && <span className="text-xs text-gray-400 ml-1">una sola vez</span>}
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

function AgregarBoletaForm({ roomId, participantsCount, onSuccess, onCancel }: {
  roomId: string
  participantsCount: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const [lugar, setLugar] = useState('')
  const [items, setItems] = useState<ItemInput[]>([{ nombre: '', precio: '', cantidad: 1 }])
  const [descuentoTipo, setDescuentoTipo] = useState<DescuentoTipo>('ninguno')
  const [descuentoValor, setDescuentoValor] = useState('')
  const [incluirPropina, setIncluirPropina] = useState(false)
  const [propinaPct, setPropinaPct] = useState('10')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError('')
    setScanning(true)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)
      const res = await fetch('/api/ocr', { method: 'POST', body: formData, signal: controller.signal })
      clearTimeout(timeout)
      const data = await res.json()
      setScanning(false)

      if (!res.ok || data.error) {
        setScanError(data.error ?? 'No se pudo leer la boleta. Intenta con una foto más clara.')
        return
      }

      if (data.nombre_lugar && !lugar) setLugar(data.nombre_lugar)
      if (data.items?.length) {
        const scanned: ItemInput[] = data.items.map((i: { nombre: string; precio: number; cantidad: number }) => ({
          nombre: i.nombre, precio: String(i.precio), cantidad: i.cantidad ?? 1,
        }))
        setItems(prev => {
          const hasEmpty = prev.length === 1 && !prev[0].nombre && !prev[0].precio
          return hasEmpty ? scanned : [...prev, ...scanned]
        })
      }
      if (data.descuento?.tipo && data.descuento.tipo !== 'ninguno') {
        setDescuentoTipo(data.descuento.tipo as DescuentoTipo)
        setDescuentoValor(String(data.descuento.valor))
      }
    } catch (err: unknown) {
      setScanning(false)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setScanError(isAbort ? 'Tiempo de espera agotado. Intenta con una foto más clara.' : `Error: ${err instanceof Error ? err.message : 'desconocido'}`)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addItem() { setItems(prev => [...prev, { nombre: '', precio: '', cantidad: 1 }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: 'nombre' | 'precio', value: string) {
    const processed = field === 'precio' ? value.replace(/\D/g, '') : value
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: processed } : item))
  }
  function updateCantidad(i: number, delta: number) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validItems = items.filter(i => i.nombre.trim() && i.precio.trim())
    if (!lugar.trim()) return setError('Ingresa el nombre del lugar')
    if (!validItems.length) return setError('Agrega al menos un producto')

    setLoading(true)

    const res = await fetch('/api/boletas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        nombre_lugar: lugar.trim(),
        propina_porcentaje: parseInt(propinaPct, 10) || 10,
        incluir_propina: incluirPropina,
        descuento_tipo: descuentoTipo,
        descuento_valor: parseInt(descuentoValor.replace(/\./g, ''), 10) || 0,
        descuento_personas: participantsCount || 1,
        items: validItems.map(i => ({
          nombre: i.nombre.trim(),
          precio: parseInt(i.precio.replace(/\./g, ''), 10),
          cantidad: i.cantidad,
        })),
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      return setError(data.error ?? 'Error al agregar la boleta')
    }

    onSuccess()
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Nueva boleta</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanning}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 mb-4 text-sm"
      >
        {scanning ? <><span className="animate-spin">⏳</span> Leyendo boleta...</> : <><span>📷</span> Sacar foto de la boleta</>}
      </button>
      {scanError && <p className="mb-3 text-sm text-red-600 text-center">{scanError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del lugar</label>
          <input
            type="text"
            placeholder="Ej: Bar El Toro, Uber, Disco..."
            value={lugar}
            onChange={e => setLugar(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Productos</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Producto"
                    value={item.nombre}
                    onChange={e => updateItem(i, 'nombre', e.target.value)}
                    className="flex-1 border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 text-xl leading-none">&times;</button>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="$0"
                    value={item.precio ? Number(item.precio).toLocaleString('es-CL') : ''}
                    onChange={e => updateItem(i, 'precio', e.target.value)}
                    className="flex-1 border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="flex items-center border border-gray-200 bg-white rounded-lg overflow-hidden">
                    <button type="button" onClick={() => updateCantidad(i, -1)} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-sm font-medium">−</button>
                    <span className="w-6 text-center text-gray-900 font-medium text-sm">{item.cantidad}</span>
                    <button type="button" onClick={() => updateCantidad(i, 1)} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-sm font-medium">+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
            + Agregar producto
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Propina</span>
          <button
            type="button"
            onClick={() => setIncluirPropina(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${incluirPropina ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${incluirPropina ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {incluirPropina && (
          <div className="flex gap-2 flex-wrap">
            {['10', '12', '15'].map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => setPropinaPct(pct)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${propinaPct === pct ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {pct}%
              </button>
            ))}
            <input
              type="number"
              value={propinaPct}
              onChange={e => setPropinaPct(e.target.value)}
              className="w-16 border border-gray-300 rounded-full px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0" max="100"
            />
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Descuento</p>
          <div className="flex gap-2 mb-2">
            {(['ninguno', 'porcentaje', 'fijo'] as DescuentoTipo[]).map(tipo => (
              <button
                key={tipo}
                type="button"
                onClick={() => setDescuentoTipo(tipo)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${descuentoTipo === tipo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {tipo === 'ninguno' ? 'Ninguno' : tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo'}
              </button>
            ))}
          </div>
          {descuentoTipo !== 'ninguno' && (
            <input
              type="text"
              inputMode="numeric"
              placeholder={descuentoTipo === 'porcentaje' ? '% de descuento' : 'Monto a descontar'}
              value={descuentoValor}
              onChange={e => setDescuentoValor(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Guardando...' : 'Agregar boleta'}
        </button>
      </form>
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
