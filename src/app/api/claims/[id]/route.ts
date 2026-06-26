import { supabase } from '@/lib/supabase'

export async function DELETE(_req: Request, ctx: RouteContext<'/api/claims/[id]'>) {
  const { id } = await ctx.params

  const { error } = await supabase.from('claims').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
