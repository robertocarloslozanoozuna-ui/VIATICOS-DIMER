-- Required by the existing TravelRequest business logic.
-- Safe: adds only nullable columns; existing data is preserved.
alter table public.travel_requests
  add column if not exists approval_token text,
  add column if not exists rejected_by text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz;
