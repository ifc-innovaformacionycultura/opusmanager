-- =====================================================
-- OPUS MANAGER - Políticas RLS SIN RECURSIÓN
-- Usa auth.jwt() para leer rol desde app_metadata
-- =====================================================

-- PASO 1: Limpiar políticas y funciones antiguas
-- =====================================================

-- Drop todas las políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON public.usuarios;
DROP POLICY IF EXISTS "Gestores can view all profiles" ON public.usuarios;
DROP POLICY IF EXISTS "Gestores can insert users" ON public.usuarios;
DROP POLICY IF EXISTS "Service role has full access" ON public.usuarios;
DROP POLICY IF EXISTS "Authenticated users can view eventos" ON public.eventos;
DROP POLICY IF EXISTS "Gestores can manage eventos" ON public.eventos;
DROP POLICY IF EXISTS "Users can view own asignaciones" ON public.asignaciones;
DROP POLICY IF EXISTS "Users can update own asignaciones" ON public.asignaciones;
DROP POLICY IF EXISTS "Gestores can manage asignaciones" ON public.asignaciones;
DROP POLICY IF EXISTS "Authenticated users can view ensayos" ON public.ensayos;
DROP POLICY IF EXISTS "Gestores can manage ensayos" ON public.ensayos;
DROP POLICY IF EXISTS "Users can manage own disponibilidad" ON public.disponibilidad;
DROP POLICY IF EXISTS "Gestores can view all disponibilidad" ON public.disponibilidad;
DROP POLICY IF EXISTS "Authenticated users can view materiales" ON public.materiales;
DROP POLICY IF EXISTS "Gestores can manage materiales" ON public.materiales;
DROP POLICY IF EXISTS "Gestores can manage recordatorios" ON public.recordatorios;
DROP POLICY IF EXISTS "Authenticated users can view tareas" ON public.tareas;
DROP POLICY IF EXISTS "Gestores can manage tareas" ON public.tareas;
DROP POLICY IF EXISTS "Users can update assigned tareas" ON public.tareas;

-- Drop función antigua
DROP FUNCTION IF EXISTS public.is_gestor();
DROP FUNCTION IF EXISTS public.current_user_rol();

-- PASO 2: Crear funciones helpers que leen desde JWT
-- =====================================================

-- Función para obtener el rol del usuario actual desde JWT
CREATE OR REPLACE FUNCTION public.current_user_rol()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'rol',
    auth.jwt() -> 'user_metadata' ->> 'rol'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Función para verificar si el usuario actual es gestor
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_rol() = 'gestor';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- PASO 3: Políticas RLS para tabla USUARIOS
-- =====================================================

-- Usuarios pueden ver su propio perfil
CREATE POLICY "users_select_own"
ON public.usuarios
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Gestores pueden ver todos los perfiles
CREATE POLICY "gestores_select_all"
ON public.usuarios
FOR SELECT
TO authenticated
USING (public.is_gestor());

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "users_update_own"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Solo gestores pueden insertar usuarios
CREATE POLICY "gestores_insert"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (public.is_gestor());

-- Solo gestores pueden eliminar usuarios
CREATE POLICY "gestores_delete"
ON public.usuarios
FOR DELETE
TO authenticated
USING (public.is_gestor());

-- Service role tiene acceso completo (backend)
CREATE POLICY "service_role_all"
ON public.usuarios
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- PASO 4: Políticas RLS para EVENTOS
-- =====================================================

CREATE POLICY "eventos_select_authenticated"
ON public.eventos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "eventos_all_gestores"
ON public.eventos
FOR ALL
TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 5: Políticas RLS para ASIGNACIONES
-- =====================================================

-- Usuarios ven sus propias asignaciones
CREATE POLICY "asignaciones_select_own"
ON public.asignaciones
FOR SELECT
TO authenticated
USING (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
);

-- Gestores ven todas las asignaciones
CREATE POLICY "asignaciones_select_gestores"
ON public.asignaciones
FOR SELECT
TO authenticated
USING (public.is_gestor());

-- Usuarios actualizan sus propias asignaciones
CREATE POLICY "asignaciones_update_own"
ON public.asignaciones
FOR UPDATE
TO authenticated
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

-- Gestores gestionan todas las asignaciones
CREATE POLICY "asignaciones_all_gestores"
ON public.asignaciones
FOR ALL
TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 6: Políticas RLS para ENSAYOS
-- =====================================================

CREATE POLICY "ensayos_select_authenticated"
ON public.ensayos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "ensayos_all_gestores"
ON public.ensayos
FOR ALL
TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 7: Políticas RLS para DISPONIBILIDAD
-- =====================================================

CREATE POLICY "disponibilidad_all_own"
ON public.disponibilidad
FOR ALL
TO authenticated
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

CREATE POLICY "disponibilidad_select_gestores"
ON public.disponibilidad
FOR SELECT
TO authenticated
USING (public.is_gestor());

-- PASO 8: Políticas RLS para MATERIALES
-- =====================================================

CREATE POLICY "materiales_select_authenticated"
ON public.materiales
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "materiales_all_gestores"
ON public.materiales
FOR ALL
TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 9: Políticas RLS para RECORDATORIOS
-- =====================================================

CREATE POLICY "recordatorios_all_gestores"
ON public.recordatorios
FOR ALL
TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 10: Políticas RLS para TAREAS
-- =====================================================

CREATE POLICY "tareas_select_authenticated"
ON public.tareas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "tareas_all_gestores"
ON public.tareas
FOR ALL
TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

CREATE POLICY "tareas_update_assigned"
ON public.tareas
FOR UPDATE
TO authenticated
USING (
  responsable_id IN (
    SELECT id FROM public.usuarios WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- PASO 11: Actualizar usuario admin existente
-- Agregar rol a app_metadata
-- =====================================================

-- Actualizar app_metadata del admin
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{rol}',
    '"gestor"'::jsonb
  )
WHERE id = '88c9beb9-d4d7-4801-a291-c4f4632a3bed';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver políticas activas
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar funciones
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_gestor', 'current_user_rol');

-- Verificar que el admin tiene rol en app_metadata
SELECT id, email, raw_app_meta_data->>'rol' as rol
FROM auth.users
WHERE email = 'admin@convocatorias.com';
