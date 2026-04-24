-- ============================================================
-- BLOQUE 4 — asistencia_real pasa de BOOLEAN a NUMERIC(5,2)
-- Rango 0..100 (porcentaje de asistencia real por ensayo/función)
-- ============================================================

ALTER TABLE disponibilidad
  ALTER COLUMN asistencia_real TYPE NUMERIC(5,2)
  USING CASE
    WHEN asistencia_real IS TRUE THEN 100
    WHEN asistencia_real IS FALSE THEN 0
    ELSE NULL
  END;

-- Opcional: comentario descriptivo
COMMENT ON COLUMN disponibilidad.asistencia_real IS
  'Porcentaje de asistencia real al ensayo/función (0..100). NULL = sin registrar';
