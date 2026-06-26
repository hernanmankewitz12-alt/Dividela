import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY no configurada en .env.local' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return Response.json({ error: 'No se recibió imagen' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = (file.type || 'image/jpeg') as string

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      `Analiza esta boleta o cuenta de restaurant/bar chileno y extrae los productos y descuento si hay.
Responde SOLO con un JSON válido, sin texto adicional, con esta estructura exacta:
{
  "nombre_lugar": "nombre del local o null si no se ve",
  "items": [
    { "nombre": "nombre del producto", "precio": 1500, "cantidad": 1 }
  ],
  "descuento": {
    "tipo": "ninguno",
    "valor": 0
  }
}
Reglas para items:
- precio es el precio UNITARIO en pesos chilenos (entero, sin decimales, sin símbolo $)
- Si un item aparece como "x3 Cerveza $3.000", extrae nombre="Cerveza", precio=1000, cantidad=3
- Propina, servicio, subtotales y totales NO se incluyen en items
- Solo productos reales pedidos

Reglas para descuento:
- Si hay un descuento en porcentaje (ej: "10% dcto"): tipo="porcentaje", valor=10
- Si hay un descuento en monto fijo (ej: "Dcto $2.000"): tipo="fijo", valor=2000
- Si no hay descuento: tipo="ninguno", valor=0`,
    ])

    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'No se pudo leer la boleta' }, { status: 422 })

    const data = JSON.parse(jsonMatch[0])
    return Response.json(data)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[OCR]', msg)
    return Response.json({ error: `Error al procesar: ${msg}` }, { status: 500 })
  }
}
