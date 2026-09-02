-- DIMER VIATICOS
-- ROLLBACK FASE 1: soporte de multiples roles por usuario
--
-- USAR SOLO SI SE DECIDE DESHACER LA FASE 1 ANTES DE IMPLEMENTAR LAS
-- SIGUIENTES FASES. NO EJECUTAR SI LA APLICACION YA DEPENDE DE user_roles.
--
-- La columna users.role_id NO se toca porque sigue siendo el modelo
-- compatible y contiene los valores originales.

BEGIN;

DROP TABLE IF EXISTS public.user_roles;

COMMIT;
