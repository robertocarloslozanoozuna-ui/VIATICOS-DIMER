-- VIÁTICOS DIMER - índice FK de relación de documentos
create index if not exists idx_expense_documents_related_document_id
  on public.expense_documents(related_document_id);
