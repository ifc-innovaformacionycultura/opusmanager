-- ============================================================================
-- MIGRATION — Servicio de comedor / Comidas (Iter 19)
-- ============================================================================
-- Sigue el mismo patrón que `evento_logistica` + `confirmaciones_logistica`.

-- 1) Tabla EVENTO_COMIDAS  ---------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_comidas (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id                   UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  orden                       INTEGER DEFAULT 1,
  fecha                       DATE,
  hora_inicio                 TIME,
  hora_fin                    TIME,
  lugar                       TEXT,
  menu                         TEXT,            -- descripción del menú (texto largo)
  precio_menu                 NUMERIC(10,2) DEFAULT 0,
  incluye_cafe                BOOLEAN DEFAULT FALSE,
  precio_cafe                 NUMERIC(10,2) DEFAULT 0,
  fecha_limite_confirmacion   DATE,
  notas                       TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evento_comidas_evento ON evento_comidas(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_comidas_fecha  ON evento_comidas(fecha);

-- 2) Tabla CONFIRMACIONES_COMIDA  --------------------------------------------
CREATE TABLE IF NOT EXISTS confirmaciones_comida (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comida_id    UUID NOT NULL REFERENCES evento_comidas(id) ON DELETE CASCADE,
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  confirmado   BOOLEAN,        -- TRUE = sí asistirá / FALSE = no / NULL = sin respuesta
  toma_cafe    BOOLEAN,        -- sólo se considera si la comida incluye café
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comida_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_conf_comida_comida   ON confirmaciones_comida(comida_id);
CREATE INDEX IF NOT EXISTS idx_conf_comida_usuario  ON confirmaciones_comida(usuario_id);
