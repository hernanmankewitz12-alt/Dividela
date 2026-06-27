import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { RoomWithBoletas } from '@/lib/types'
import SalaClient from './SalaClient'

export default async function SalaPage(props: PageProps<'/sala/[id]'>) {
  const { id } = await props.params
  const supabase = await createSupabaseServer()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (roomError || !room) notFound()

  const [{ data: boletas }, { data: participants }] = await Promise.all([
    supabase.from('boletas').select('*, items(*, claims(*))').eq('room_id', id).order('created_at'),
    supabase.from('participants').select('*').eq('room_id', id).order('created_at'),
  ])

  const sala: RoomWithBoletas = { ...room, boletas: boletas ?? [], participants: participants ?? [] }

  return <SalaClient sala={sala} />
}
