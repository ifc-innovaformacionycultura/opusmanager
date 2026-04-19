-- =====================================================
-- OPUS MANAGER - Políticas RLS Seguras (Sin Recursión)
-- =====================================================

-- 1. Habilitar RLS en tabla usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 2. Política: Los usuarios autenticados pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
ON public.usuarios
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Política: Los usuarios autenticados pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Política: Los gestores pueden ver todos los perfiles
CREATE POLICY "Gestores can view all profiles"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE user_id = auth.uid() AND rol = 'gestor'
  )
);

-- 5. Política: Solo gestores pueden crear nuevos usuarios
CREATE POLICY "Gestores can insert users"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE user_id = auth.uid() AND rol = 'gestor'
  )
);

-- 6. Política: Service role tiene acceso completo (para backend)
CREATE POLICY "Service role has full access"
ON public.usuarios
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- IMPORTANTE: La política de gestores causa recursión
-- SOLUCIÓN: Usar una función helper
-- =====================================================

-- Crear función helper para verificar si el usuario es gestor
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE user_id = auth.uid()
    AND rol = 'gestor'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reemplazar políticas de gestores usando la función
DROP POLICY IF EXISTS "Gestores can view all profiles" ON public.usuarios;
DROP POLICY IF EXISTS "Gestores can insert users" ON public.usuarios;

CREATE POLICY "Gestores can view all profiles"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR public.is_gestor()
);

CREATE POLICY "Gestores can insert users"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (public.is_gestor());

-- =====================================================
-- APLICAR RLS A OTRAS TABLAS
-- =====================================================

-- Eventos
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view eventos"
ON public.eventos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestores can manage eventos"
ON public.eventos FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Asignaciones
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asignaciones"
ON public.asignaciones FOR SELECT TO authenticated
USING (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
  OR public.is_gestor()
);

CREATE POLICY "Users can update own asignaciones"
ON public.asignaciones FOR UPDATE TO authenticated
USING (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Gestores can manage asignaciones"
ON public.asignaciones FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Ensayos
ALTER TABLE public.ensayos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ensayos"
ON public.ensayos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestores can manage ensayos"
ON public.ensayos FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Disponibilidad
ALTER TABLE public.disponibilidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own disponibilidad"
ON public.disponibilidad FOR ALL TO authenticated
USING (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Gestores can view all disponibilidad"
ON public.disponibilidad FOR SELECT TO authenticated
USING (public.is_gestor());

-- Materiales
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view materiales"
ON public.materiales FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestores can manage materiales"
ON public.materiales FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Recordatorios
ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores can manage recordatorios"
ON public.recordatorios FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Tareas
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tareas"
ON public.tareas FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestores can manage tareas"
ON public.tareas FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

CREATE POLICY "Users can update assigned tareas"
ON public.tareas FOR UPDATE TO authenticated
USING (
  responsable_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Para verificar que las políticas están activas:
-- SELECT tablename, policyname, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public';
