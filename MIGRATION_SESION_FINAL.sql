-- ============================================================
-- SQL CONSOLIDADO — Bloques 1, 2, 5, 6 (Feb 2026)
-- Ejecutado por el usuario en Supabase SQL Editor
-- ============================================================

UPDATE cachets_config
  SET nivel_estudios = 'Superior finalizado'
  WHERE nivel_estudios IN ('Música clásica', 'General');

UPDATE cachets_config
  SET nivel_estudios = 'Profesional finalizado'
  WHERE nivel_estudios = 'Profesional';

CREATE UNIQUE INDEX IF NOT EXISTS ux_cachets_base_instr_nivel
  ON cachets_config (instrumento, nivel_estudios)
  WHERE evento_id IS NULL;

CREATE TABLE IF NOT EXISTS incidencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT CHECK (tipo IN ('incidencia','mejora','pregunta')) NOT NULL,
  descripcion TEXT NOT NULL,
  pagina TEXT,
  screenshot_url TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_revision','resuelto')),
  respuesta TEXT,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_created ON incidencias(created_at DESC);
