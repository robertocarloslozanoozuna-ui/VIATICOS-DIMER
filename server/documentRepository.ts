import { supabase } from './supabase.js';

export interface ExpenseDocumentRecord {
  id: string;
  request_id: string;
  folio: string;
  uploaded_by: string;
  original_name: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  storage_bucket: string;
  storage_path: string;
  document_type: 'CFDI_XML' | 'FACTURA_PDF' | 'TICKET' | 'IMAGEN' | 'OTRO';
  status: 'UPLOADING' | 'UPLOADED' | 'READING' | 'READ' | 'READ_ERROR' | 'MANUAL_REQUIRED' | 'DELETED';
  reading_status: 'PENDING' | 'NOT_REQUIRED' | 'READ' | 'ERROR';
  reading_source: 'CFDI_XML' | null;
  detected_amount: number | null;
  manual_amount: number | null;
  currency: string | null;
  cfdi_uuid: string | null;
  cfdi_rfc_emisor: string | null;
  cfdi_nombre_emisor: string | null;
  cfdi_fecha: string | null;
  cfdi_subtotal: number | null;
  cfdi_total: number | null;
  related_document_id: string | null;
  expense_item_id: string | null;
  uploaded_at: string;
  analyzed_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export async function findDocumentById(id: string): Promise<ExpenseDocumentRecord | null> {
  const { data, error } = await supabase
    .from('expense_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message || 'No fue posible consultar el documento.');
  return (data as ExpenseDocumentRecord | null) || null;
}

export async function findDocumentByHash(requestId: string, sha256: string): Promise<ExpenseDocumentRecord | null> {
  const { data, error } = await supabase
    .from('expense_documents')
    .select('*')
    .eq('request_id', requestId)
    .eq('sha256', sha256)
    .neq('status', 'DELETED')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || 'No fue posible comprobar duplicados.');
  return (data as ExpenseDocumentRecord | null) || null;
}

export async function createDocument(input: Partial<ExpenseDocumentRecord> & Pick<ExpenseDocumentRecord, 'id' | 'request_id' | 'folio' | 'uploaded_by' | 'original_name' | 'mime_type' | 'extension' | 'size_bytes' | 'sha256' | 'storage_bucket' | 'storage_path' | 'document_type' | 'status' | 'reading_status'>): Promise<ExpenseDocumentRecord> {
  const now = new Date().toISOString();
  const row = {
    ...input,
    uploaded_at: input.uploaded_at || now,
    updated_at: input.updated_at || now,
  };

  const { data, error } = await supabase
    .from('expense_documents')
    .insert(row)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'No fue posible registrar el documento.');
  return data as ExpenseDocumentRecord;
}

export async function updateDocument(id: string, patch: Partial<ExpenseDocumentRecord>): Promise<ExpenseDocumentRecord> {
  const { data, error } = await supabase
    .from('expense_documents')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'No fue posible actualizar el documento.');
  return data as ExpenseDocumentRecord;
}

export async function listDocumentsByRequestId(requestId: string): Promise<ExpenseDocumentRecord[]> {
  const { data, error } = await supabase
    .from('expense_documents')
    .select('*')
    .eq('request_id', requestId)
    .neq('status', 'DELETED')
    .order('uploaded_at', { ascending: true });

  if (error) throw new Error(error.message || 'No fue posible listar los documentos del expediente.');
  return Array.isArray(data) ? data as ExpenseDocumentRecord[] : [];
}
