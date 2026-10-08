-- VIÁTICOS DIMER - V2 de comprobantes
-- Almacenamiento físico separado de audit_logs.
-- Esta migración es aditiva: no modifica ni elimina datos del flujo existente.

create table if not exists public.expense_documents (
  id text primary key,
  request_id text not null references public.travel_requests(id) on delete cascade,
  folio text not null,
  uploaded_by text not null,
  original_name text not null,
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-fA-F]{64}$'),
  storage_bucket text not null,
  storage_path text not null unique,
  document_type text not null check (document_type in ('CFDI_XML','FACTURA_PDF','TICKET','IMAGEN','OTRO')),
  status text not null check (status in ('UPLOADING','UPLOADED','READING','READ','READ_ERROR','MANUAL_REQUIRED','DELETED')),
  reading_status text not null check (reading_status in ('PENDING','NOT_REQUIRED','READ','ERROR')),
  reading_source text null check (reading_source is null or reading_source in ('CFDI_XML')),
  detected_amount numeric null,
  manual_amount numeric null,
  currency text null,
  cfdi_uuid text null,
  cfdi_rfc_emisor text null,
  cfdi_nombre_emisor text null,
  cfdi_fecha timestamptz null,
  cfdi_subtotal numeric null,
  cfdi_total numeric null,
  related_document_id text null references public.expense_documents(id) on delete set null,
  expense_item_id text null,
  uploaded_at timestamptz not null default now(),
  analyzed_at timestamptz null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

alter table public.expense_documents enable row level security;
grant select, insert, update, delete on public.expense_documents to service_role;

create index if not exists idx_expense_documents_request_id
  on public.expense_documents(request_id);

create index if not exists idx_expense_documents_folio
  on public.expense_documents(folio);

create index if not exists idx_expense_documents_sha256
  on public.expense_documents(request_id, sha256);

create index if not exists idx_expense_documents_cfdi_uuid
  on public.expense_documents(request_id, cfdi_uuid)
  where cfdi_uuid is not null;

create index if not exists idx_expense_documents_status
  on public.expense_documents(status);

create table if not exists public.expense_document_readings (
  id text primary key,
  document_id text not null references public.expense_documents(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  engine text not null,
  status text not null,
  amount numeric null,
  currency text null,
  confidence text null,
  error text null,
  raw_result jsonb null,
  created_at timestamptz not null default now()
);

alter table public.expense_document_readings enable row level security;
grant select, insert, update, delete on public.expense_document_readings to service_role;

create index if not exists idx_expense_document_readings_document_id
  on public.expense_document_readings(document_id);

create unique index if not exists uq_expense_documents_sha256
  on public.expense_documents(request_id, sha256)
  where status <> 'DELETED';

create unique index if not exists uq_expense_documents_cfdi_uuid
  on public.expense_documents(request_id, cfdi_uuid)
  where cfdi_uuid is not null and status <> 'DELETED';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'viaticos-comprobantes',
  'viaticos-comprobantes',
  false,
  20971520,
  array[
    'application/pdf',
    'application/xml',
    'text/xml',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.expense_document_readings (
  id text primary key,
  document_id text not null references public.expense_documents(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  engine text not null,
  status text not null,
  amount numeric null,
  currency text null,
  confidence text null,
  error text null,
  raw_result jsonb null,
  created_at timestamptz not null default now()
);