export function formatCLP(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-CL')
}

export function calcFraccion(num: number, den: number): number {
  return num / den
}

export function fraccionLabel(num: number, den: number): string {
  if (den === 1) return 'entero'
  return `${num}/${den}`
}

export function genRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

export function calcItemClaimed(claims: Array<{ fracciones_num: number; fracciones_den: number }>): number {
  return claims.reduce((acc, c) => acc + c.fracciones_num / c.fracciones_den, 0)
}
