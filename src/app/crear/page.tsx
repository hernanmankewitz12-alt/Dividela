'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ItemInput = { nombre: string; precio: string; cantidad: number }
type DescuentoTipo = 'ninguno' | 'porcentaje' | 'fijo'

export default function CrearPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [lugar, setLugar] = useState('')
  const [items, setItems] = useState<ItemInput[]>([{ nombre: '', precio: '', cantidad: 1 }])
  const [participantes, setParticipantes] = useState<string[]>([])
  const [nuevoParticipante, setNuevoParticipante] = useState('')
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
          nombre: i.nombre,
          precio: String(i.precio),
          cantidad: i.cantidad ?? 1,
        }))
        setItems((prev) => {
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

  function addItem() {
    setItems((prev) => [...prev, { nombre: '', precio: '', cantidad: 1 }])
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: 'nombre' | 'precio', value: string) {
    const processed = field === 'precio' ? value.replace(/\D/g, '') : value
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: processed } : item)))
  }

  function updateCantidad(i: number, delta: number) {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validItems = items.filter((i) => i.nombre.trim() && i.precio.trim())
    if (!lugar.trim()) return setError('Ingresa el nombre del lugar')
    if (!validItems.length) return setError('Agrega al menos un producto')
    if (!participantes.length) return setError('Agrega al menos un participante')

    for (const item of validItems) {
      const p = parseInt(item.precio.replace(/\./g, ''), 10)
      if (isNaN(p) || p <= 0) return setError(`Precio inválido en "${item.nombre}"`)
    }

    setLoading(true)

    const res = await fetch('/api/salas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim() || undefined,
        nombre_lugar: lugar.trim(),
        propina_porcentaje: parseInt(propinaPct, 10) || 10,
        incluir_propina: incluirPropina,
        descuento_tipo: descuentoTipo,
        descuento_valor: parseInt(descuentoValor.replace(/\./g, ''), 10) || 0,
        descuento_personas: participantes.length || 1,
        participantes: participantes.filter(Boolean),
        items: validItems.map((i) => ({
          nombre: i.nombre.trim(),
          precio: parseInt(i.precio.replace(/\./g, ''), 10),
          cantidad: i.cantidad,
        })),
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) return setError(data.error ?? 'Error al crear la sala')

    const existing: string[] = JSON.parse(localStorage.getItem('dividiendola_rooms') ?? '[]')
    localStorage.setItem('dividiendola_rooms', JSON.stringify([data.id, ...existing]))

    router.push(`/sala/${data.id}`)
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&larr;</Link>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Nueva boleta</h1>
      </div>

      {/* Botón escanear boleta */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleScan}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 rounded-2xl transition-colors disabled:opacity-60"
        >
          {scanning ? (
            <>
              <span className="animate-spin text-lg">⏳</span>
              Leyendo boleta...
            </>
          ) : (
            <>
              <span className="text-xl">📷</span>
              Sacar foto de la boleta
            </>
          )}
        </button>
        {scanError && <p className="mt-2 text-sm text-red-600 text-center">{scanError}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre del evento (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del evento <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej: Noche del viernes, Cumpleaños de Ana..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Primera boleta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lugar / Primera boleta</label>
          <input
            type="text"
            placeholder="Ej: El Rincón, Sushi Maki, cumpleaños..."
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Productos */}
        <div>
          <h2 className="font-medium text-gray-800 mb-3">Productos</h2>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Producto"
                    value={item.nombre}
                    onChange={(e) => updateItem(i, 'nombre', e.target.value)}
                    className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 text-xl leading-none">
                      &times;
                    </button>
                  )}
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Precio unitario</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="$0"
                      value={item.precio ? Number(item.precio).toLocaleString('es-CL') : ''}
                      onChange={(e) => updateItem(i, 'precio', e.target.value)}
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Cantidad</label>
                    <div className="flex items-center gap-1 border border-gray-200 bg-gray-50 rounded-xl overflow-hidden">
                      <button type="button" onClick={() => updateCantidad(i, -1)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 font-medium">−</button>
                      <span className="w-7 text-center text-gray-900 font-medium text-sm">{item.cantidad}</span>
                      <button type="button" onClick={() => updateCantidad(i, 1)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 font-medium">+</button>
                    </div>
                  </div>
                  {item.precio && item.cantidad > 1 && (
                    <div className="text-right pb-0.5">
                      <label className="text-xs text-gray-400 mb-1 block">Total</label>
                      <span className="text-sm font-semibold text-gray-700">
                        ${((parseInt(item.precio.replace(/\./g, ''), 10) || 0) * item.cantidad).toLocaleString('es-CL')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm">
            + Agregar producto
          </button>
        </div>

        {/* Descuento */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="font-medium text-gray-800 mb-3">Descuento</p>
          <div className="flex gap-2 mb-3">
            {(['ninguno', 'porcentaje', 'fijo'] as DescuentoTipo[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setDescuentoTipo(tipo)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  descuentoTipo === tipo
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tipo === 'ninguno' ? 'Ninguno' : tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo'}
              </button>
            ))}
          </div>

          {descuentoTipo === 'porcentaje' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={descuentoValor}
                onChange={(e) => setDescuentoValor(e.target.value)}
                className="w-24 border border-gray-200 bg-gray-50 rounded-2xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              />
              <span className="text-gray-500 text-sm">% de descuento sobre el total</span>
            </div>
          )}

          {descuentoTipo === 'fijo' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={descuentoValor ? Number(descuentoValor).toLocaleString('es-CL') : ''}
                  onChange={(e) => setDescuentoValor(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 border border-gray-200 bg-gray-50 rounded-2xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>
              {participantes.length > 0 && descuentoValor ? (
                <p className="text-xs text-gray-400">
                  Se divide entre {participantes.length} personas → ${Math.round((parseInt(descuentoValor, 10) || 0) / participantes.length).toLocaleString('es-CL')} c/u
                </p>
              ) : participantes.length === 0 ? (
                <p className="text-xs text-amber-500">Agrega participantes abajo para calcular el descuento por persona</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Propina */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-medium text-gray-800">Propina</span>
              {incluirPropina && <p className="text-xs text-gray-400 mt-0.5">Siempre sobre el total sin descuento</p>}
            </div>
            <button
              type="button"
              onClick={() => setIncluirPropina((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${incluirPropina ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${incluirPropina ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {incluirPropina && (
            <div className="flex gap-2 flex-wrap">
              {['10', '12', '15'].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPropinaPct(pct)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    propinaPct === pct ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <input
                type="number"
                value={propinaPct}
                onChange={(e) => setPropinaPct(e.target.value)}
                className="w-16 border border-gray-300 rounded-full px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                min="0"
                max="100"
              />
            </div>
          )}
          {!incluirPropina && <p className="text-sm text-gray-400">Sin propina</p>}
        </div>

        {/* Participantes */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="font-medium text-gray-800 mb-1">¿Quiénes fueron?</p>
          <p className="text-xs text-gray-400 mb-3">Agrega a todos los que fueron — cada uno elige su nombre al entrar a la sala.</p>

          {participantes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {participantes.map((p, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-100 rounded-full pl-3 pr-1 py-1 text-sm">
                  <span className="text-gray-700">{p}</span>
                  <button
                    type="button"
                    onClick={() => setParticipantes(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-red-500 text-base leading-none ml-1"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre de alguien"
              value={nuevoParticipante}
              onChange={(e) => setNuevoParticipante(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const n = nuevoParticipante.trim()
                  if (n && !participantes.includes(n)) setParticipantes(prev => [...prev, n])
                  setNuevoParticipante('')
                }
              }}
              className="flex-1 border border-gray-200 bg-gray-50 rounded-2xl px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const n = nuevoParticipante.trim()
                if (n && !participantes.includes(n)) setParticipantes(prev => [...prev, n])
                setNuevoParticipante('')
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Resumen total */}
        {(() => {
          const subtotal = items.reduce((acc, i) => {
            const p = parseInt(i.precio || '0', 10)
            return acc + (isNaN(p) ? 0 : p * i.cantidad)
          }, 0)
          if (subtotal === 0) return null
          const propinaMonto = incluirPropina ? Math.round(subtotal * (parseInt(propinaPct, 10) / 100)) : 0
          const descMonto = descuentoTipo === 'porcentaje'
            ? Math.round(subtotal * (parseInt(descuentoValor || '0', 10) / 100))
            : descuentoTipo === 'fijo' ? parseInt(descuentoValor || '0', 10) : 0
          const total = subtotal + propinaMonto - descMonto
          return (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString('es-CL')}</span>
              </div>
              {incluirPropina && (
                <div className="flex justify-between text-gray-500">
                  <span>Propina ({propinaPct}%)</span>
                  <span>+${propinaMonto.toLocaleString('es-CL')}</span>
                </div>
              )}
              {descMonto > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Descuento {descuentoTipo === 'porcentaje' ? `(${descuentoValor}%)` : 'fijo'}</span>
                  <span>−${descMonto.toLocaleString('es-CL')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total boleta</span>
                <span>${total.toLocaleString('es-CL')}</span>
              </div>
            </div>
          )
        })()}

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-lg py-4 rounded-2xl transition-colors"
        >
          {loading ? 'Creando...' : 'Crear y compartir'}
        </button>
      </form>
    </main>
  )
}
