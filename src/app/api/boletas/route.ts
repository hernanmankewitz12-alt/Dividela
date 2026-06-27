import { createSupabaseServer } from '@/lib/supabase-server'
import { genRoomId } from '@/lib/utils'

export async function POST(req: Request) {
  const body = await req.json()
  const { room_id, nombre_lugar, propina_porcentaje, incluir_propina, descuento_tipo, descuento_valor, descuento_personas, items } = body

  if (!room_id || !nombre_lugar || !items?.length) {
    return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const supabase = await createSupabaseServer()
  const boleta_id = genRoomId()

  const { error: boletaError } = await supabase.from('boletas').insert({
    id: boleta_id,
    room_id,
    nombre_lugar,
    propina_porcentaje: propina_porcentaje ?? 10,
    incluir_propina: incluir_propina ?? false,
    descuento_tipo: descuento_tipo ?? 'ninguno',
    descuento_valor: descuento_valor ?? 0,
    descuento_personas: descuento_personas ?? 1,
  })

  if (boletaError) return Response.json({ error: boletaError.message }, { status: 500 })

  const { error: itemsError } = await supabase.from('items').insert(
    items.map((item: { nombre: string; precio: number; cantidad: number }) => ({
      boleta_id,
      room_id,
      nombre: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad ?? 1,
    }))
  )

  if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 })

  return Response.json({ id: boleta_id })
}
