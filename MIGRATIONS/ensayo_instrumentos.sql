-- ============================================================
-- BLOQUE ENSAYO_INSTRUMENTOS — Convocatoria por instrumento
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS ensayo_instrumentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ensayo_id UUID REFERENCES ensayos(id) ON DELETE CASCADE,
  instrumento TEXT NOT NULL,
  convocado BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ensayo_id, instrumento)
);

CREATE INDEX IF NOT EXISTS idx_ensayo_instrumentos_ensayo
  ON ensayo_instrumentos(ensayo_id);

NOTIFY pgrst, 'reload schema';
