-- ============================================================================
-- MIGRATION — Recibos & Certificados (Iter 18)
-- ============================================================================

-- 1) Tabla CERTIFICADOS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id       UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  temporada       TEXT,
  numero          TEXT,                    -- ej. CERT-2026-0001
  horas_totales   NUMERIC(6,2) DEFAULT 0,
  pdf_url         TEXT,                    -- URL pública del PDF en bucket
  pdf_path        TEXT,                    -- storage_path para borrar/regenerar
  variables       JSONB DEFAULT '{}'::jsonb,
  modificado_manual BOOLEAN DEFAULT FALSE,
  publicado       BOOLEAN DEFAULT TRUE,    -- visible al músico?
  creado_at       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, evento_id)
);
CREATE INDEX IF NOT EXISTS idx_certificados_evento  ON certificados(evento_id);
CREATE INDEX IF NOT EXISTS idx_certificados_usuario ON certificados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_certificados_temp    ON certificados(temporada);

-- 2) Tabla RECIBOS ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS recibos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id   UUID NOT NULL REFERENCES asignaciones(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id       UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  temporada       TEXT,
  numero          TEXT,                    -- ej. RBO-2026-0001
  fecha_pago      DATE,
  importe_bruto   NUMERIC(10,2) DEFAULT 0,
  irpf_porcentaje NUMERIC(5,2)  DEFAULT 0,
  irpf_importe    NUMERIC(10,2) DEFAULT 0,
  importe_neto    NUMERIC(10,2) DEFAULT 0,
  iban_destino    TEXT,
  concepto        TEXT,
  pdf_url         TEXT,
  pdf_path        TEXT,
  variables       JSONB DEFAULT '{}'::jsonb,
  modificado_manual BOOLEAN DEFAULT FALSE,
  publicado       BOOLEAN DEFAULT TRUE,
  creado_at       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asignacion_id)
);
CREATE INDEX IF NOT EXISTS idx_recibos_usuario ON recibos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_recibos_evento  ON recibos(evento_id);
CREATE INDEX IF NOT EXISTS idx_recibos_temp    ON recibos(temporada);

-- 3) Bucket "documentos-musicos" en Supabase Storage -------------------------
-- Crear bucket con ALTER:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-musicos',
  'documentos-musicos',
  TRUE,                 -- público (los PDFs son privados a nivel de URL difícil de adivinar)
  10485760,             -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4) Variables de entorno recomendadas (no SQL — añadir en backend/.env y Railway):
-- IRPF_PORCENTAJE=15            # % retención IRPF profesionales
-- HORAS_ENSAYO_DEFAULT=3        # fallback si ensayo no tiene hora_fin
-- HORAS_FUNCION_DEFAULT=2
-- DIRECTOR_NOMBRE="Jesús Alonso"
-- DIRECTOR_FIRMA_URL=""         # URL pública (opcional)
-- ORG_NOMBRE="IFC OPUS Manager"
-- ORG_CIF=""
-- ORG_DIRECCION=""
