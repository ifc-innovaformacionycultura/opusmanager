-- =====================================================
-- OPUS MANAGER - Políticas RLS SIN RECURSIÓN (VERSIÓN 2)
-- Elimina TODAS las consultas recursivas a usuarios
-- =====================================================

-- PASO 1: Limpiar TODO
-- =====================================================

DROP POLICY IF EXISTS "users_select_own" ON public.usuarios;
DROP POLICY IF EXISTS "gestores_select_all" ON public.usuarios;
DROP POLICY IF EXISTS "users_update_own" ON public.usuarios;
DROP POLICY IF EXISTS "gestores_insert" ON public.usuarios;
DROP POLICY IF EXISTS "gestores_delete" ON public.usuarios;
DROP POLICY IF EXISTS "service_role_all" ON public.usuarios;
DROP POLICY IF EXISTS "eventos_select_authenticated" ON public.eventos;
DROP POLICY IF EXISTS "eventos_all_gestores" ON public.eventos;
DROP POLICY IF EXISTS "asignaciones_select_own" ON public.asignaciones;
DROP POLICY IF EXISTS "asignaciones_select_gestores" ON public.asignaciones;
DROP POLICY IF EXISTS "asignaciones_update_own" ON public.asignaciones;
DROP POLICY IF EXISTS "asignaciones_all_gestores" ON public.asignaciones;
DROP POLICY IF EXISTS "ensayos_select_authenticated" ON public.ensayos;
DROP POLICY IF EXISTS "ensayos_all_gestores" ON public.ensayos;
DROP POLICY IF EXISTS "disponibilidad_all_own" ON public.disponibilidad;
DROP POLICY IF EXISTS "disponibilidad_select_gestores" ON public.disponibilidad;
DROP POLICY IF EXISTS "materiales_select_authenticated" ON public.materiales;
DROP POLICY IF EXISTS "materiales_all_gestores" ON public.materiales;
DROP POLICY IF EXISTS "recordatorios_all_gestores" ON public.recordatorios;
DROP POLICY IF EXISTS "tareas_select_authenticated" ON public.tareas;
DROP POLICY IF EXISTS "tareas_all_gestores" ON public.tareas;
DROP POLICY IF EXISTS "tareas_update_assigned" ON public.tareas;

DROP FUNCTION IF EXISTS public.is_gestor();
DROP FUNCTION IF EXISTS public.current_user_rol();
DROP FUNCTION IF EXISTS public.get_current_usuario_id();

-- PASO 2: Crear funciones que NO consultan usuarios
-- =====================================================

-- Lee rol desde JWT (SIN consultar tabla usuarios)
CREATE OR REPLACE FUNCTION public.current_user_rol()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'rol',
    auth.jwt() -> 'user_metadata' ->> 'rol'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verifica si es gestor (SIN consultar tabla usuarios)
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_rol() = 'gestor';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- PASO 3: Políticas RLS para USUARIOS (sin recursión)
-- =====================================================

CREATE POLICY "users_select_own"
ON public.usuarios FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "gestores_select_all"
ON public.usuarios FOR SELECT TO authenticated
USING (public.is_gestor());

CREATE POLICY "users_update_own"
ON public.usuarios FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "gestores_insert"
ON public.usuarios FOR INSERT TO authenticated
WITH CHECK (public.is_gestor());

CREATE POLICY "gestores_delete"
ON public.usuarios FOR DELETE TO authenticated
USING (public.is_gestor());

CREATE POLICY "service_role_all"
ON public.usuarios FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- PASO 4: Políticas RLS para EVENTOS
-- =====================================================

CREATE POLICY "eventos_select_all"
ON public.eventos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "eventos_modify_gestores"
ON public.eventos FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 5: Políticas RLS para ASIGNACIONES (SIN consultar usuarios)
-- =====================================================

-- Gestores ven y gestionan todo
CREATE POLICY "asignaciones_gestores_all"
ON public.asignaciones FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Service role acceso completo
CREATE POLICY "asignaciones_service_role"
ON public.asignaciones FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- PASO 6: Políticas RLS para ENSAYOS
-- =====================================================

CREATE POLICY "ensayos_select_all"
ON public.ensayos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "ensayos_modify_gestores"
ON public.ensayos FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 7: Políticas RLS para DISPONIBILIDAD
-- =====================================================

-- Gestores ven todo
CREATE POLICY "disponibilidad_gestores_all"
ON public.disponibilidad FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- Service role acceso completo
CREATE POLICY "disponibilidad_service_role"
ON public.disponibilidad FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- PASO 8: Políticas RLS para MATERIALES
-- =====================================================

CREATE POLICY "materiales_select_all"
ON public.materiales FOR SELECT TO authenticated
USING (true);

CREATE POLICY "materiales_modify_gestores"
ON public.materiales FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 9: Políticas RLS para RECORDATORIOS
-- =====================================================

CREATE POLICY "recordatorios_gestores_all"
ON public.recordatorios FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 10: Políticas RLS para TAREAS
-- =====================================================

CREATE POLICY "tareas_select_all"
ON public.tareas FOR SELECT TO authenticated
USING (true);

CREATE POLICY "tareas_modify_gestores"
ON public.tareas FOR ALL TO authenticated
USING (public.is_gestor())
WITH CHECK (public.is_gestor());

-- PASO 11: Actualizar app_metadata del admin
-- =====================================================

UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{rol}',
  '"gestor"'::jsonb
)
WHERE id = '88c9beb9-d4d7-4801-a291-c4f4632a3bed';

-- PASO 12: Verificación
-- =====================================================

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_gestor', 'current_user_rol');

SELECT id, email, raw_app_meta_data->>'rol' as rol
FROM auth.users
WHERE email = 'admin@convocatorias.com';
