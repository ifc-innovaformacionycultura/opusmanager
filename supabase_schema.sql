-- =====================================================
-- OPUS MANAGER - ESQUEMA COMPLETO SUPABASE
-- Fase 4.1: Migración de MongoDB a Supabase
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TABLA: usuarios (músicos y gestores)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT,
  instrumento TEXT,
  foto_url TEXT,
  datos_bancarios JSONB DEFAULT '{}'::jsonb,
  rol TEXT NOT NULL DEFAULT 'musico' CHECK (rol IN ('gestor', 'musico')),
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'baja')),
  fecha_alta TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);
CREATE INDEX idx_usuarios_user_id ON public.usuarios(user_id);

-- =====================================================
-- 2. TABLA: eventos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  temporada TEXT,
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'liquidado')),
  gestor_id UUID REFERENCES public.usuarios(id),
  tipo TEXT,
  lugar TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_eventos_estado ON public.eventos(estado);
CREATE INDEX idx_eventos_temporada ON public.eventos(temporada);
CREATE INDEX idx_eventos_gestor ON public.eventos(gestor_id);

-- =====================================================
-- 3. TABLA: ensayos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ensayos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID REFERENCES public.eventos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo TEXT DEFAULT 'ensayo' CHECK (tipo IN ('ensayo', 'concierto', 'funcion')),
  obligatorio BOOLEAN DEFAULT true,
  lugar TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_ensayos_evento ON public.ensayos(evento_id);
CREATE INDEX idx_ensayos_fecha ON public.ensayos(fecha);

-- =====================================================
-- 4. TABLA: asignaciones (músicos asignados a eventos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.asignaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES public.eventos(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'rechazado')),
  fecha_respuesta TIMESTAMPTZ,
  comentarios TEXT,
  importe DECIMAL(10, 2) DEFAULT 0,
  estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'enviado', 'pagado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, evento_id)
);

-- Índices
CREATE INDEX idx_asignaciones_usuario ON public.asignaciones(usuario_id);
CREATE INDEX idx_asignaciones_evento ON public.asignaciones(evento_id);
CREATE INDEX idx_asignaciones_estado ON public.asignaciones(estado);

-- =====================================================
-- 5. TABLA: disponibilidad (asistencia a ensayos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.disponibilidad (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
  ensayo_id UUID REFERENCES public.ensayos(id) ON DELETE CASCADE,
  asiste BOOLEAN DEFAULT false,
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, ensayo_id)
);

-- Índices
CREATE INDEX idx_disponibilidad_usuario ON public.disponibilidad(usuario_id);
CREATE INDEX idx_disponibilidad_ensayo ON public.disponibilidad(ensayo_id);

-- =====================================================
-- 6. TABLA: materiales (archivos del evento)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.materiales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID REFERENCES public.eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  tipo TEXT,
  fecha_subida TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_materiales_evento ON public.materiales(evento_id);

-- =====================================================
-- 7. TABLA: recordatorios (automatización)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recordatorios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID REFERENCES public.eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_hito TEXT NOT NULL CHECK (tipo_hito IN (
    'convocatoria_lanzada',
    'limite_respuesta',
    'primer_ensayo',
    'cada_ensayo',
    'funcion',
    'cierre',
    'pago_previsto',
    'pago_realizado'
  )),
  dias_antes INTEGER DEFAULT 0,
  hora_envio TIME DEFAULT '09:00',
  destinatario TEXT DEFAULT 'todos_musicos' CHECK (destinatario IN (
    'musico_sin_responder',
    'todos_musicos',
    'gestor',
    'ambos'
  )),
  canal TEXT DEFAULT 'email' CHECK (canal IN ('email', 'push', 'ambos')),
  asunto TEXT,
  mensaje TEXT NOT NULL,
  repetir_cada_dias INTEGER,
  repetir_hasta TEXT CHECK (repetir_hasta IN ('fecha_limite', 'respuesta_recibida', 'nunca')),
  activo BOOLEAN DEFAULT true,
  ultima_ejecucion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_recordatorios_evento ON public.recordatorios(evento_id);
CREATE INDEX idx_recordatorios_activo ON public.recordatorios(activo);

-- =====================================================
-- 8. TABLA: tareas (gestión de tareas para gestores)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tareas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  evento_id UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
  responsable_id UUID REFERENCES public.usuarios(id),
  deadline TIMESTAMPTZ,
  categoria TEXT DEFAULT 'otro' CHECK (categoria IN (
    'logistica',
    'artistico',
    'administrativo',
    'comunicacion',
    'tecnico',
    'otro'
  )),
  prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN (
    'pendiente',
    'en_progreso',
    'completada',
    'cancelada'
  )),
  recordatorios_dias_antes INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  archivos_adjuntos TEXT[] DEFAULT ARRAY[]::TEXT[],
  comentarios JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_tareas_responsable ON public.tareas(responsable_id);
CREATE INDEX idx_tareas_evento ON public.tareas(evento_id);
CREATE INDEX idx_tareas_estado ON public.tareas(estado);
CREATE INDEX idx_tareas_prioridad ON public.tareas(prioridad);

-- =====================================================
-- 9. TABLA: temporadas (migrada de MongoDB)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.temporadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  activa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. TABLA: contactos (migrada de MongoDB)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contactos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  apellidos TEXT,
  email TEXT,
  telefono TEXT,
  especialidad TEXT,
  instrumento TEXT,
  categoria TEXT,
  notas TEXT,
  estado TEXT DEFAULT 'activo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_contactos_email ON public.contactos(email);
CREATE INDEX idx_contactos_instrumento ON public.contactos(instrumento);

-- =====================================================
-- 11. TABLA: presupuestos (migrada de MongoDB)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.presupuestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID REFERENCES public.temporadas(id) ON DELETE CASCADE,
  budget_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. TABLA: activity_logs (migrada de MongoDB)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.usuarios(id),
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  changes JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_timestamp ON public.activity_logs(timestamp DESC);

-- =====================================================
-- FUNCIONES DE ACTUALIZACIÓN AUTOMÁTICA
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ensayos_updated_at BEFORE UPDATE ON public.ensayos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_asignaciones_updated_at BEFORE UPDATE ON public.asignaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disponibilidad_updated_at BEFORE UPDATE ON public.disponibilidad FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recordatorios_updated_at BEFORE UPDATE ON public.recordatorios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tareas_updated_at BEFORE UPDATE ON public.tareas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_temporadas_updated_at BEFORE UPDATE ON public.temporadas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contactos_updated_at BEFORE UPDATE ON public.contactos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_presupuestos_updated_at BEFORE UPDATE ON public.presupuestos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ensayos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS: usuarios
-- =====================================================

-- Gestores pueden ver todos los usuarios
CREATE POLICY "Gestores pueden ver todos los usuarios"
ON public.usuarios FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- Músicos solo pueden ver su propio perfil
CREATE POLICY "Músicos pueden ver su propio perfil"
ON public.usuarios FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Usuarios pueden actualizar su perfil"
ON public.usuarios FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Gestores pueden crear usuarios
CREATE POLICY "Gestores pueden crear usuarios"
ON public.usuarios FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: eventos
-- =====================================================

-- Todos los usuarios autenticados pueden ver eventos
CREATE POLICY "Todos pueden ver eventos"
ON public.eventos FOR SELECT
TO authenticated
USING (true);

-- Solo gestores pueden crear/modificar eventos
CREATE POLICY "Gestores pueden crear eventos"
ON public.eventos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

CREATE POLICY "Gestores pueden actualizar eventos"
ON public.eventos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

CREATE POLICY "Gestores pueden eliminar eventos"
ON public.eventos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: ensayos
-- =====================================================

-- Todos pueden ver ensayos
CREATE POLICY "Todos pueden ver ensayos"
ON public.ensayos FOR SELECT
TO authenticated
USING (true);

-- Solo gestores pueden modificar ensayos
CREATE POLICY "Gestores pueden gestionar ensayos"
ON public.ensayos FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: asignaciones
-- =====================================================

-- Gestores pueden ver todas las asignaciones
CREATE POLICY "Gestores pueden ver todas las asignaciones"
ON public.asignaciones FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- Músicos solo pueden ver sus propias asignaciones
CREATE POLICY "Músicos pueden ver sus asignaciones"
ON public.asignaciones FOR SELECT
TO authenticated
USING (
  usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
);

-- Músicos pueden actualizar solo el estado y comentarios de sus asignaciones
CREATE POLICY "Músicos pueden actualizar sus asignaciones"
ON public.asignaciones FOR UPDATE
TO authenticated
USING (
  usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
)
WITH CHECK (
  usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
);

-- Gestores pueden crear y modificar todas las asignaciones
CREATE POLICY "Gestores pueden gestionar asignaciones"
ON public.asignaciones FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: disponibilidad
-- =====================================================

-- Gestores pueden ver toda la disponibilidad
CREATE POLICY "Gestores pueden ver disponibilidad"
ON public.disponibilidad FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- Músicos pueden ver y modificar su propia disponibilidad
CREATE POLICY "Músicos pueden ver su disponibilidad"
ON public.disponibilidad FOR SELECT
TO authenticated
USING (
  usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
);

CREATE POLICY "Músicos pueden actualizar su disponibilidad"
ON public.disponibilidad FOR ALL
TO authenticated
USING (
  usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
)
WITH CHECK (
  usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
);

-- Gestores pueden gestionar toda la disponibilidad
CREATE POLICY "Gestores pueden gestionar disponibilidad"
ON public.disponibilidad FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: materiales
-- =====================================================

-- Todos pueden ver materiales de eventos a los que están asignados
CREATE POLICY "Ver materiales de eventos asignados"
ON public.materiales FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.asignaciones a
    WHERE a.evento_id = materiales.evento_id
    AND a.usuario_id = (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- Solo gestores pueden subir/eliminar materiales
CREATE POLICY "Gestores pueden gestionar materiales"
ON public.materiales FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: recordatorios
-- =====================================================

-- Solo gestores pueden gestionar recordatorios
CREATE POLICY "Gestores pueden gestionar recordatorios"
ON public.recordatorios FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: tareas
-- =====================================================

-- Solo gestores pueden gestionar tareas
CREATE POLICY "Gestores pueden gestionar tareas"
ON public.tareas FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: temporadas, contactos, presupuestos
-- =====================================================

-- Todos pueden leer, solo gestores pueden modificar
CREATE POLICY "Todos pueden ver temporadas"
ON public.temporadas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestores pueden gestionar temporadas"
ON public.temporadas FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

CREATE POLICY "Todos pueden ver contactos"
ON public.contactos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestores pueden gestionar contactos"
ON public.contactos FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

CREATE POLICY "Todos pueden ver presupuestos"
ON public.presupuestos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestores pueden gestionar presupuestos"
ON public.presupuestos FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- POLÍTICAS: activity_logs
-- =====================================================

-- Solo gestores pueden ver logs
CREATE POLICY "Gestores pueden ver activity logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.user_id = auth.uid() AND u.rol = 'gestor'
  )
);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Músicos con sus eventos asignados
CREATE OR REPLACE VIEW public.vista_musicos_eventos AS
SELECT 
  u.id as musico_id,
  u.nombre || ' ' || u.apellidos as musico_nombre,
  u.email,
  u.instrumento,
  e.id as evento_id,
  e.nombre as evento_nombre,
  e.temporada,
  a.estado as estado_asignacion,
  a.importe,
  a.estado_pago
FROM public.usuarios u
JOIN public.asignaciones a ON u.id = a.usuario_id
JOIN public.eventos e ON a.evento_id = e.id
WHERE u.rol = 'musico';

-- Vista: Resumen de asistencia por evento
CREATE OR REPLACE VIEW public.vista_asistencia_eventos AS
SELECT 
  e.id as evento_id,
  e.nombre as evento_nombre,
  COUNT(DISTINCT a.usuario_id) as total_musicos,
  COUNT(DISTINCT CASE WHEN a.estado = 'confirmado' THEN a.usuario_id END) as confirmados,
  COUNT(DISTINCT CASE WHEN a.estado = 'rechazado' THEN a.usuario_id END) as rechazados,
  COUNT(DISTINCT CASE WHEN a.estado = 'pendiente' THEN a.usuario_id END) as pendientes
FROM public.eventos e
LEFT JOIN public.asignaciones a ON e.id = a.evento_id
GROUP BY e.id, e.nombre;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar usuario gestor admin (sin user_id de auth aún)
INSERT INTO public.usuarios (nombre, apellidos, email, rol, estado)
VALUES ('Admin', 'OPUS', 'admin@convocatorias.com', 'gestor', 'activo')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- SCRIPT COMPLETADO ✅
-- =====================================================
-- Ejecuta este script en Supabase SQL Editor
-- Luego continúa con la configuración de Supabase Auth
-- =====================================================
