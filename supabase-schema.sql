-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  nombre_lugar TEXT NOT NULL,
  propina_porcentaje INTEGER NOT NULL DEFAULT 10,
  incluir_propina BOOLEAN NOT NULL DEFAULT FALSE,
  estado TEXT NOT NULL DEFAULT 'abierta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  nombre_persona TEXT NOT NULL,
  fracciones_num INTEGER NOT NULL DEFAULT 1,
  fracciones_den INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso público total (MVP sin auth)
CREATE POLICY "public_all" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON claims FOR ALL USING (true) WITH CHECK (true);

-- Habilitar real-time para las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE claims;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
