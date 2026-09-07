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
function extractVerification(details: any, row: any): ExpenseVerification | null {
  const source = details?.verification || details;
  if (!source?.folio || !Array.isArray(source.items)) return null;
  const folio = String(source.folio).toUpperCase().trim();
  return {
    id: source.id || `exp_${row.id || Date.now()}`, requestId: source.requestId || row.request_id, folio,
    userId: source.userId || row.user_id, userName: source.userName || row.user_name || '', userEmail: source.userEmail || row.user_email || '',
    department: source.department || '', destination: source.destination || '',
    status: source.status || (row.action === 'COMPROBACION_GASTOS_FINALIZADA' ? 'ENVIADA' : 'BORRADOR'), items: source.items,
    totalAmountPaid: Number(source.totalAmountPaid || 0), totalExpenses: Number(source.totalExpenses || 0), difference: Number(source.difference || 0),
    balanceType: source.balanceType || 'EXACTO', balanceAmount: Number(source.balanceAmount || 0), notes: source.notes || '', refund: source.refund,
    submittedAt: source.submittedAt, updatedAt: source.updatedAt || row.created_at, createdAt: source.createdAt || row.created_at,
  } as ExpenseVerification;
}
async function syncWithSupabase(map: Map<string, ExpenseVerification>) {
  try {
    const { data, error } = await supabase.from('audit_logs').select('*')
      .in('action', ['COMPROBACION_GASTOS_FINALIZADA', 'COMPROBACION_GASTOS_BORRADOR']).order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) return;
    for (const row of data) {
      const verification = extractVerification(row.details, row);
      if (!verification) continue;
      const existing = map.get(verification.folio);
      const incomingTime = new Date(verification.updatedAt || row.created_at || 0).getTime();
      const existingTime = new Date(existing?.updatedAt || 0).getTime();
      if (!existing || incomingTime >= existingTime) map.set(verification.folio, verification);
    }
    persistToDisk(map);
  } catch (e) { console.warn('[EXPENSE-STORAGE] Supabase sync warning:', e); }
}
async function getCache() {
  if (!verificationsCache) verificationsCache = loadFromDisk();
  await syncWithSupabase(verificationsCache);
  return verificationsCache;
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
    if (v.refund?.receiptFile?.id === key) return { file: v.refund.receiptFile, folio: v.folio, concept: 'Comprobante de Reembolso a Finanzas' };
  }
  return null;
}
