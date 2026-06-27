import { createSupabaseServer } from '@/lib/supabase-server'

export async function GET(_req: Request, ctx: RouteContext<'/api/salas/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServer()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (roomError || !room) {
    return Response.json({ error: 'Sala no encontrada' }, { status: 404 })
  }

  const [{ data: boletas, error: boletasError }, { data: participants }] = await Promise.all([
    supabase.from('boletas').select('*, items(*, claims(*))').eq('room_id', id).order('created_at'),
    supabase.from('participants').select('*').eq('room_id', id).order('created_at'),
  ])

  if (boletasError) return Response.json({ error: boletasError.message }, { status: 500 })

  return Response.json({ ...room, boletas: boletas ?? [], participants: participants ?? [] })
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/salas/[id]'>) {
  const { id } = await ctx.params
  const body = await req.json()
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('rooms')
    .update({ estado: body.estado })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
