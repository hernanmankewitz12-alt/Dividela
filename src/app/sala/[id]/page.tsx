import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { RoomWithItems } from '@/lib/types'
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

  const [{ data: items }, { data: participants }] = await Promise.all([
    supabase.from('items').select('*, claims(*)').eq('room_id', id).order('created_at'),
    supabase.from('participants').select('*').eq('room_id', id).order('created_at'),
  ])

  const sala: RoomWithItems = { ...room, items: items ?? [], participants: participants ?? [] }

  return <SalaClient sala={sala} />
}
