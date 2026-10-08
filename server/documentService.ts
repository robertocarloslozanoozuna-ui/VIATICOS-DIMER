import crypto from 'crypto';
import type { User, ExpenseFileAttachment } from '../src/types.js';
import { supabase } from './supabase.js';
import {
  buildDocumentStoragePath,
  createSignedDownloadUrl,
  createSignedUpload,
  downloadObject,
  extensionOf,
  mimeForExtension,
  objectExists,
  DOCUMENTS_BUCKET,
  DOCUMENT_MAX_SIZE,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from './documentStorage.js';
import {
  createDocument,
  findDocumentByHash,
  findDocumentById,
  listDocumentsByRequestId,
  updateDocument,
  type ExpenseDocumentRecord,
} from './documentRepository.js';
import { readCfdiXml } from './cfdiReader.js';

export function sha256Hex(input: ArrayBuffer | Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(Buffer.from(input as any)).digest('hex');
}

function attachmentFromDocument(doc: ExpenseDocumentRecord): ExpenseFileAttachment {
  return {
    id: doc.id,
    name: doc.original_name,
    size: Number(doc.size_bytes),
    type: doc.mime_type,
    dataUrl: '',
    uploadedAt: doc.uploaded_at,
    role: doc.extension === 'xml' ? 'COMPLEMENTO_FISCAL' : 'COMPROBANTE_PRINCIPAL',
    storageBucket: doc.storage_bucket,
    storagePath: doc.storage_path,
    sha256: doc.sha256,
    documentType: doc.document_type,
    documentStatus: doc.status,
    readingStatus: doc.reading_status,
    manualAmount: doc.manual_amount,
    uuid: doc.cfdi_uuid || undefined,
    analysis: doc.extension === 'xml'
      ? {
          status: doc.status === 'READ' && doc.detected_amount !== null ? 'DETECTADO' : doc.status === 'READ_ERROR' ? 'ERROR' : 'SIN_TOTAL',
          amount: doc.detected_amount ?? undefined,
          documentType: 'FACTURA',
          confidence: doc.detected_amount !== null ? 'ALTA' : 'BAJA',
          source: 'XML',
          includedInTotal: doc.detected_amount !== null,
          requiresReview: doc.detected_amount === null,
          detail: {
            moneda: doc.currency,
            fecha: doc.cfdi_fecha,
            emisor: doc.cfdi_nombre_emisor || doc.cfdi_rfc_emisor,
            uuid: doc.cfdi_uuid,
            subtotal: doc.cfdi_subtotal,
          },
          analyzedAt: doc.analyzed_at || doc.updated_at,
          ...(doc.status === 'READ_ERROR' ? { error: 'No fue posible leer el XML CFDI almacenado.' } : {}),
        }
      : undefined,
  };
}

export function documentAttachmentFromRecord(doc: ExpenseDocumentRecord) {
  return attachmentFromDocument(doc);
}

export async function getDocumentUploadAuthorization(input: {
  requestId: string;
  folio: string;
  user: User;
  name: string;
  type: string;
  size: number;
  sha256: string;
}) {
  const ext = extensionOf(input.name);
  const mime = mimeForExtension(ext);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) throw new Error('Formato no admitido. Usa PDF, XML, JPG, JPEG, PNG o WEBP.');
  if (input.size <= 0 || input.size > DOCUMENT_MAX_SIZE) {
    throw new Error(`El documento debe tener entre 1 byte y ${Math.round(DOCUMENT_MAX_SIZE / (1024 * 1024))} MB.`);
  }
  if (input.sha256 && !/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error('Huella SHA-256 inválida.');
  if (input.type && input.type !== 'application/octet-stream' && input.type !== mime && !(ext === 'xml' && /xml/i.test(input.type))) {
    throw new Error(`El tipo MIME del archivo no coincide con .${ext}.`);
  }

  const duplicate = await findDocumentByHash(input.requestId, input.sha256);
  if (duplicate && duplicate.status !== 'UPLOADING') {
    return { duplicate: true, documentId: duplicate.id, attachment: attachmentFromDocument(duplicate) };
  }

  if (duplicate && duplicate.status === 'UPLOADING') {
    const upload = await createSignedUpload(duplicate.storage_path);
    return {
      duplicate: false,
      resume: true,
      documentId: duplicate.id,
      path: duplicate.storage_path,
      token: upload.token,
      signedUrl: upload.signedUrl,
      mimeType: duplicate.mime_type,
      uploadEndpoint: `${getStorageProjectBaseUrl()}/storage/v1/upload/resumable`,
    };
  }

  const documentId = `doc_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const storagePath = buildDocumentStoragePath(input.folio, documentId, input.name);
  const upload = await createSignedUpload(storagePath);

  const now = new Date().toISOString();
  const document = await createDocument({
    id: documentId,
    request_id: input.requestId,
    folio: input.folio,
    uploaded_by: input.user.id,
    original_name: input.name,
    mime_type: mime,
    extension: ext,
    size_bytes: input.size,
    sha256: input.sha256,
    storage_bucket: DOCUMENTS_BUCKET,
    storage_path: storagePath,
    document_type: ext === 'xml' ? 'CFDI_XML' : ext === 'pdf' ? 'FACTURA_PDF' : ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'IMAGEN' : 'OTRO',
    status: 'UPLOADING',
    reading_status: ext === 'xml' ? 'PENDING' : 'NOT_REQUIRED',
    uploaded_at: now,
    updated_at: now,
  });

  return {
    duplicate: false,
    documentId: document.id,
    path: upload.path,
    token: upload.token,
    signedUrl: upload.signedUrl,
    mimeType: mime,
    uploadEndpoint: `${getStorageProjectBaseUrl()}/storage/v1/upload/resumable`,
  };
}

function getStorageProjectBaseUrl(): string {
  // Reutiliza exactamente la misma SUPABASE_URL del cliente backend.
  // Algunas configuraciones antiguas pueden traer /rest/v1; se normaliza antes de derivar Storage.
  const raw = String(process.env.SUPABASE_URL || '').trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1\/?$/i, '');

  const match = raw.match(/^https?:\/\/([^/\s]+)$/i);
  if (!match) {
    throw new Error(
      'SUPABASE_URL no está configurada correctamente. Debe ser la URL del proyecto, por ejemplo https://njrzitgmnmakungxpmeo.supabase.co',
    );
  }

  const host = match[1].replace(/\.supabase\.co$/i, '');
  if (!host) {
    throw new Error('No fue posible determinar el proyecto Supabase desde SUPABASE_URL.');
  }

  return `https://${host}.storage.supabase.co`;
}

export async function completeExpenseDocument(documentId: string): Promise<ReturnType<typeof documentAttachmentFromRecord>> {
  const doc = await findDocumentById(documentId);
  if (!doc) throw new Error('Documento no encontrado.');
  if (doc.status === 'DELETED') throw new Error('El documento ya fue retirado del expediente.');

  if (!(await objectExists(doc.storage_path))) {
    throw new Error('La carga no se encontró en Storage. El documento no fue confirmado.');
  }

  if (doc.extension !== 'xml') {
    const updated = await updateDocument(doc.id, {
      status: 'MANUAL_REQUIRED',
      reading_status: 'NOT_REQUIRED',
      analyzed_at: null,
    });
    return documentAttachmentFromRecord(updated);
  }

  const reading = await readCfdiXml(await downloadObject(doc.storage_path));
  const { data: priorAttempts, error: priorAttemptsError } = await supabase
    .from('expense_document_readings')
    .select('attempt_number')
    .eq('document_id', doc.id)
    .order('attempt_number', { ascending: false })
    .limit(1);
  if (priorAttemptsError) throw new Error(priorAttemptsError.message || 'No fue posible consultar el historial de lectura.');

  const { error: readingInsertError } = await supabase
    .from('expense_document_readings')
    .insert({
      id: `read_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
      document_id: doc.id,
      attempt_number: Number(priorAttempts?.[0]?.attempt_number || 0) + 1,
      engine: 'CFDI_XML',
      status: reading.status,
      amount: reading.amount,
      currency: reading.currency,
      confidence: reading.status === 'READ' ? 'ALTA' : 'BAJA',
      error: reading.error || null,
      raw_result: {
        uuid: reading.uuid,
        rfcEmisor: reading.rfcEmisor,
        nombreEmisor: reading.nombreEmisor,
        subtotal: reading.subtotal,
      },
    });
  if (readingInsertError) throw new Error(readingInsertError.message || 'No fue posible guardar el historial de lectura.');

  if (reading.status === 'READ') {
    const updated = await updateDocument(doc.id, {
      status: 'READ',
      reading_status: 'READ',
      reading_source: 'CFDI_XML',
      detected_amount: reading.amount,
      currency: reading.currency,
      cfdi_uuid: reading.uuid,
      cfdi_rfc_emisor: reading.rfcEmisor,
      cfdi_nombre_emisor: reading.nombreEmisor,
      cfdi_fecha: reading.date,
      cfdi_subtotal: reading.subtotal,
      cfdi_total: reading.amount,
      analyzed_at: new Date().toISOString(),
    });
    return documentAttachmentFromRecord(updated);
  }

  const updated = await updateDocument(doc.id, {
    status: reading.status === 'SIN_TOTAL' ? 'MANUAL_REQUIRED' : 'READ_ERROR',
    reading_status: 'ERROR',
    reading_source: 'CFDI_XML',
    detected_amount: null,
    currency: reading.currency,
    cfdi_uuid: reading.uuid,
    cfdi_rfc_emisor: reading.rfcEmisor,
    cfdi_nombre_emisor: reading.nombreEmisor,
    cfdi_fecha: reading.date,
    cfdi_subtotal: reading.subtotal,
    cfdi_total: null,
    analyzed_at: new Date().toISOString(),
  });
  return {
    ...documentAttachmentFromRecord(updated),
    analysis: {
      ...documentAttachmentFromRecord(updated).analysis,
      error: reading.error,
      requiresReview: true,
      includedInTotal: false,
    },
  } as any;
}

export async function getExpenseDocument(id: string) {
  return findDocumentById(id);
}

export async function setManualDocumentAmount(id: string, amount: number | null) {
  const doc = await findDocumentById(id);
  if (!doc || doc.status === 'DELETED') throw new Error('Documento no encontrado.');
  const normalized = amount == null ? null : Number(Number(amount).toFixed(2));
  if (normalized !== null && (!Number.isFinite(normalized) || normalized < 0)) {
    throw new Error('Importe manual inválido.');
  }
  const updated = await (await import('./documentRepository.js')).updateDocument(id, {
    manual_amount: normalized,
  });
  return documentAttachmentFromRecord(updated);
}

export async function deleteExpenseDocument(id: string) {
  const doc = await findDocumentById(id);
  if (!doc || doc.status === 'DELETED') throw new Error('Documento no encontrado.');
  try {
    await (await import('./documentStorage.js')).removeObject(doc.storage_path);
  } catch (error: any) {
    if (!/not found|no such|404/i.test(String(error?.message || ''))) throw error;
  }
  const updated = await (await import('./documentRepository.js')).updateDocument(id, {
    status: 'DELETED',
    deleted_at: new Date().toISOString(),
  });
  return documentAttachmentFromRecord(updated);
}

export async function listExpenseDocuments(requestId: string) {
  return listDocumentsByRequestId(requestId);
}

export async function signedDocumentUrl(id: string, download = false) {
  const doc = await findDocumentById(id);
  if (!doc || doc.status === 'DELETED') throw new Error('Documento no encontrado.');
  return createSignedDownloadUrl(doc.storage_path, 300, download);
}
