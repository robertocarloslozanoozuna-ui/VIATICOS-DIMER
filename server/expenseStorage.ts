import fs from 'fs';
import path from 'path';
import type { ExpenseVerification, ExpenseFileAttachment, ExpenseVerificationSummary } from '../src/types.js';
import { supabase } from './supabase.js';

import { listDocumentsByRequestId, findDocumentById } from './documentRepository.js';
import { documentAttachmentFromRecord } from './documentService.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const VERIFICATIONS_FILE = path.join(DATA_DIR, 'expenses_verifications.json');
let verificationsCache: Map<string, ExpenseVerification> | null = null;

function isVercelRuntime() { return Boolean(process.env.VERCEL); }
function ensureDataDir() {
  if (isVercelRuntime()) return;
  if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.warn('[EXPENSE-STORAGE] Error creating data directory:', e); } }
}
function loadFromDisk(): Map<string, ExpenseVerification> {
  const map = new Map<string, ExpenseVerification>();
  if (isVercelRuntime()) return map;
  try {
    ensureDataDir();
    if (!fs.existsSync(VERIFICATIONS_FILE)) return map;
    const list = JSON.parse(fs.readFileSync(VERIFICATIONS_FILE, 'utf-8')) as ExpenseVerification[];
    if (Array.isArray(list)) for (const item of list) if (item?.folio) map.set(item.folio.toUpperCase().trim(), item);
  } catch (e) { console.error('[EXPENSE-STORAGE] Error reading local cache:', e); }
  return map;
}
function persistToDisk(map: Map<string, ExpenseVerification>) {
  if (isVercelRuntime()) return;
  try { ensureDataDir(); fs.writeFileSync(VERIFICATIONS_FILE, JSON.stringify(Array.from(map.values()), null, 2), 'utf-8'); }
  catch (e) { console.warn('[EXPENSE-STORAGE] Local persistence unavailable:', e); }
}
function mergeAttachmentBinaryIntoVerification(verification: ExpenseVerification, attachment: any): ExpenseVerification {
  if (!attachment?.id || !attachment?.dataUrl) return verification;

  const patchList = (files: any[]) =>
    files.map((file) => file?.id === attachment.id ? { ...file, ...attachment } : file);

  verification.supportFiles = patchList(Array.isArray(verification.supportFiles) ? verification.supportFiles : []);
  verification.pendingFiscalXmls = patchList(Array.isArray(verification.pendingFiscalXmls) ? verification.pendingFiscalXmls : []);

  verification.items = (verification.items || []).map((item: any) => ({
    ...item,
    xmlFile: item.xmlFile?.id === attachment.id ? { ...item.xmlFile, ...attachment } : item.xmlFile,
    pdfFile: item.pdfFile?.id === attachment.id ? { ...item.pdfFile, ...attachment } : item.pdfFile,
    ticketFile: item.ticketFile?.id === attachment.id ? { ...item.ticketFile, ...attachment } : item.ticketFile,
  }));

  if (verification.originalExcelFile?.id === attachment.id) {
    verification.originalExcelFile = { ...verification.originalExcelFile, ...attachment };
  }
  if (verification.refund?.receiptFile?.id === attachment.id) {
    verification.refund.receiptFile = { ...verification.refund.receiptFile, ...attachment };
  }
  if (verification.refund?.signedReceiptFile?.id === attachment.id) {
    verification.refund.signedReceiptFile = { ...verification.refund.signedReceiptFile, ...attachment };
  }

  return verification;
}

function mergeExistingAttachmentBinaries(incoming: ExpenseVerification, existing?: ExpenseVerification | null): ExpenseVerification {
  if (!existing) return incoming;
  const existingById = new Map<string, any>();

  const collect = (file: any) => {
    if (file?.id && file?.dataUrl) existingById.set(file.id, file);
  };

  for (const file of existing.supportFiles || []) collect(file);
  for (const file of existing.pendingFiscalXmls || []) collect(file);
  for (const item of existing.items || []) {
    collect(item.xmlFile);
    collect(item.pdfFile);
    collect(item.ticketFile);
  }
  collect(existing.originalExcelFile);
  collect(existing.refund?.receiptFile);
  collect(existing.refund?.signedReceiptFile);

  const mergeList = (files: any[]) => files.map((file) => {
    const binary = existingById.get(file?.id);
    return binary && !file?.dataUrl ? { ...file, ...binary } : file;
  });

  incoming.supportFiles = mergeList(incoming.supportFiles || []);
  incoming.pendingFiscalXmls = mergeList(incoming.pendingFiscalXmls || []);
  incoming.items = (incoming.items || []).map((item: any) => ({
    ...item,
    xmlFile: item.xmlFile && !item.xmlFile.dataUrl && existingById.has(item.xmlFile.id) ? { ...item.xmlFile, ...existingById.get(item.xmlFile.id) } : item.xmlFile,
    pdfFile: item.pdfFile && !item.pdfFile.dataUrl && existingById.has(item.pdfFile.id) ? { ...item.pdfFile, ...existingById.get(item.pdfFile.id) } : item.pdfFile,
    ticketFile: item.ticketFile && !item.ticketFile.dataUrl && existingById.has(item.ticketFile.id) ? { ...item.ticketFile, ...existingById.get(item.ticketFile.id) } : item.ticketFile,
  }));

  if (incoming.originalExcelFile && !incoming.originalExcelFile.dataUrl && existingById.has(incoming.originalExcelFile.id)) {
    incoming.originalExcelFile = { ...incoming.originalExcelFile, ...existingById.get(incoming.originalExcelFile.id) };
  }
  if (incoming.refund?.receiptFile && !incoming.refund.receiptFile.dataUrl && existingById.has(incoming.refund.receiptFile.id)) {
    incoming.refund.receiptFile = { ...incoming.refund.receiptFile, ...existingById.get(incoming.refund.receiptFile.id) };
  }
  if (incoming.refund?.signedReceiptFile && !incoming.refund.signedReceiptFile.dataUrl && existingById.has(incoming.refund.signedReceiptFile.id)) {
    incoming.refund.signedReceiptFile = { ...incoming.refund.signedReceiptFile, ...existingById.get(incoming.refund.signedReceiptFile.id) };
  }

  return incoming;
}

async function hydrateStorageDocuments(verification: ExpenseVerification): Promise<ExpenseVerification> {
  if (!verification?.requestId) return verification;

  try {
    const records = await listDocumentsByRequestId(verification.requestId);
    if (!records.length) return verification;

    const canonical = records.map(documentAttachmentFromRecord);
    const canonicalIds = new Set(canonical.map((file) => file.id));
    const legacy = Array.isArray(verification.supportFiles) ? verification.supportFiles : [];

    const mergedCanonical = canonical.map((file) => {
      const old = legacy.find((candidate) => candidate?.id === file.id);
      if (!old) return file;
      return {
        ...old,
        ...file,
        manualAmount: file.manualAmount ?? old.manualAmount ?? null,
        analysis: file.analysis || old.analysis,
        dataUrl: '',
      };
    });

    const legacyOnly = legacy.filter((file) => !canonicalIds.has(file.id) || !file.storagePath);
    verification.supportFiles = [...legacyOnly, ...mergedCanonical];
  } catch (error) {
    // Mantener compatibilidad mientras el esquema V2 no exista o durante una transición.
    console.warn('[EXPENSE-STORAGE] V2 document hydration unavailable:', (error as any)?.message || error);
  }

  return verification;
}

function extractVerification(details: any, row: any): ExpenseVerification | null {
  const source = details?.verification || details;
  if (!source?.folio || !Array.isArray(source.items)) return null;
  const folio = String(source.folio).toUpperCase().trim();
  const verification: ExpenseVerification = {
    id: source.id || `exp_${row.id || Date.now()}`, requestId: source.requestId || row.request_id, folio,
    userId: source.userId || row.user_id, userName: source.userName || row.user_name || '', userEmail: source.userEmail || row.user_email || '',
    department: source.department || '', destination: source.destination || '',
    status: source.status || (row.action === 'COMPROBACION_GASTOS_FINALIZADA' ? 'ENVIADA' : 'BORRADOR'), items: source.items,
    totalAmountPaid: Number(source.totalAmountPaid || 0), totalExpenses: Number(source.totalExpenses || 0), difference: Number(source.difference || 0),
    balanceType: source.balanceType || 'EXACTO', balanceAmount: Number(source.balanceAmount || 0), notes: source.notes || '', refund: source.refund,
    supportFiles: Array.isArray(source.supportFiles) ? source.supportFiles : [],
    pendingFiscalXmls: Array.isArray(source.pendingFiscalXmls) ? source.pendingFiscalXmls : [],
    originalExcelFile: source.originalExcelFile,
    excelAuditSummary: source.excelAuditSummary,
    submittedAt: source.submittedAt, updatedAt: source.updatedAt || (row as any).created_at, createdAt: source.createdAt || (row as any).created_at,
  };
  return mergeAttachmentBinaryIntoVerification(verification, details?.documentAttachment);
}
const VERIFICATION_AUDIT_ACTIONS = [
  'COMPROBACION_GASTOS_FINALIZADA',
  'COMPROBACION_GASTOS_BORRADOR',
  'CORRECCION_COMPROBACION_BORRADOR',
  'COMPROBACION_GASTOS_DOCUMENTO',
] as const;

// Seleccionar solo el snapshot de comprobación. No usar details completo:
// los eventos COMPROBACION_GASTOS_DOCUMENTO pueden llevar el binario en
// details.documentAttachment, que no se necesita para cargar el expediente.
const VERIFICATION_AUDIT_SELECT =
  'id,request_id,user_id,user_name,user_email,action,details:details->verification,created_at';

// El endpoint de lista solo necesita campos escalares. Estos alias JSONPath
// nunca seleccionan items, adjuntos, el objeto refund completo ni detalles Base64.
const VERIFICATION_SUMMARY_AUDIT_SELECT =
  'request_id,user_id,user_email,action,created_at,folio:details->verification->>folio,verification_user_id:details->verification->>userId,verification_user_email:details->verification->>userEmail,verification_status:details->verification->>status,total_expenses:details->verification->>totalExpenses,refund_amount:details->verification->refund->>amount,refund_registered_at:details->verification->refund->>registeredAt';

async function readLatestVerificationFromAudit(
  requestId?: string,
  folio?: string,
): Promise<ExpenseVerification | null> {
  const createQuery = (requireItems: boolean) => {
    let query: any = supabase
      .from('audit_logs')
      .select(VERIFICATION_AUDIT_SELECT)
      .in('action', [...VERIFICATION_AUDIT_ACTIONS]);

    if (requestId) {
      query = query.eq('request_id', requestId);
    } else if (folio) {
      query = query.eq('details->verification->>folio', folio);
    } else {
      throw new Error('Se requiere requestId o folio para consultar la comprobación.');
    }

    // Preferir directamente el snapshot válido más reciente. El filtro evita
    // descargar múltiples snapshots históricos que pueden repetir archivos.
    if (requireItems) query = query.contains('details', { verification: { items: [{}] } });
    return query.order('created_at', { ascending: false }).limit(1);
  };

  const { data: validData, error: validError } = await createQuery(true);
  if (validError) throw validError;
  const validRows = (validData || [])
    .map((row: any) => ({ row, verification: extractVerification(row.details, row) }))
    .filter((entry: any) => entry.verification && entry.verification.items.length > 0);
  if (validRows.length > 0) return validRows[0].verification;

  // Si no hay ningún snapshot con partidas (o solo existían borradores vacíos),
  // conservar el último estado como fallback. Este segundo query solo ocurre
  // cuando la consulta dirigida no encontró una comprobación válida.
  const { data: latestData, error: latestError } = await createQuery(false);
  if (latestError) throw latestError;
  const latest = (latestData || [])
    .map((row: any) => extractVerification(row.details, row))
    .find((verification: any) => verification);
  return latest || null;
}

async function getCache() {
  // La caché local no debe disparar una sincronización global de audit_logs.
  // Los datos persistidos se leen por expediente mediante readLatestVerificationFromAudit.
  if (!verificationsCache) verificationsCache = loadFromDisk();
  return verificationsCache;
}

/**
 * Fast in-memory save used immediately after a document upload.
 * The upload route already writes a complete audit snapshot; forcing a full
 * audit_logs synchronization here makes every document wait for the entire
 * historical table and can hit Vercel's 60s runtime limit.
 */
export function saveVerificationFast(v: ExpenseVerification): ExpenseVerification {
  const cleanFolio = String(v.folio || '').toUpperCase().trim();
  if (!cleanFolio) throw new Error('Folio requerido para guardar la comprobación');
  if (!verificationsCache) verificationsCache = loadFromDisk();
  const cloned = JSON.parse(JSON.stringify(v)) as ExpenseVerification;
  cloned.folio = cleanFolio;
  cloned.updatedAt = new Date().toISOString();
  verificationsCache.set(cleanFolio, cloned);
  persistToDisk(verificationsCache);
  return JSON.parse(JSON.stringify(cloned));
}

export async function getVerificationByFolioFast(folio: string, requestId: string): Promise<ExpenseVerification | null> {
  const key = String(folio || '').toUpperCase().trim();
  if (!key || !requestId) return null;

  try {
    const latest = await readLatestVerificationFromAudit(requestId);
    if (!latest || latest.folio !== key) return null;
    const hydrated = await hydrateStorageDocuments(latest);
    if (!verificationsCache) verificationsCache = loadFromDisk();
    verificationsCache.set(key, JSON.parse(JSON.stringify(hydrated)));
    persistToDisk(verificationsCache);
    return JSON.parse(JSON.stringify(hydrated));
  } catch (error) {
    // No convertir un fallo de lectura en "no existe comprobación": las rutas
    // deben abortar el guardado antes de sobrescribir datos con un estado vacío.
    console.warn('[EXPENSE-STORAGE] Targeted folio lookup failed:', error);
    throw error;
  }
}

export async function getVerificationByFolio(folio: string): Promise<ExpenseVerification | null> {
  const key = String(folio || '').toUpperCase().trim();
  if (!key) return null;

  // Resolver el ID de la solicitud y consultar solo su última versión.
  // El fallback por folio conserva compatibilidad si no existe ya la solicitud.
  const { data: request, error: requestError } = await supabase
    .from('travel_requests')
    .select('id')
    .eq('folio', key)
    .maybeSingle();
  if (requestError) throw requestError;

  const latest = request?.id
    ? await readLatestVerificationFromAudit(String(request.id))
    : await readLatestVerificationFromAudit(undefined, key);
  if (!latest || latest.folio !== key) return null;

  const hydrated = await hydrateStorageDocuments(latest);
  if (!verificationsCache) verificationsCache = loadFromDisk();
  verificationsCache.set(key, JSON.parse(JSON.stringify(hydrated)));
  persistToDisk(verificationsCache);
  return JSON.parse(JSON.stringify(hydrated));
}

export async function getVerificationByRequestId(requestId: string): Promise<ExpenseVerification | null> {
  if (!requestId) return null;
  const latest = await readLatestVerificationFromAudit(requestId);
  if (!latest) return null;
  const hydrated = await hydrateStorageDocuments(latest);
  if (!verificationsCache) verificationsCache = loadFromDisk();
  verificationsCache.set(hydrated.folio, JSON.parse(JSON.stringify(hydrated)));
  persistToDisk(verificationsCache);
  return JSON.parse(JSON.stringify(hydrated));
}

export async function listAllVerifications(): Promise<ExpenseVerification[]> {
  // Leer primero los IDs ligeros de solicitudes y después solo el snapshot más
  // reciente de cada expediente. No recorrer ni transferir todo el historial
  // de audit_logs (que incluye snapshots históricos y archivos incrustados).
  const { data: requests, error } = await supabase
    .from('travel_requests')
    .select('id,folio')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const latest = await Promise.all(
    (requests || []).map(async (request: { id: string; folio: string }) => {
      const verification = await readLatestVerificationFromAudit(request.id);
      if (!verification) return null;
      return hydrateStorageDocuments(verification);
    }),
  );

  const verifications = latest.filter(
    (verification): verification is ExpenseVerification => verification !== null,
  );

  if (!verificationsCache) verificationsCache = loadFromDisk();
  for (const verification of verifications) {
    verificationsCache.set(verification.folio, JSON.parse(JSON.stringify(verification)));
  }
  persistToDisk(verificationsCache);
  return verifications.map((verification) => JSON.parse(JSON.stringify(verification)));
}
function toVerificationSummary(
  row: any,
  fallbackFolio: string,
  hasItems: boolean,
): ExpenseVerificationSummary | null {
  const folio = String(row?.folio || fallbackFolio || '').trim().toUpperCase();
  if (!folio) return null;

  const status = String(
    row?.verification_status ||
    (row?.action === 'COMPROBACION_GASTOS_FINALIZADA' ? 'ENVIADA' : 'BORRADOR'),
  ).toUpperCase();
  const hasRefund =
    (row?.refund_amount !== null && row?.refund_amount !== undefined) ||
    (row?.refund_registered_at !== null && row?.refund_registered_at !== undefined);

  return {
    requestId: String(row?.request_id || ''),
    folio,
    userId: String(row?.verification_user_id || row?.user_id || ''),
    userEmail: String(row?.verification_user_email || row?.user_email || '').trim() || undefined,
    status: status === 'ENVIADA' ? 'ENVIADA' : 'BORRADOR',
    totalExpenses: Number(row?.total_expenses || 0),
    hasItems,
    hasRefund,
  };
}

async function readLatestVerificationSummaryFromAudit(
  requestId: string,
  fallbackFolio: string,
): Promise<ExpenseVerificationSummary | null> {
  const createQuery = (requireItems: boolean) => {
    let query: any = supabase
      .from('audit_logs')
      .select(VERIFICATION_SUMMARY_AUDIT_SELECT)
      .eq('request_id', requestId)
      .not('details->verification->>folio', 'is', null)
      .in('action', [...VERIFICATION_AUDIT_ACTIONS]);

    // Comprueba si existen partidas sin devolver el arreglo items.
    if (requireItems) query = query.contains('details', { verification: { items: [{}] } });
    return query.order('created_at', { ascending: false }).limit(1);
  };

  const { data: validRows, error: validError } = await createQuery(true);
  if (validError) throw validError;
  if (validRows?.length) return toVerificationSummary(validRows[0], fallbackFolio, true);

  // Solo si nunca hubo un snapshot con partidas, usar el último estado escalar.
  const { data: latestRows, error: latestError } = await createQuery(false);
  if (latestError) throw latestError;
  if (!latestRows?.length) return null;
  return toVerificationSummary(latestRows[0], fallbackFolio, false);
}

/**
 * Lista liviana para tarjetas y filtros. No hidrata Storage y nunca solicita
 * items, supportFiles, originalExcelFile, pendingFiscalXmls ni Base64.
 */
export async function listAllVerificationSummaries(): Promise<ExpenseVerificationSummary[]> {
  const { data: requests, error } = await supabase
    .from('travel_requests')
    .select('id,folio')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const summaries = await Promise.all(
    (requests || []).map((request: { id: string; folio: string }) =>
      readLatestVerificationSummaryFromAudit(request.id, request.folio),
    ),
  );
  return summaries.filter(
    (summary): summary is ExpenseVerificationSummary => summary !== null,
  );
}

export async function saveVerification(v: ExpenseVerification): Promise<ExpenseVerification> {
  const cleanFolio = String(v.folio || '').toUpperCase().trim(); if (!cleanFolio) throw new Error('Folio requerido para guardar la comprobación');
  const cloned = JSON.parse(JSON.stringify(v)) as ExpenseVerification; cloned.folio = cleanFolio; cloned.updatedAt = new Date().toISOString();
  (await getCache()).set(cleanFolio, cloned); persistToDisk(verificationsCache!); return JSON.parse(JSON.stringify(cloned));
}

type LegacyAttachmentSearch = {
  select: string;
  match: Record<string, unknown>;
  candidates: (row: any) => any[];
};

async function findLegacyAttachmentInAudit(
  requestId: string,
  fileId: string,
): Promise<{ file: ExpenseFileAttachment; folio: string } | null> {
  const metadata = 'folio:details->verification->>folio,requestFolio:details->>folio';
  const searches: LegacyAttachmentSearch[] = [
    {
      select: `documentAttachment:details->documentAttachment,${metadata}`,
      match: { documentAttachment: { id: fileId } },
      candidates: (row) => [row.documentAttachment],
    },
    {
      select: `supportFiles:details->verification->supportFiles,${metadata}`,
      match: { verification: { supportFiles: [{ id: fileId }] } },
      candidates: (row) => Array.isArray(row.supportFiles) ? row.supportFiles : [],
    },
    {
      select: `pendingFiscalXmls:details->verification->pendingFiscalXmls,${metadata}`,
      match: { verification: { pendingFiscalXmls: [{ id: fileId }] } },
      candidates: (row) => Array.isArray(row.pendingFiscalXmls) ? row.pendingFiscalXmls : [],
    },
    {
      select: `items:details->verification->items,${metadata}`,
      match: { verification: { items: [{ xmlFile: { id: fileId } }] } },
      candidates: (row) => Array.isArray(row.items) ? row.items.flatMap((item: any) => [item?.xmlFile]) : [],
    },
    {
      select: `items:details->verification->items,${metadata}`,
      match: { verification: { items: [{ pdfFile: { id: fileId } }] } },
      candidates: (row) => Array.isArray(row.items) ? row.items.flatMap((item: any) => [item?.pdfFile]) : [],
    },
    {
      select: `items:details->verification->items,${metadata}`,
      match: { verification: { items: [{ ticketFile: { id: fileId } }] } },
      candidates: (row) => Array.isArray(row.items) ? row.items.flatMap((item: any) => [item?.ticketFile]) : [],
    },
    {
      select: `originalExcelFile:details->verification->originalExcelFile,${metadata}`,
      match: { verification: { originalExcelFile: { id: fileId } } },
      candidates: (row) => [row.originalExcelFile],
    },
    {
      select: `refund:details->verification->refund,${metadata}`,
      match: { verification: { refund: { receiptFile: { id: fileId } } } },
      candidates: (row) => [row.refund?.receiptFile],
    },
    {
      select: `refund:details->verification->refund,${metadata}`,
      match: { verification: { refund: { signedReceiptFile: { id: fileId } } } },
      candidates: (row) => [row.refund?.signedReceiptFile],
    },
  ];

  let metadataOnly: { file: ExpenseFileAttachment; folio: string } | null = null;
  for (const search of searches) {
    // Scope to the request and the exact JSON path that references this file.
    // Return only that attachment collection, never the full audit row/details.
    const { data: queryData, error } = await supabase
      .from('audit_logs')
      .select(search.select)
      .eq('request_id', requestId)
      .in('action', [...VERIFICATION_AUDIT_ACTIONS])
      .contains('details', search.match)
      .order('created_at', { ascending: true })
      .limit(3);
    if (error) throw error;

    // El nombre de columna es dinámico y el cliente Supabase infiere un tipo
    // genérico de error para select(string); normalizar el resultado de runtime
    // a filas parciales evita que ese tipo se propague a cada campo JSON.
    const rows = Array.isArray(queryData) ? queryData as unknown as any[] : [];
    for (const row of rows) {
      const file = search.candidates(row).find((candidate: any) => candidate?.id === fileId);
      if (!file) continue;
      const folio = String(row.folio || row.requestFolio || file.folio || '').toUpperCase().trim();
      const result = { file: file as ExpenseFileAttachment, folio };
      if (typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:') && file.dataUrl.includes(';base64,')) {
        return result;
      }
      if (!metadataOnly) metadataOnly = result;
    }
  }
  return metadataOnly;
}

export async function findFileById(fileId: string, requestId?: string): Promise<{ file: ExpenseFileAttachment; folio: string; concept: string } | null> {
  const key = String(fileId || '').trim();
  if (!key) return null;

  try {
    const document = await findDocumentById(key);
    if (document && document.status !== 'DELETED') {
      return {
        file: documentAttachmentFromRecord(document) as ExpenseFileAttachment,
        folio: String(document.folio || '').toUpperCase().trim(),
        concept: 'Soporte documental',
      };
    }
  } catch (error) {
    console.warn('[EXPENSE-STORAGE] V2 document lookup warning:', (error as any)?.message || error);
  }

  // Los documentos V2 se resuelven arriba desde expense_documents/Storage.
  // Para compatibilidad heredada, buscar únicamente filas del expediente que
  // referencien el ID y proyectar solo el fragmento JSON necesario.
  if (requestId) {
    try {
      const legacy = await findLegacyAttachmentInAudit(requestId, key);
      if (legacy) {
        return { file: legacy.file, folio: legacy.folio, concept: 'Soporte documental' };
      }
    } catch (error) {
      console.warn('[EXPENSE-STORAGE] Targeted legacy file lookup warning:', error);
    }
  }

  // Si no se proporcionó el requestId, poblar la caché desde el último
  // snapshot de cada solicitud (lecturas dirigidas), nunca desde todo el historial.
  if (!requestId) {
    try {
      await listAllVerifications();
    } catch (error) {
      console.warn('[EXPENSE-STORAGE] Targeted legacy file lookup warning:', error);
    }
  }

  for (const v of (await getCache()).values()) {
    for (const item of v.items || []) {
      if (item.xmlFile?.id === key) return { file: item.xmlFile, folio: v.folio, concept: item.concept };
      if (item.pdfFile?.id === key) return { file: item.pdfFile, folio: v.folio, concept: item.concept };
      if (item.ticketFile?.id === key) return { file: item.ticketFile, folio: v.folio, concept: item.concept };
    }
    const support = (v.supportFiles || []).find(f => f?.id === key);
    if (support) return { file: support, folio: v.folio, concept: 'Soporte documental' };
    const pendingXml = (v.pendingFiscalXmls || []).find(f => f?.id === key);
    if (pendingXml) return { file: pendingXml, folio: v.folio, concept: 'Complemento fiscal XML' };
    if (v.originalExcelFile?.id === key) return { file: v.originalExcelFile, folio: v.folio, concept: 'Reporte de gastos Excel' };
    if (v.refund?.receiptFile?.id === key) return { file: v.refund.receiptFile, folio: v.folio, concept: 'Comprobante de Reembolso a Finanzas' };
    if (v.refund?.signedReceiptFile?.id === key) return { file: v.refund.signedReceiptFile, folio: v.folio, concept: 'Recibo de Reembolso Firmado' };
  }
  return null;
}
