import fs from 'fs';
import path from 'path';
import type { ExpenseVerification, ExpenseFileAttachment } from '../src/types.js';
import { supabase } from './supabase.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const VERIFICATIONS_FILE = path.join(DATA_DIR, 'expenses_verifications.json');

let verificationsCache: Map<string, ExpenseVerification> | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('[EXPENSE-STORAGE] Error creating data directory:', e);
    }
  }
}

function loadFromDisk(): Map<string, ExpenseVerification> {
  const map = new Map<string, ExpenseVerification>();
  try {
    ensureDataDir();
    if (fs.existsSync(VERIFICATIONS_FILE)) {
      const raw = fs.readFileSync(VERIFICATIONS_FILE, 'utf-8');
      const list = JSON.parse(raw) as ExpenseVerification[];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.folio) {
            map.set(item.folio.toUpperCase().trim(), item);
          }
        }
      }
    }
  } catch (e) {
    console.error('[EXPENSE-STORAGE] Error reading verifications from disk:', e);
  }
  return map;
}

function persistToDisk(map: Map<string, ExpenseVerification>) {
  try {
    ensureDataDir();
    const list = Array.from(map.values());
    fs.writeFileSync(VERIFICATIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('[EXPENSE-STORAGE] Error persisting verifications to disk:', e);
  }
}

async function syncWithSupabaseAuditLogs(map: Map<string, ExpenseVerification>) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .in('action', ['COMPROBACION_FINALIZADA', 'COMPROBACION_BORRADOR'])
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const details = row.details as any;
        if (details && details.folio && Array.isArray(details.items)) {
          const folioKey = String(details.folio).toUpperCase().trim();
          // Keep the newest version
          const existing = map.get(folioKey);
          if (!existing || new Date(details.updatedAt || row.created_at).getTime() >= new Date(existing.updatedAt || 0).getTime()) {
            map.set(folioKey, {
              id: details.id || `exp_${Date.now()}`,
              requestId: details.requestId || row.request_id,
              folio: folioKey,
              userId: details.userId || row.user_id,
              userName: details.userName || row.user_name,
              userEmail: details.userEmail || row.user_email,
              department: details.department,
              destination: details.destination,
              status: details.status || (row.action === 'COMPROBACION_FINALIZADA' ? 'ENVIADA' : 'BORRADOR'),
              items: details.items || [],
              totalAmountPaid: Number(details.totalAmountPaid || 0),
              totalExpenses: Number(details.totalExpenses || 0),
              difference: Number(details.difference || 0),
              balanceType: details.balanceType || 'EXACTO',
              balanceAmount: Number(details.balanceAmount || 0),
              notes: details.notes || '',
              refund: details.refund || undefined,
              submittedAt: details.submittedAt,
              updatedAt: details.updatedAt || row.created_at,
              createdAt: details.createdAt || row.created_at,
            });
          }
        }
      }
      persistToDisk(map);
    }
  } catch (e) {
    console.warn('[EXPENSE-STORAGE] Warning querying Supabase audit_logs for sync:', e);
  }
}

async function getCache(): Promise<Map<string, ExpenseVerification>> {
  if (!verificationsCache) {
    verificationsCache = loadFromDisk();
    await syncWithSupabaseAuditLogs(verificationsCache);
  }
  return verificationsCache;
}

export async function getVerificationByFolio(folio: string): Promise<ExpenseVerification | null> {
  const cleanFolio = String(folio || '').toUpperCase().trim();
  if (!cleanFolio) return null;
  const cache = await getCache();
  let v = cache.get(cleanFolio);
  if (!v) {
    // Try re-syncing from audit_logs
    await syncWithSupabaseAuditLogs(cache);
    v = cache.get(cleanFolio);
  }
  return v ? JSON.parse(JSON.stringify(v)) : null;
}

export async function getVerificationByRequestId(requestId: string): Promise<ExpenseVerification | null> {
  if (!requestId) return null;
  const cache = await getCache();
  for (const item of cache.values()) {
    if (item.requestId === requestId) {
      return JSON.parse(JSON.stringify(item));
    }
  }
  await syncWithSupabaseAuditLogs(cache);
  for (const item of cache.values()) {
    if (item.requestId === requestId) {
      return JSON.parse(JSON.stringify(item));
    }
  }
  return null;
}

export async function saveVerification(v: ExpenseVerification): Promise<ExpenseVerification> {
  const cleanFolio = String(v.folio || '').toUpperCase().trim();
  const cache = await getCache();
  const cloned = JSON.parse(JSON.stringify(v)) as ExpenseVerification;
  cloned.folio = cleanFolio;
  cloned.updatedAt = new Date().toISOString();
  cache.set(cleanFolio, cloned);
  persistToDisk(cache);
  return cloned;
}

export async function listAllVerifications(): Promise<ExpenseVerification[]> {
  const cache = await getCache();
  return Array.from(cache.values()).map(v => JSON.parse(JSON.stringify(v)));
}

export async function findFileById(fileId: string): Promise<{ file: ExpenseFileAttachment; folio: string; concept: string } | null> {
  const cache = await getCache();
  for (const v of cache.values()) {
    for (const item of v.items) {
      if (item.xmlFile && item.xmlFile.id === fileId) {
        return { file: item.xmlFile, folio: v.folio, concept: item.concept };
      }
      if (item.pdfFile && item.pdfFile.id === fileId) {
        return { file: item.pdfFile, folio: v.folio, concept: item.concept };
      }
      if (item.ticketFile && item.ticketFile.id === fileId) {
        return { file: item.ticketFile, folio: v.folio, concept: item.concept };
      }
    }
    if (v.refund?.receiptFile && v.refund.receiptFile.id === fileId) {
      return { file: v.refund.receiptFile, folio: v.folio, concept: 'Comprobante de Reembolso a Finanzas' };
    }
  }
  return null;
}
