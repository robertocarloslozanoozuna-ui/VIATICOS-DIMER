import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { deflateRawSync, inflateRawSync } from 'zlib';
import { getRequest, updateRequest, recordAuditLog, getUserById, hasPermission } from './db.js';
import { getVerificationByFolio, saveVerification, listAllVerifications, findFileById } from './expenseStorage.js';
import { sendEmail, buildExpenseVerificationSubmittedEmailHtml } from './mailService.js';
import { resolveBaseUrl } from './baseUrl.js';
import type { User, ExpenseItem, ExpenseVerification } from '../src/types.js';
import { computeExpenseBalances } from '../src/utils/expenseCalculations.js';
import { parseDimerExpenseExcel } from './excelImport.js';


const OFFICIAL_TEMPLATE_SOURCE_FOLIO = 'VIAT-2026-000002';
const OFFICIAL_TEMPLATE_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function readUInt16(buf: Buffer, offset: number) { return buf.readUInt16LE(offset); }
function readUInt32(buf: Buffer, offset: number) { return buf.readUInt32LE(offset); }
function writeUInt32(buf: Buffer, offset: number, value: number) { buf.writeUInt32LE(value >>> 0, offset); }

function crc32Buffer(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zeroWorksheetAmounts(xml: Buffer) {
  const text = xml.toString('utf8');
  return Buffer.from(text.replace(/<c\b([^>]*)\br="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g, (full, before, col, rowText, after, inner) => {
    const row = Number(rowText);
    const normalizedCol = String(col).toUpperCase();
    // Hoja principal: C:I son importes y J es la columna de totales/control.
    if (row < 11 || row > 43 || !/^[C-J]$/.test(normalizedCol)) return full;
    if (!/<v\b[^>]*>[\s\S]*?<\/v>/.test(inner)) return full;
    const patchedInner = String(inner).replace(/(<v\b[^>]*>)[\s\S]*?(<\/v>)/, '$10$2');
    return '<c ' + before + 'r="' + col + rowText + '"' + after + '>' + patchedInner + '</c>';
  }), 'utf8');
}

function zeroOfficialTemplateAmounts(input: Buffer) {
  type ZipEntry = {
    name: string;
    localHeader: Buffer;
    data: Buffer;
    compressed: Buffer;
  };

  const entries: ZipEntry[] = [];
  let cursor = 0;

  // Leer las entradas locales del ZIP y modificar solamente sheet1.xml.
  while (cursor + 30 <= input.length && readUInt32(input, cursor) === 0x04034b50) {
    const flags = readUInt16(input, cursor + 6);
    const method = readUInt16(input, cursor + 8);
    const compressedSize = readUInt32(input, cursor + 18);
    const uncompressedSize = readUInt32(input, cursor + 22);
    const nameLength = readUInt16(input, cursor + 26);
    const extraLength = readUInt16(input, cursor + 28);
    if (flags & 0x0008) throw new Error('El XLSX original usa un descriptor ZIP no soportado.');
    const dataStart = cursor + 30 + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > input.length) throw new Error('El XLSX original tiene una estructura ZIP incompleta.');

    const name = input.subarray(cursor + 30, cursor + 30 + nameLength).toString('utf8');
    const localHeader = Buffer.from(input.subarray(cursor, dataStart));
    const originalCompressed = input.subarray(dataStart, dataEnd);
    let data = method === 8 ? inflateRawSync(originalCompressed) : Buffer.from(originalCompressed);
    if (data.length !== uncompressedSize) throw new Error('No se pudo validar una entrada interna del XLSX original.');

    if (name === 'xl/worksheets/sheet1.xml') data = zeroWorksheetAmounts(data);

    const compressed = method === 8 ? deflateRawSync(data) : data;
    entries.push({ name, localHeader, data, compressed });
    cursor = dataEnd;
  }

  if (!entries.length || cursor + 46 > input.length || readUInt32(input, cursor) !== 0x02014b50) {
    throw new Error('No se encontró el directorio central del XLSX original.');
  }

  // Leer el directorio central original para conservar todos sus metadatos.
  const centralEntries: Array<{ name: string; header: Buffer; originalLocalOffset: number }> = [];
  let centralCursor = cursor;
  while (centralCursor + 46 <= input.length && readUInt32(input, centralCursor) === 0x02014b50) {
    const nameLength = readUInt16(input, centralCursor + 28);
    const extraLength = readUInt16(input, centralCursor + 30);
    const commentLength = readUInt16(input, centralCursor + 32);
    const entryEnd = centralCursor + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > input.length) throw new Error('El directorio central del XLSX original está incompleto.');
    const name = input.subarray(centralCursor + 46, centralCursor + 46 + nameLength).toString('utf8');
    const header = Buffer.from(input.subarray(centralCursor, entryEnd));
    centralEntries.push({ name, header, originalLocalOffset: readUInt32(header, 42) });
    centralCursor = entryEnd;
  }

  if (centralEntries.length !== entries.length) throw new Error('La estructura interna del XLSX original no pudo ser reconstruida.');

  const entryByName = new Map(entries.map((entry) => [entry.name, entry]));
  const locals: Buffer[] = [];
  const rebuiltCentral: Buffer[] = [];
  const newOffsets = new Map<string, number>();
  let localOffset = 0;

  for (const entry of entries) {
    const header = Buffer.from(entry.localHeader);
    writeUInt32(header, 14, crc32Buffer(entry.data));
    writeUInt32(header, 18, entry.compressed.length);
    writeUInt32(header, 22, entry.data.length);
    const record = Buffer.concat([header, entry.compressed]);
    locals.push(record);
    newOffsets.set(entry.name, localOffset);
    localOffset += record.length;
  }

  for (const central of centralEntries) {
    const entry = entryByName.get(central.name);
    if (!entry) throw new Error('Falta una entrada ZIP al reconstruir la plantilla oficial.');
    const header = Buffer.from(central.header);
    writeUInt32(header, 16, crc32Buffer(entry.data));
    writeUInt32(header, 20, entry.compressed.length);
    writeUInt32(header, 24, entry.data.length);
    writeUInt32(header, 42, newOffsets.get(central.name) || 0);
    rebuiltCentral.push(header);
  }

  const localDirectory = Buffer.concat(locals);
  const centralDirectory = Buffer.concat(rebuiltCentral);
  const end = Buffer.alloc(22);
  writeUInt32(end, 0, 0x06054b50);
  end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  writeUInt32(end, 12, centralDirectory.length);
  writeUInt32(end, 16, localDirectory.length);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localDirectory, centralDirectory, end]);
}

async function getOfficialTemplateFromFolio() {
  const verification = await getVerificationByFolio(OFFICIAL_TEMPLATE_SOURCE_FOLIO);
  const dataUrl = String(verification?.originalExcelFile?.dataUrl || '');
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error('No se encontró el Excel original del folio VIAT-2026-000002.');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length) throw new Error('El Excel original del folio VIAT-2026-000002 está vacío.');
  return buffer;
}

function parseCookies(req: Request) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}

function verifyJwt(token: string): { sub: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT inválido');
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) throw new Error('JWT inválido');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub: string; exp?: number };
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Sesión expirada');
  return payload;
}

async function getRequestUser(req: Request): Promise<User | null> {
  if ((req as any).dimerUser) return (req as any).dimerUser as User;
  const cookies = parseCookies(req);
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const token = bearer || String(cookies.dimer_session || '');
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    const stored = await getUserById(payload.sub);
    if (!stored || stored.status !== 'ACTIVO') return null;
    // getUserById() already resolves the effective multi-role permissions.
    // Re-sanitizing against one role can lose the user's effective RBAC context.
    (req as any).dimerUser = stored;
    return stored;
  } catch {
    return null;
  }
}

function userIsAdminOrFinanzas(user: User | null): boolean {
  if (!user) return false;
  const roleName = String(user.role || '').toUpperCase();
  if (roleName === 'ADMIN' || roleName === 'ADMINISTRADOR' || roleName === 'FINANZAS') return true;
  if (user.roles?.some(r => ['ADMIN', 'ADMINISTRADOR', 'FINANZAS', 'ROLE_ADMIN', 'ROLE_FINANZAS'].includes(String(r.name || r.id).toUpperCase()))) return true;
  if (user.roleId === 'role_admin' || user.roleId === 'role_finanzas') return true;
  // Existing Finance/Treasury permission: "Ver reportes y Finanzas".
  if (hasPermission(user, 'ver_reportes')) return true;
  if (user.email?.toLowerCase() === 'sistemas@dimer.com.mx') return true;
  return false;
}

function isOwner(request: any, user: User) {
  return request.userId === user.id ||
    (request.requesterName && user.name && request.requesterName.toLowerCase() === user.name.toLowerCase()) ||
    (request.user?.email && request.user.email.toLowerCase() === user.email.toLowerCase());
}

function effectiveFinanzasEmail(): string {
  return String(process.env.FINANZAS_URL || process.env.FINANZAS_EMAIL || '').trim().toLowerCase();
}

function calculateTotals(request: any, items: ExpenseItem[], refund?: any) {
  const totalAmountPaid = Number(
    request.amountAuthorized && Number(request.amountAuthorized) > 0
      ? request.amountAuthorized
      : (request.amountRequested || 0)
  );

  const balances = computeExpenseBalances(totalAmountPaid, items, refund);

  return {
    totalAmountPaid: balances.totalAmountPaid,
    totalExpenses: balances.totalExpenses,
    difference: balances.difference,
    balanceType: balances.balanceType,
    balanceAmount: balances.balanceAmount,
  };
}

function validateItems(items: ExpenseItem[]): string | null {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.concept?.trim()) return `El comprobante #${i + 1} requiere un concepto o descripción.`;
    if (typeof it.amount !== 'number' || !Number.isFinite(it.amount) || it.amount <= 0) return `El monto del comprobante "${it.concept}" debe ser mayor a 0.`;
    if (!it.expenseDate) return `El comprobante "${it.concept}" requiere fecha del gasto.`;
    if (it.type === 'FACTURA' && (!it.xmlFile || !it.pdfFile)) return `La factura "${it.concept}" está incompleta: requiere XML (CFDI) y PDF.`;
    if (it.type === 'TICKET' && !it.ticketFile) return `El ticket "${it.concept}" requiere adjuntar el comprobante (PDF o imagen).`;
  }
  return null;
}

function validateRefund(difference: number, refund: any): string | null {
  if (difference <= 0) return null;
  if (!refund || typeof refund !== 'object') return 'Existe un saldo a favor de la empresa. Debes registrar el reembolso antes de finalizar la comprobación.';
  const amount = Number(refund.amount ?? refund.monto ?? difference);
  if (!Number.isFinite(amount) || Math.abs(amount - difference) > 0.01) return `El importe del reembolso debe ser exactamente $${difference.toFixed(2)}.`;
  if (!refund.method && !refund.type && !refund.formaPago) return 'Debes indicar el método de reembolso (SPEI o efectivo).';
  return null;
}

export function registerExpenseRoutes(app: Express) {
  app.post('/api/expenses/upload-file', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const folio = String(req.body?.folio || '').trim().toUpperCase();
      const name = String(req.body?.name || '').trim();
      const dataUrl = String(req.body?.dataUrl || '');
      const declaredSize = Number(req.body?.size) || 0;
      const declaredType = String(req.body?.type || '').trim().toLowerCase();

      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });
      if (!name) return res.status(400).json({ success: false, error: 'Nombre de archivo requerido' });
      if (!dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')) {
        return res.status(400).json({ success: false, error: 'Contenido de archivo inválido.' });
      }

      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      const privileged = userIsAdminOrFinanzas(user);
      if (!privileged && !isOwner(request, user)) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para adjuntar archivos en este folio' });
      }
      if (request.status !== 'PAGADA' && request.status !== 'COMPROBADA') {
        return res.status(400).json({ success: false, error: `Solo se pueden adjuntar documentos en solicitudes pagadas. Estado actual: ${request.status}` });
      }

      const ext = name.toLowerCase().split('.').pop() || '';
      const allowed = new Set(['pdf', 'xml', 'jpg', 'jpeg', 'png', 'webp']);
      if (!allowed.has(ext)) {
        return res.status(400).json({ success: false, error: 'Formato no admitido. Formatos válidos: PDF, XML (CFDI), JPG, JPEG, PNG y WEBP.' });
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const payload = dataUrl.split(';base64,')[1] || '';
      const estimatedBytes = Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
      const effectiveSize = declaredSize > 0 ? declaredSize : estimatedBytes;
      if (effectiveSize <= 0 || effectiveSize > MAX_FILE_SIZE) {
        return res.status(400).json({ success: false, error: `El archivo debe tener entre 1 byte y 10 MB. Tamaño detectado: ${(Math.max(effectiveSize, 0) / (1024 * 1024)).toFixed(1)} MB.` });
      }

      const mimeByExt: Record<string, string> = {
        pdf: 'application/pdf',
        xml: 'application/xml',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      const type = declaredType || mimeByExt[ext];
      const attachment: any = {
        id: `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        name,
        size: effectiveSize,
        type,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      };

      return res.json({ success: true, file: attachment });
    } catch (e: any) {
      console.error('[EXPENSE-UPLOAD-FILE-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al validar el archivo.' });
    }
  });
  app.post('/api/expenses/import-excel', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const folio = String(req.body.folio || '').trim().toUpperCase();
      const file = req.body.file || {};
      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });
      if (!file.name || !String(file.name).toLowerCase().endsWith('.xlsx')) return res.status(400).json({ success: false, error: 'Solo se permite el formato oficial Excel (.xlsx).' });
      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      const privileged = userIsAdminOrFinanzas(user);
      if (!privileged && !isOwner(request, user)) return res.status(403).json({ success: false, error: 'No tienes permiso para importar el Excel en este folio' });
      if (request.status !== 'PAGADA' && request.status !== 'COMPROBADA') return res.status(400).json({ success: false, error: `Solo se puede importar el reporte en solicitudes pagadas. Estado actual: ${request.status}` });
      const parsed = parseDimerExpenseExcel({ fileName: String(file.name), fileSize: Number(file.size) || 0, fileType: String(file.type || ''), dataUrl: String(file.dataUrl || ''), uploadedBy: user.email });
      const existing = await getVerificationByFolio(folio);
      const existingOriginal = existing?.originalExcelFile;
      const isDuplicate = Boolean(existingOriginal && existingOriginal.name === parsed.originalExcelFile.name && existingOriginal.size === parsed.originalExcelFile.size);
      return res.json({ success: true, folio, ...parsed, isDuplicate });
    } catch (e: any) {
      console.error('[EXPENSE-EXCEL-IMPORT-ERROR]', e);
      return res.status(400).json({ success: false, error: e.message || 'Error al procesar el archivo Excel.' });
    }
  });

  app.get('/api/expenses/download-template', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      // Fuente oficial: el Excel original realmente cargado en VIAT-2026-000002.
      // Se modifica únicamente el valor de los montos existentes a 0 y se conserva
      // el resto del XLSX (hojas, estilos, fórmulas, encabezados y estructura).
      const original = await getOfficialTemplateFromFolio();
      const buffer = zeroOfficialTemplateAmounts(original);
      if (!buffer.length) return res.status(503).json({ success: false, error: 'No fue posible generar la plantilla oficial Excel.' });

      res.setHeader('Content-Type', OFFICIAL_TEMPLATE_MIME);
      res.setHeader('Content-Disposition', 'attachment; filename="Reporte de Gastos DIMER.xlsx"');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (e: any) {
      console.error('[EXPENSE-EXCEL-TEMPLATE-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al descargar la plantilla.' });
    }
  });
  app.get('/api/expenses/search', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const folio = String(req.query.folio || '').trim().toUpperCase();
      if (!folio) return res.status(400).json({ success: false, error: 'Debes ingresar un folio para buscar.' });
      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: `No se encontró ninguna solicitud con el folio "${folio}".` });

      const privileged = userIsAdminOrFinanzas(user);
      const owner = isOwner(request, user);
      if (!privileged && !owner) return res.status(403).json({ success: false, error: `Acceso restringido: La solicitud ${folio} pertenece a otro solicitante.` });

      let canEdit = false;
      let statusNotice: string | null = null;
      if (request.status === 'PAGADA') canEdit = true;
      else if (request.status === 'COMPROBADA') {
        canEdit = privileged;
        statusNotice = privileged
          ? 'La comprobación está finalizada. Finanzas/Administrador puede corregirla y volver a enviarla.'
          : 'Esta solicitud ya cuenta con comprobación de gastos finalizada y enviada a Finanzas. No puede modificarse.';
      }
      else if (request.status === 'PENDIENTE_APROBACION' || request.status === 'BORRADOR') statusNotice = `La solicitud se encuentra en estado "${request.status}". Aún no ha sido autorizada ni pagada.`;
      else if (request.status === 'APROBADA') statusNotice = 'La solicitud fue autorizada, pero Finanzas aún no registra el pago.';
      else if (request.status === 'RECHAZADA') statusNotice = 'La solicitud fue rechazada y no cuenta con viáticos para comprobar.';
      else if (request.status === 'CANCELADA') statusNotice = 'La solicitud está cancelada.';
      else statusNotice = `La solicitud se encuentra en estado "${request.status}". Solo se pueden comprobar solicitudes pagadas.`;

      const verification = await getVerificationByFolio(request.folio);
      return res.json({ success: true, request, verification, canEdit, statusNotice, userRole: user.role, isOwner: owner, isPrivileged: privileged });
    } catch (e: any) {
      console.error('[EXPENSE-SEARCH-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al buscar solicitud' });
    }
  });

  app.delete('/api/expenses/excel/:folio', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const folio = String(req.params.folio || '').trim().toUpperCase();
      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });
      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      const privileged = userIsAdminOrFinanzas(user);
      if (!privileged && !isOwner(request, user)) return res.status(403).json({ success: false, error: 'No tienes permiso para modificar este expediente' });
      if (request.status !== 'PAGADA' && !(request.status === 'COMPROBADA' && privileged)) return res.status(409).json({ success: false, error: 'El expediente no permite eliminar el reporte Excel en su estado actual.' });
      const existing = await getVerificationByFolio(folio);
      if (!existing?.originalExcelFile) return res.status(404).json({ success: false, error: 'No existe un reporte Excel original en este expediente.' });
      const now = new Date().toISOString();
      const saved = await saveVerification({ ...existing, originalExcelFile: undefined, excelAuditSummary: undefined, updatedAt: now });
      await recordAuditLog({ requestId: request.id, userId: user.id, action: 'COMPROBACION_EXCEL_ORIGINAL_ELIMINADO', details: { folio, filename: existing.originalExcelFile.name, deletedAt: now } });
      return res.json({ success: true, verification: saved, message: 'Reporte Excel original eliminado. Las partidas importadas se conservaron.' });
    } catch (e: any) {
      console.error('[EXPENSE-EXCEL-DELETE-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al eliminar el reporte Excel.' });
    }
  });

  app.post('/api/expenses/draft', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const folio = String(req.body.folio || '').trim().toUpperCase();
      const items: ExpenseItem[] = Array.isArray(req.body.items) ? req.body.items : [];
      const notes = String(req.body.notes || '').trim();
      const refund = req.body.refund || undefined;
      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });
      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      const privileged = userIsAdminOrFinanzas(user);
      if (!privileged && !isOwner(request, user)) return res.status(403).json({ success: false, error: 'No tienes permiso para guardar comprobantes en este folio' });
      if (request.status === 'COMPROBADA' && !privileged) {
        return res.status(409).json({ success: false, error: 'La comprobación ya fue finalizada y está cerrada. Solo Finanzas o Administrador puede corregirla.' });
      }
      if (request.status !== 'PAGADA' && request.status !== 'COMPROBADA') {
        return res.status(400).json({ success: false, error: `Solo se pueden registrar comprobantes en solicitudes pagadas. Estado actual: ${request.status}` });
      }

      const totals = calculateTotals(request, items, refund);
      const existing = await getVerificationByFolio(folio);
      const now = new Date().toISOString();
      const verification: ExpenseVerification = {
        id: existing?.id || `exp_${Date.now()}`,
        requestId: request.id, folio: request.folio,
        userId: existing?.userId || request.userId || user.id,
        userName: existing?.userName || request.requesterName || user.name,
        userEmail: existing?.userEmail || request.user?.email || user.email,
        department: request.department || user.department, destination: request.destination,
        status: 'BORRADOR', items, ...totals, notes,
        supportFiles: Array.isArray(req.body.supportFiles) ? req.body.supportFiles : (existing?.supportFiles || []),
        pendingFiscalXmls: Array.isArray(req.body.pendingFiscalXmls) ? req.body.pendingFiscalXmls : (existing?.pendingFiscalXmls || []),
        originalExcelFile: Object.prototype.hasOwnProperty.call(req.body, 'originalExcelFile') ? (req.body.originalExcelFile || undefined) : existing?.originalExcelFile,
        excelAuditSummary: Object.prototype.hasOwnProperty.call(req.body, 'excelAuditSummary') ? (req.body.excelAuditSummary || undefined) : existing?.excelAuditSummary,
        refund: refund !== undefined ? refund : existing?.refund,
        submittedAt: existing?.submittedAt, updatedAt: now, createdAt: existing?.createdAt || now,
      };
      const saved = await saveVerification(verification);
      if (request.status === 'COMPROBADA' && privileged) {
        await updateRequest(request.id, {
          status: 'PAGADA',
          updatedAt: now,
          comments: `${request.comments || ''} | Corrección de comprobación reabierta por ${user.name}`.trim(),
        });
      }
      await recordAuditLog({
        requestId: request.id,
        userId: user.id,
        action: request.status === 'COMPROBADA' ? 'CORRECCION_COMPROBACION_BORRADOR' : 'COMPROBACION_GASTOS_BORRADOR',
        details: { verification: saved, previousStatus: request.status },
      });
      return res.json({ success: true, verification: saved });
    } catch (e: any) {
      console.error('[EXPENSE-DRAFT-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al guardar borrador' });
    }
  });

  app.post('/api/expenses/submit', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const folio = String(req.body.folio || '').trim().toUpperCase();
      const items: ExpenseItem[] = Array.isArray(req.body.items) ? req.body.items : [];
      const notes = String(req.body.notes || '').trim();
      const refund = req.body.refund || undefined;
      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });
      if (!items.length) return res.status(400).json({ success: false, error: 'Debes agregar al menos un comprobante de gasto para finalizar.' });
      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      const privileged = userIsAdminOrFinanzas(user);
      if (!privileged && !isOwner(request, user)) return res.status(403).json({ success: false, error: 'No tienes permiso para finalizar esta comprobación' });
      if (request.status === 'COMPROBADA' && !privileged) {
        return res.status(409).json({ success: false, error: 'La comprobación ya fue finalizada. Solo Finanzas o Administrador puede corregirla.' });
      }
      if (request.status !== 'PAGADA' && request.status !== 'COMPROBADA') {
        return res.status(400).json({ success: false, error: `Solo se puede finalizar sobre solicitudes pagadas. Estado actual: ${request.status}` });
      }

      const itemError = validateItems(items);
      if (itemError) return res.status(400).json({ success: false, error: itemError });
      const totalsBeforeRefund = calculateTotals(request, items);
      const refundError = validateRefund(totalsBeforeRefund.difference, refund);
      if (refundError) return res.status(400).json({ success: false, error: refundError });
      const totals = calculateTotals(request, items, refund);
      const existing = await getVerificationByFolio(folio);
      const now = new Date().toISOString();
      const verification: ExpenseVerification = {
        id: existing?.id || `exp_${Date.now()}`,
        requestId: request.id, folio: request.folio,
        userId: existing?.userId || request.userId || user.id,
        userName: existing?.userName || request.requesterName || user.name,
        userEmail: existing?.userEmail || request.user?.email || user.email,
        department: request.department || user.department, destination: request.destination,
        status: 'ENVIADA', items, ...totals, notes,
        supportFiles: Array.isArray(req.body.supportFiles) ? req.body.supportFiles : (existing?.supportFiles || []),
        pendingFiscalXmls: Array.isArray(req.body.pendingFiscalXmls) ? req.body.pendingFiscalXmls : (existing?.pendingFiscalXmls || []),
        originalExcelFile: req.body.originalExcelFile || existing?.originalExcelFile,
        excelAuditSummary: req.body.excelAuditSummary || existing?.excelAuditSummary,
        refund: refund !== undefined ? refund : existing?.refund,
        submittedAt: now, updatedAt: now, createdAt: existing?.createdAt || now,
      };

      const saved = await saveVerification(verification);
      const updatedRequest = await updateRequest(request.id, { status: 'COMPROBADA', updatedAt: now });
      await recordAuditLog({ requestId: request.id, userId: user.id, action: 'COMPROBACION_GASTOS_FINALIZADA', details: { verification: saved, folio: request.folio, submittedAt: now } });

      const finanzasEmail = effectiveFinanzasEmail();
      if (finanzasEmail && finanzasEmail !== user.email.toLowerCase()) {
        const emailHtml = buildExpenseVerificationSubmittedEmailHtml({ request: updatedRequest, user, verification: saved, appUrl: resolveBaseUrl(req) });
        const subject = `[COMPROBACIÓN DE GASTOS RECIBIDA] Folio ${request.folio} - ${request.requesterName || user.name}`;
        try {
          console.log(`[EXPENSES-MAIL] Enviando notificación de comprobación a Finanzas: ${finanzasEmail}`);
          await sendEmail({ to: finanzasEmail, subject, html: emailHtml, requestId: request.id, folio: request.folio });
        } catch (mailErr) {
          console.error('[EXPENSES-MAIL-ERROR] Error al enviar notificación a Finanzas:', mailErr);
        }
      } else if (!finanzasEmail) {
        console.warn('[EXPENSES-MAIL-WARN] No hay FINANZAS_URL ni FINANZAS_EMAIL configurado. No se envía correo a Finanzas.');
      }

      return res.json({ success: true, request: updatedRequest, verification: saved, message: 'Comprobación finalizada y enviada a Finanzas con éxito.' });
    } catch (e: any) {
      console.error('[EXPENSE-SUBMIT-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al finalizar comprobación' });
    }
  });

  app.get('/api/expenses/list', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const all = await listAllVerifications();
      if (userIsAdminOrFinanzas(user)) return res.json({ success: true, verifications: all });
      return res.json({ success: true, verifications: all.filter(v => v.userId === user.id || v.userEmail?.toLowerCase() === user.email.toLowerCase()) });
    } catch (e: any) {
      console.error('[EXPENSE-LIST-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al listar comprobaciones' });
    }
  });

  app.get('/api/expenses/file/:fileId', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      const fileId = String(req.params.fileId || '').trim();
      if (!fileId) return res.status(400).json({ success: false, error: 'ID de archivo requerido' });
      const found = await findFileById(fileId);
      if (!found) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

      const request = await getRequest(found.folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud relacionada no encontrada' });
      if (!userIsAdminOrFinanzas(user) && !isOwner(request, user)) return res.status(403).json({ success: false, error: 'No tienes permiso para consultar este archivo' });

      const matches = found.file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(500).json({ success: false, error: 'Formato de archivo inválido' });
      const buffer = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', matches[1]);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(found.file.name)}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (e: any) {
      console.error('[EXPENSE-FILE-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al servir archivo' });
    }
  });
}
