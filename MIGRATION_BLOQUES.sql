-- OPUS MANAGER - Migration: Profile fields + reclamaciones table
-- Run in Supabase SQL editor OR via service-role client

-- 1) Add extra fields to usuarios (idempotent)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS nacionalidad TEXT,
  ADD COLUMN IF NOT EXISTS otros_instrumentos TEXT,
  ADD COLUMN IF NOT EXISTS especialidad TEXT,
  ADD COLUMN IF NOT EXISTS anos_experiencia INTEGER,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS cv_url TEXT,
  ADD COLUMN IF NOT EXISTS titulaciones JSONB DEFAULT '[]'::jsonb;

-- foto_url y telefono ya existen en la tabla

-- 2) Create reclamaciones table
CREATE TABLE IF NOT EXISTS reclamaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'pendiente',
  respuesta_gestor TEXT,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_resolucion TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reclamaciones_usuario ON reclamaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reclamaciones_evento ON reclamaciones(evento_id);
CREATE INDEX IF NOT EXISTS idx_reclamaciones_estado ON reclamaciones(estado);

-- 3) Create email_log for historial de emails enviados
CREATE TABLE IF NOT EXISTS email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario TEXT NOT NULL,
  asunto TEXT,
  tipo TEXT, -- 'bienvenida' | 'recordatorio_respuesta' | 'aviso_ensayo' | ...
  evento_id UUID,
  usuario_id UUID,
  estado TEXT DEFAULT 'enviado', -- 'enviado' | 'error'
  error_mensaje TEXT,
  resend_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_destinatario ON email_log(destinatario);
CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON email_log(created_at DESC);

-- 4) Create recordatorios_config for per-evento reminders
CREATE TABLE IF NOT EXISTS recordatorios_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- identificador del recordatorio (nueva_asignacion, respuesta_7d, etc)
  activo BOOLEAN DEFAULT FALSE,
  dias_antes INTEGER,
  mensaje_personalizado TEXT,
  destinatario TEXT DEFAULT 'musico', -- 'musico' | 'gestor'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evento_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_recordatorios_evento ON recordatorios_config(evento_id);
