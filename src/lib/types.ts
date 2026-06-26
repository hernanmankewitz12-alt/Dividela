export type Room = {
  id: string
  nombre_lugar: string
  propina_porcentaje: number
  incluir_propina: boolean
  descuento_tipo: 'ninguno' | 'porcentaje' | 'fijo'
  descuento_valor: number
  descuento_personas: number
  estado: 'abierta' | 'completa'
  created_at: string
}

export type Item = {
  id: string
  room_id: string
  nombre: string
  precio: number
  cantidad: number
  created_at: string
}

export type Claim = {
  id: string
  item_id: string
  nombre_persona: string
  fracciones_num: number
  fracciones_den: number
  created_at: string
}

export type Participant = {
  id: string
  room_id: string
  nombre: string
  created_at: string
}

export type ItemWithClaims = Item & { claims: Claim[] }
export type RoomWithItems = Room & { items: ItemWithClaims[]; participants: Participant[] }
