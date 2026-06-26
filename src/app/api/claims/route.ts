import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { item_id, nombre_persona, fracciones_num, fracciones_den } = body

  if (!item_id || !nombre_persona || !fracciones_num || !fracciones_den) {
    return Response.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('claims')
    .insert({ item_id, nombre_persona, fracciones_num, fracciones_den })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}
