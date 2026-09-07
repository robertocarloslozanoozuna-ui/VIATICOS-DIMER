import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { getRequest, updateRequest, recordAuditLog, getUserById, listRoles, sanitizeUser } from './db.js';
import { getVerificationByFolio, saveVerification, listAllVerifications, findFileById } from './expenseStorage.js';
import { sendEmail, buildExpenseVerificationSubmittedEmailHtml } from './mailService.js';
import { resolveBaseUrl } from './baseUrl.js';
import type { User, TravelRequest, ExpenseItem, ExpenseVerification } from '../src/types.js';

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
  if (user.roles?.some(r => ['ADMIN', 'ADMINISTRADOR', 'FINANZAS', 'role_admin', 'role_finanzas'].includes(String(r.name || r.id).toUpperCase()))) {
    return true;
  }
  if (user.roleId === 'role_admin' || user.roleId === 'role_finanzas') return true;
  if (user.email && user.email.toLowerCase() === 'sistemas@dimer.com.mx') return true;
  return false;
}

export function registerExpenseRoutes(app: Express) {
  // 1. Search request by Folio for expense verification
  app.get('/api/expenses/search', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const folio = String(req.query.folio || '').trim().toUpperCase();
      if (!folio) {
        return res.status(400).json({ success: false, error: 'Debes ingresar un folio para buscar.' });
      }

      const request = await getRequest(folio);
      if (!request) {
        return res.status(404).json({
          success: false,
          error: `No se encontró ninguna solicitud con el folio "${folio}". Verifica el número de folio.`
        });
      }

      const isPrivileged = userIsAdminOrFinanzas(user);
      const isOwner = request.userId === user.id ||
        (request.requesterName && request.requesterName.toLowerCase() === user.name.toLowerCase()) ||
        (request.user?.email && request.user.email.toLowerCase() === user.email.toLowerCase());

      if (!isPrivileged && !isOwner) {
        return res.status(403).json({
          success: false,
          error: `Acceso restringido: La solicitud ${folio} pertenece a otro solicitante.`
        });
      }

      // Check current lifecycle status
      let canEdit = false;
      let statusNotice: string | null = null;

      if (request.status === 'PAGADA') {
        canEdit = true;
      } else if (request.status === 'COMPROBADA') {
        canEdit = isPrivileged; // Admins can manage, solicitante sees read-only completed
        statusNotice = 'Esta solicitud ya cuenta con comprobación de gastos FINALIZADA y enviada a Finanzas.';
      } else if (request.status === 'PENDIENTE_APROBACION' || request.status === 'BORRADOR') {
        statusNotice = `La solicitud se encuentra en estado "${request.status === 'PENDIENTE_APROBACION' ? 'Pendiente de Aprobación' : 'Borrador'}". Aún no ha sido autorizada por el supervisor ni pagada por Finanzas.`;
      } else if (request.status === 'APROBADA') {
        statusNotice = 'La solicitud ya fue autorizada por el supervisor, pero Finanzas aún no registra la dispersión de pago. La comprobación solo se activa cuando la solicitud pasa a estado "Pagada".';
      } else if (request.status === 'RECHAZADA') {
        statusNotice = 'La solicitud fue rechazada por el supervisor. No cuenta con viáticos dispersados para comprobar.';
      } else if (request.status === 'CANCELADA') {
        statusNotice = 'La solicitud está cancelada.';
      } else {
        statusNotice = `La solicitud se encuentra en estado "${request.status}". Solo se pueden comprobar solicitudes en estado "Pagada".`;
      }

      // Load existing verification draft or finalized record
      const verification = await getVerificationByFolio(request.folio);

      return res.json({
        success: true,
        request,
        verification,
        canEdit,
        statusNotice,
        userRole: user.role,
        isOwner,
        isPrivileged,
      });
    } catch (e: any) {
      console.error('[EXPENSE-SEARCH-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al buscar solicitud' });
    }
  });

  // 2. Save draft verification (allows saving partial progress)
  app.post('/api/expenses/draft', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const folio = String(req.body.folio || '').trim().toUpperCase();
      const items: ExpenseItem[] = Array.isArray(req.body.items) ? req.body.items : [];
      const notes = String(req.body.notes || '').trim();
      const refund = req.body.refund ? req.body.refund : undefined;

      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });

      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

      const isPrivileged = userIsAdminOrFinanzas(user);
      const isOwner = request.userId === user.id || (request.user?.email && request.user.email.toLowerCase() === user.email.toLowerCase());

      if (!isPrivileged && !isOwner) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para guardar comprobantes en este folio' });
      }

      if (request.status !== 'PAGADA' && request.status !== 'COMPROBADA' && !isPrivileged) {
        return res.status(400).json({
          success: false,
          error: `Solo se pueden registrar comprobantes en solicitudes pagadas. Estado actual: ${request.status}`
        });
      }

      const totalAmountPaid = Number(
        (request.amountAuthorized && Number(request.amountAuthorized) > 0)
          ? request.amountAuthorized
          : (request.amountRequested || 0)
      );
      const totalExpenses = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
      const difference = Number((totalAmountPaid - totalExpenses).toFixed(2));
      const balanceType = difference > 0 ? 'FAVOR_EMPRESA' : difference < 0 ? 'FAVOR_COLABORADOR' : 'EXACTO';
      const balanceAmount = Math.abs(difference);

      const existing = await getVerificationByFolio(folio);
      const verification: ExpenseVerification = {
        id: existing?.id || `exp_${Date.now()}`,
        requestId: request.id,
        folio: request.folio,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        department: request.department || user.department,
        destination: request.destination,
        status: existing?.status === 'ENVIADA' ? 'ENVIADA' : 'BORRADOR',
        items,
        totalAmountPaid,
        totalExpenses: Number(totalExpenses.toFixed(2)),
        difference,
        balanceType,
        balanceAmount,
        notes,
        refund: refund !== undefined ? refund : existing?.refund,
        submittedAt: existing?.submittedAt,
        updatedAt: new Date().toISOString(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      const saved = await saveVerification(verification);

      await recordAuditLog({
        requestId: request.id,
        userId: user.id,
        action: 'COMPROBACION_GASTOS_BORRADOR',
        details: {
          folio: request.folio,
          itemsCount: items.length,
          totalExpenses,
          totalAmountPaid,
          difference,
          balanceType,
        }
      });

      return res.json({ success: true, verification: saved });
    } catch (e: any) {
      console.error('[EXPENSE-DRAFT-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al guardar borrador' });
    }
  });

  // 3. Finalize and submit verification (updates request to COMPROBADA and sends notification to Finanzas)
  app.post('/api/expenses/submit', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const folio = String(req.body.folio || '').trim().toUpperCase();
      const items: ExpenseItem[] = Array.isArray(req.body.items) ? req.body.items : [];
      const notes = String(req.body.notes || '').trim();
      const refund = req.body.refund ? req.body.refund : undefined;

      if (!folio) return res.status(400).json({ success: false, error: 'Folio requerido' });
      if (!items.length) {
        return res.status(400).json({
          success: false,
          error: 'Debes agregar al menos un comprobante de gasto (factura fiscal o ticket) para finalizar.'
        });
      }

      const request = await getRequest(folio);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

      const isPrivileged = userIsAdminOrFinanzas(user);
      const isOwner = request.userId === user.id || (request.user?.email && request.user.email.toLowerCase() === user.email.toLowerCase());

      if (!isPrivileged && !isOwner) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para finalizar esta comprobación' });
      }

      if (request.status !== 'PAGADA' && request.status !== 'COMPROBADA') {
        return res.status(400).json({
          success: false,
          error: `Solo se puede finalizar la comprobación sobre solicitudes con pago registrado. Estado actual: ${request.status}`
        });
      }

      // Validate items
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.concept || !it.concept.trim()) {
          return res.status(400).json({ success: false, error: `El comprobante #${i + 1} requiere un concepto o descripción.` });
        }
        if (typeof it.amount !== 'number' || it.amount <= 0) {
          return res.status(400).json({ success: false, error: `El monto del comprobante "${it.concept}" debe ser mayor a 0.` });
        }
        if (!it.expenseDate) {
          return res.status(400).json({ success: false, error: `El comprobante "${it.concept}" requiere fecha del gasto.` });
        }
        if (it.type === 'FACTURA') {
          if (!it.xmlFile || !it.pdfFile) {
            return res.status(400).json({
              success: false,
              error: `La factura "${it.concept}" está incompleta: Requiere tanto el archivo XML (CFDI) como el PDF correspondiente.`
            });
          }
        } else if (it.type === 'TICKET') {
          if (!it.ticketFile) {
            return res.status(400).json({
              success: false,
              error: `El ticket "${it.concept}" requiere adjuntar el archivo de comprobante (PDF o imagen).`
            });
          }
        }
      }

      const totalAmountPaid = Number(
        (request.amountAuthorized && Number(request.amountAuthorized) > 0)
          ? request.amountAuthorized
          : (request.amountRequested || 0)
      );
      const totalExpenses = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
      const difference = Number((totalAmountPaid - totalExpenses).toFixed(2));
      const balanceType = difference > 0 ? 'FAVOR_EMPRESA' : difference < 0 ? 'FAVOR_COLABORADOR' : 'EXACTO';
      const balanceAmount = Math.abs(difference);

      const existing = await getVerificationByFolio(folio);
      const now = new Date().toISOString();

      const verification: ExpenseVerification = {
        id: existing?.id || `exp_${Date.now()}`,
        requestId: request.id,
        folio: request.folio,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        department: request.department || user.department,
        destination: request.destination,
        status: 'ENVIADA',
        items,
        totalAmountPaid,
        totalExpenses: Number(totalExpenses.toFixed(2)),
        difference,
        balanceType,
        balanceAmount,
        notes,
        refund: refund !== undefined ? refund : existing?.refund,
        submittedAt: now,
        updatedAt: now,
        createdAt: existing?.createdAt || now,
      };

      // 1. Persist verification
      const saved = await saveVerification(verification);

      // 2. Update request status to COMPROBADA in Supabase
      const updatedRequest = await updateRequest(request.id, {
        status: 'COMPROBADA',
        updatedAt: now,
      });

      // 3. Record Audit Log
      await recordAuditLog({
        requestId: request.id,
        userId: user.id,
        action: 'COMPROBACION_GASTOS_FINALIZADA',
        details: {
          folio: request.folio,
          requesterName: user.name,
          requesterEmail: user.email,
          itemsCount: items.length,
          totalExpenses,
          totalAmountPaid,
          difference,
          balanceType,
          submittedAt: now,
        }
      });

      // 4. Send email notification to Finanzas via configured FINANZAS_EMAIL
      const finanzasEmail = (process.env.FINANZAS_EMAIL || 'finanzas@dimer.com.mx').trim().toLowerCase();
      const appUrl = resolveBaseUrl(req);
      const emailHtml = buildExpenseVerificationSubmittedEmailHtml({
        request: updatedRequest,
        user,
        verification: saved,
        appUrl,
      });

      const subject = `[COMPROBACIÓN DE GASTOS RECIBIDA] Folio ${request.folio} - ${request.requesterName || user.name}`;

      try {
        console.log(`[EXPENSES-MAIL] Enviando notificación de comprobación a Finanzas: ${finanzasEmail}`);
        await sendEmail({
          to: finanzasEmail,
          subject,
          html: emailHtml,
          requestId: request.id,
          folio: request.folio,
        });
      } catch (mailErr) {
        console.error('[EXPENSES-MAIL-ERROR] Error al enviar notificación a Finanzas:', mailErr);
      }

      return res.json({
        success: true,
        request: updatedRequest,
        verification: saved,
        message: 'Comprobación finalizada y enviada a Finanzas con éxito.'
      });
    } catch (e: any) {
      console.error('[EXPENSE-SUBMIT-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al finalizar comprobación' });
    }
  });

  // 4. List all verifications (for Admin and Finanzas, or requester's own)
  app.get('/api/expenses/list', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const all = await listAllVerifications();
      const isPrivileged = userIsAdminOrFinanzas(user);

      if (isPrivileged) {
        return res.json({ success: true, verifications: all });
      }

      // Non-privileged users only see their own verifications
      const own = all.filter(v => v.userId === user.id || (v.userEmail && v.userEmail.toLowerCase() === user.email.toLowerCase()));
      return res.json({ success: true, verifications: own });
    } catch (e: any) {
      console.error('[EXPENSE-LIST-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al listar comprobaciones' });
    }
  });

  // 5. Download or view attached file
  app.get('/api/expenses/file/:fileId', async (req: Request, res: Response) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const fileId = String(req.params.fileId || '').trim();
      if (!fileId) return res.status(400).json({ success: false, error: 'ID de archivo requerido' });

      const found = await findFileById(fileId);
      if (!found) {
        return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
      }

      const { file, folio } = found;
      // Extract base64 payload from dataUrl
      const matches = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(500).json({ success: false, error: 'Formato de archivo inválido' });
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (e: any) {
      console.error('[EXPENSE-FILE-ERROR]', e);
      return res.status(500).json({ success: false, error: e.message || 'Error al servir archivo' });
    }
  });
}
