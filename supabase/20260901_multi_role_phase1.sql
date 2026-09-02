-- DIMER VIATICOS
-- FASE 1: soporte de multiples roles por usuario
--
-- OBJETIVO:
-- 1. Crear la relacion N:N users <-> roles sin eliminar users.role_id.
-- 2. Migrar cada rol actual de users.role_id a user_roles.
-- 3. Mantener compatibilidad con el modelo actual durante las siguientes fases.
--
-- IMPORTANTE:
-- Este script NO cambia la logica de la aplicacion ni modifica usuarios, roles,
-- permisos, solicitudes, tokens o SMTP fuera de la nueva tabla y su migracion.
-- Ejecutar en Supabase SQL Editor cuando se autorice el cambio de base de datos.

BEGIN;

-- 1) Tabla puente N:N.
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT
);

-- 2) Indices para las dos direcciones de consulta.
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON public.user_roles(role_id);

-- 3) Seguridad consistente con el esquema actual:
--    acceso desde la aplicacion exclusivamente mediante service_role.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO service_role;

-- 4) Migracion idempotente de los roles existentes.
--    Cada usuario conserva exactamente su role_id actual.
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, u.role_id
FROM public.users u
INNER JOIN public.roles r ON r.id = u.role_id
WHERE u.role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;

-- ================================================================
-- VALIDACION (solo lectura)
-- ================================================================
-- Debe devolver la cantidad de usuarios actuales con role_id que tienen
-- una asignacion equivalente en user_roles.
SELECT COUNT(*) AS usuarios_migrados
FROM public.users u
INNER JOIN public.user_roles ur
  ON ur.user_id = u.id
 AND ur.role_id = u.role_id
WHERE u.role_id IS NOT NULL;

-- Revisar usuarios que tengan role_id pero aun no tengan esa asignacion.
SELECT u.id, u.email, u.role_id
FROM public.users u
LEFT JOIN public.user_roles ur
  ON ur.user_id = u.id
 AND ur.role_id = u.role_id
WHERE u.role_id IS NOT NULL
  AND ur.user_id IS NULL;
