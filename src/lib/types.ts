export type Room = {
  id: string
  nombre: string | null
  nombre_lugar: string
  estado: 'abierta' | 'completa'
  created_at: string
}

export type Boleta = {
  id: string
  room_id: string
  nombre_lugar: string
  propina_porcentaje: number
  incluir_propina: boolean
  descuento_tipo: 'ninguno' | 'porcentaje' | 'fijo'
  descuento_valor: number
  descuento_personas: number
  created_at: string
}

export type Item = {
  id: string
  boleta_id: string
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
export type BoletaWithItems = Boleta & { items: ItemWithClaims[] }
export type RoomWithBoletas = Room & { boletas: BoletaWithItems[]; participants: Participant[] }

// alias for backward compat in mis-salas
export type RoomWithItems = RoomWithBoletas
