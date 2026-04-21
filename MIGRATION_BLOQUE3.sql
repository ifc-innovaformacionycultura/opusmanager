-- =========================================================================
--  OPUS MANAGER · Migration Bloque 3
--  Comentarios internos + Notificaciones gestor + Registro de actividad
--  + Columnas auxiliares usadas por /api/gestor/pendientes y reclamaciones
--
--  100% IDEMPOTENTE — se puede ejecutar múltiples veces sin efectos
--  secundarios. Ejecutar en Supabase SQL Editor con un usuario con
--  privilegios (por defecto `postgres` o el rol dueño del schema public).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) Columnas auxiliares sobre tablas existentes
-- -------------------------------------------------------------------------

-- 1.a  usuarios: tracking de perfil y último acceso del gestor
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ultima_actualizacion_perfil TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_acceso_gestor        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_ultima_act_perfil
  ON usuarios (ultima_actualizacion_perfil DESC);

-- 1.b  asignaciones: fecha en que el músico respondió (confirmado / rechazado)
ALTER TABLE asignaciones
  ADD COLUMN IF NOT EXISTS fecha_respuesta TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha_respuesta
  ON asignaciones (fecha_respuesta DESC);

-- 1.c  reclamaciones: trazabilidad de qué gestor la ha atendido
ALTER TABLE reclamaciones
  ADD COLUMN IF NOT EXISTS gestor_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gestor_nombre  TEXT;

-- -------------------------------------------------------------------------
-- 2) Comentarios internos del equipo (notas privadas entre gestores)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comentarios_internos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo           TEXT NOT NULL,              -- 'reclamacion' | 'evento' | ...
  entidad_id     UUID NOT NULL,              -- id de la entidad comentada
  gestor_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  gestor_nombre  TEXT,
  contenido      TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_entidad
  ON comentarios_internos (tipo, entidad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comentarios_gestor
  ON comentarios_internos (gestor_id);

-- -------------------------------------------------------------------------
-- 3) Notificaciones internas para gestores (campana 🔔)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones_gestor (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gestor_id      UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,              -- 'mencion_comentario' | 'reclamacion_nueva' | ...
  titulo         TEXT,
  descripcion    TEXT,
  entidad_tipo   TEXT,                       -- 'comentario' | 'reclamacion' | 'evento' ...
  entidad_id     UUID,
  leida          BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_gestor_id
  ON notificaciones_gestor (gestor_id, leida, created_at DESC);

-- -------------------------------------------------------------------------
-- 4) Registro de actividad global (auditoría de gestores)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registro_actividad (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo            TEXT NOT NULL,             -- 'musico_creado' | 'reclamacion_resuelta' | ...
  descripcion     TEXT,
  usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre  TEXT,
  entidad_tipo    TEXT,
  entidad_id      UUID,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registro_actividad_created
  ON registro_actividad (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registro_actividad_tipo
  ON registro_actividad (tipo);

-- -------------------------------------------------------------------------
-- 5) Row Level Security (RLS)
--    El backend usa la SERVICE ROLE KEY (bypass RLS), así que RLS aquí se
--    configura para que clientes anónimos / autenticados NO puedan leer ni
--    escribir estas tablas directamente desde el frontend. Todo el acceso
--    se hace a través de endpoints FastAPI con JWT de gestor verificado.
-- -------------------------------------------------------------------------
ALTER TABLE comentarios_internos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_gestor   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_actividad      ENABLE ROW LEVEL SECURITY;

-- Borrar policies previas si existen (idempotencia) y recrear bloqueo total
DROP POLICY IF EXISTS "block_all_comentarios"    ON comentarios_internos;
DROP POLICY IF EXISTS "block_all_notificaciones" ON notificaciones_gestor;
DROP POLICY IF EXISTS "block_all_actividad"      ON registro_actividad;

CREATE POLICY "block_all_comentarios"    ON comentarios_internos    FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "block_all_notificaciones" ON notificaciones_gestor   FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "block_all_actividad"      ON registro_actividad      FOR ALL USING (false) WITH CHECK (false);

-- =========================================================================
--  FIN · Tras ejecutar, el backend puede insertar/leer con service role.
-- =========================================================================
