-- ============================================================
-- BLOQUE 1B — Nuevas columnas de fechas en tabla eventos
-- Aplicado por el usuario en Supabase SQL Editor (Feb 2026)
-- ============================================================

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS hora_inicio TIME;

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS fecha_inicio_preparacion DATE;

COMMENT ON COLUMN eventos.fecha_inicio IS 'Fecha de la actuación principal (concierto/función)';
COMMENT ON COLUMN eventos.hora_inicio IS 'Hora de la actuación principal';
COMMENT ON COLUMN eventos.fecha_inicio_preparacion IS 'Fecha desde la que empiezan los ensayos/preparación';
COMMENT ON COLUMN eventos.fecha_fin IS 'Fecha de fin del evento (última función/cierre)';
