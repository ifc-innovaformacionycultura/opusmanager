-- FASE 5: Añadir campo requiere_cambio_password a tabla usuarios
-- Ejecuta esto en tu Supabase Dashboard → SQL Editor

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS requiere_cambio_password BOOLEAN DEFAULT true;

-- Verificar que se añadió correctamente
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
AND column_name = 'requiere_cambio_password';

-- Opcional: Establecer en false para usuarios existentes que ya tienen contraseña
-- UPDATE usuarios SET requiere_cambio_password = false WHERE email IN ('admin@convocatorias.com', 'jesusalonsodirector@gmail.com');
