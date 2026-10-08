import crypto from 'crypto';
import type { User, ExpenseFileAttachment } from '../src/types.js';
import {
  buildDocumentStoragePath,
  createSignedDownloadUrl,
  createSignedUpload,
  downloadObject,
  documentTypeFromExtension,
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
  if (duplicate) {
    return { duplicate: true, documentId: duplicate.id, attachment: attachmentFromDocument(duplicate) };
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
    mimeType: mime,
    mimeType: mime,
    uploadEndpoint: `${getStorageProjectBaseUrl()}/storage/v1/upload/resumable`,
  };
}

function getStorageProjectBaseUrl(): string {
  const raw = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const match = raw.match(/^https?:\/\/([^/]+)$/i);
  if (!match) throw new Error('SUPABASE_URL no está configurada correctamente.');
  const host = match[1].replace(/\.supabase\.co$/i, '');
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
    reading_status: reading.status === 'SIN_TOTAL' ? 'ERROR' : 'ERROR',
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

export async function listExpenseDocuments(requestId: string) {
  return listDocumentsByRequestId(requestId);
}

export async function signedDocumentUrl(id: string, download = false) {
  const doc = await findDocumentById(id);
  if (!doc || doc.status === 'DELETED') throw new Error('Documento no encontrado.');
  return createSignedDownloadUrl(doc.storage_path, 300, download);
}
