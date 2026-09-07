import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { getRequest, updateRequest, recordAuditLog, getUserById, listRoles, sanitizeUser } from './db.js';
import { getVerificationByFolio, saveVerification, listAllVerifications, findFileById } from './expenseStorage.js';
import { sendEmail, buildExpenseVerificationSubmittedEmailHtml } from './mailService.js';
import { resolveBaseUrl } from './baseUrl.js';
import type { User, ExpenseItem, ExpenseVerification } from '../src/types.js';

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
    const roles = await listRoles();
    const sanitized = sanitizeUser(stored, roles.find(r => r.id === stored.roleId));
    (req as any).dimerUser = sanitized;
    return sanitized;
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

function calculateTotals(request: any, items: ExpenseItem[]) {
  const totalAmountPaid = Number(
    request.amountAuthorized && Number(request.amountAuthorized) > 0
      ? request.amountAuthorized
      : (request.amountRequested || 0)
  );
  const totalExpenses = Number(items.reduce((sum, it) => sum + Number(it.amount || 0), 0).toFixed(2));
  const difference = Number((totalAmountPaid - totalExpenses).toFixed(2));
  const balanceType = difference > 0 ? 'FAVOR_EMPRESA' : difference < 0 ? 'FAVOR_COLABORADOR' : 'EXACTO';
  return { totalAmountPaid, totalExpenses, difference, balanceType, balanceAmount: Math.abs(difference) };
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
      else if (request.status === 'COMPROBADA') statusNotice = 'Esta solicitud ya cuenta con comprobación de gastos finalizada y enviada a Finanzas. No puede modificarse.';
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
      if (request.status === 'COMPROBADA') return res.status(409).json({ success: false, error: 'La comprobación ya fue finalizada y está cerrada. No se permiten modificaciones.' });
      if (request.status !== 'PAGADA') return res.status(400).json({ success: false, error: `Solo se pueden registrar comprobantes en solicitudes pagadas. Estado actual: ${request.status}` });

      const totals = calculateTotals(request, items);
      const existing = await getVerificationByFolio(folio);
      const now = new Date().toISOString();
      const verification: ExpenseVerification = {
        id: existing?.id || `exp_${Date.now()}`,
        requestId: request.id, folio: request.folio, userId: user.id, userName: user.name, userEmail: user.email,
        department: request.department || user.department, destination: request.destination,
        status: 'BORRADOR', items, ...totals, notes,
        refund: refund !== undefined ? refund : existing?.refund,
        submittedAt: existing?.submittedAt, updatedAt: now, createdAt: existing?.createdAt || now,
      };
      const saved = await saveVerification(verification);
      await recordAuditLog({ requestId: request.id, userId: user.id, action: 'COMPROBACION_GASTOS_BORRADOR', details: { verification: saved } });
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
      if (request.status === 'COMPROBADA') return res.status(409).json({ success: false, error: 'La comprobación ya fue finalizada y está cerrada. Para corregirla debe existir un proceso de corrección autorizado.' });
      if (request.status !== 'PAGADA') return res.status(400).json({ success: false, error: `Solo se puede finalizar sobre solicitudes pagadas. Estado actual: ${request.status}` });

      const itemError = validateItems(items);
      if (itemError) return res.status(400).json({ success: false, error: itemError });
      const totals = calculateTotals(request, items);
      const refundError = validateRefund(totals.difference, refund);
      if (refundError) return res.status(400).json({ success: false, error: refundError });

      const existing = await getVerificationByFolio(folio);
      const now = new Date().toISOString();
      const verification: ExpenseVerification = {
        id: existing?.id || `exp_${Date.now()}`,
        requestId: request.id, folio: request.folio, userId: user.id, userName: user.name, userEmail: user.email,
        department: request.department || user.department, destination: request.destination,
        status: 'ENVIADA', items, ...totals, notes,
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
