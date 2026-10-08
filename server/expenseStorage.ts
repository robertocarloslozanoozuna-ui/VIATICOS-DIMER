import fs from 'fs';
import path from 'path';
import type { ExpenseVerification, ExpenseFileAttachment } from '../src/types.js';
import { supabase } from './supabase.js';

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
    submittedAt: source.submittedAt, updatedAt: source.updatedAt || row.created_at, createdAt: source.createdAt || row.created_at,
  };
  return mergeAttachmentBinaryIntoVerification(verification, details?.documentAttachment);
}
async function syncWithSupabase(map: Map<string, ExpenseVerification>) {
  try {
    const { data, error } = await supabase.from('audit_logs').select('*')
      .in('action', ['COMPROBACION_GASTOS_FINALIZADA', 'COMPROBACION_GASTOS_BORRADOR', 'CORRECCION_COMPROBACION_BORRADOR', 'COMPROBACION_GASTOS_DOCUMENTO']).order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) return;
    for (const row of data) {
      const verification = extractVerification(row.details, row);
      if (!verification) continue;
      const existing = map.get(verification.folio);
      const incomingTime = new Date(verification.updatedAt || row.created_at || 0).getTime();
      const existingTime = new Date(existing?.updatedAt || 0).getTime();
      if (!existing || incomingTime >= existingTime) {
        // Los autosaves y cierres guardan metadata-only. Conservamos los
        // binarios que ya estaban disponibles en la versión anterior.
        map.set(verification.folio, mergeExistingAttachmentBinaries(verification, existing));
      }
    }
    persistToDisk(map);
  } catch (e) { console.warn('[EXPENSE-STORAGE] Supabase sync warning:', e); }
}
async function getCache() {
  if (!verificationsCache) verificationsCache = loadFromDisk();
  await syncWithSupabase(verificationsCache);
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

export async function getVerificationByFolio(folio: string): Promise<ExpenseVerification | null> {
  const key = String(folio || '').toUpperCase().trim(); if (!key) return null;
  const value = (await getCache()).get(key); return value ? JSON.parse(JSON.stringify(value)) : null;
}
export async function getVerificationByRequestId(requestId: string): Promise<ExpenseVerification | null> {
  if (!requestId) return null; const value = Array.from((await getCache()).values()).find(v => v.requestId === requestId);
  return value ? JSON.parse(JSON.stringify(value)) : null;
}
export async function saveVerification(v: ExpenseVerification): Promise<ExpenseVerification> {
  const cleanFolio = String(v.folio || '').toUpperCase().trim(); if (!cleanFolio) throw new Error('Folio requerido para guardar la comprobación');
  const cloned = JSON.parse(JSON.stringify(v)) as ExpenseVerification; cloned.folio = cleanFolio; cloned.updatedAt = new Date().toISOString();
  (await getCache()).set(cleanFolio, cloned); persistToDisk(verificationsCache!); return JSON.parse(JSON.stringify(cloned));
}
export async function listAllVerifications(): Promise<ExpenseVerification[]> {
  return Array.from((await getCache()).values()).map(v => JSON.parse(JSON.stringify(v)));
}
export async function findFileById(fileId: string): Promise<{ file: ExpenseFileAttachment; folio: string; concept: string } | null> {
  const key = String(fileId || '').trim(); if (!key) return null;
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
