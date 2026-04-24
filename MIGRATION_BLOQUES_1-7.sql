-- ============================================================
-- SQL CONSOLIDADO — Bloques 1 a 7
-- Ejecutado por el usuario en Supabase SQL Editor (Feb 2026)
-- ============================================================

ALTER TABLE ensayos
  ADD COLUMN IF NOT EXISTS hora_fin TIME;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS swift TEXT;

COMMENT ON COLUMN usuarios.iban IS 'Número de cuenta bancaria (IBAN) del músico para liquidaciones';
COMMENT ON COLUMN usuarios.swift IS 'Código SWIFT/BIC del banco del músico';

CREATE TABLE IF NOT EXISTS tareas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL,
  responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  responsable_nombre TEXT,
  fecha_inicio DATE,
  fecha_limite DATE NOT NULL,
  prioridad TEXT DEFAULT 'media'
    CHECK (prioridad IN ('alta','media','baja')),
  estado TEXT DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_curso','completada','cancelada')),
  categoria TEXT DEFAULT 'otro'
    CHECK (categoria IN ('artistico','logistico','economico','comunicacion','tecnico','otro')),
  recordatorio_fecha TIMESTAMPTZ,
  recordatorio_enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas(fecha_limite ASC);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_responsable ON tareas(responsable_id);
