import { createSupabaseServer } from '@/lib/supabase-server'
import { genRoomId } from '@/lib/utils'

export async function POST(req: Request) {
  const body = await req.json()
  const { nombre_lugar, propina_porcentaje, incluir_propina, descuento_tipo, descuento_valor, descuento_personas, items, participantes } = body

  if (!nombre_lugar || !items?.length) {
    return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const id = genRoomId()

  const { error: roomError } = await supabase.from('rooms').insert({
    id,
    nombre_lugar,
    propina_porcentaje: propina_porcentaje ?? 10,
    incluir_propina: incluir_propina ?? false,
    descuento_tipo: descuento_tipo ?? 'ninguno',
    descuento_valor: descuento_valor ?? 0,
    descuento_personas: descuento_personas ?? 1,
    user_id: user?.id ?? null,
  })

  if (roomError) return Response.json({ error: roomError.message }, { status: 500 })

  const { error: itemsError } = await supabase.from('items').insert(
    items.map((item: { nombre: string; precio: number; cantidad: number }) => ({
      room_id: id,
      nombre: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad ?? 1,
    }))
  )

  if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 })

  if (participantes?.length) {
    await supabase.from('participants').insert(
      participantes.map((nombre: string) => ({ room_id: id, nombre }))
    )
  }

  return Response.json({ id })
}
