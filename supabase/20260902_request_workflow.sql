-- DIMER VIATICOS
-- Cambios de flujo de solicitudes: fecha requerida de deposito y cancelacion previa a aprobacion.
-- Ejecutar en Supabase SQL Editor.

BEGIN;

ALTER TABLE public.travel_requests
  ADD COLUMN IF NOT EXISTS deposit_date DATE;

CREATE INDEX IF NOT EXISTS idx_requests_deposit_date
  ON public.travel_requests(deposit_date);

COMMIT;
