import type { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { getUserById, getRequest, deleteRequest, updateRequest, recordAuditLog, listRoles, sanitizeUser, createApprovalToken } from './db.js';
import { buildBossApprovalEmailHtml, buildRequesterConfirmationEmailHtml, sendEmail } from './mailService.js';
import type { User } from '../src/types.js';
import { userHasRole } from '../src/types.js';

function parseCookies(req: Request) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(
    raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
      const i = x.indexOf('=');
      return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
    })
  );
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

async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const cookies = parseCookies(req);
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const token = bearer || String(cookies.dimer_session || '');
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    const stored = await getUserById(payload.sub);
    if (!stored || stored.status !== 'ACTIVO') return null;
    const roles = await listRoles();
    return sanitizeUser(stored, roles.find(r => r.id === stored.roleId));
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  void getAuthenticatedUser(req).then(user => {
    if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
    if (!userHasRole(user, 'ADMIN')) return res.status(403).json({ success: false, error: 'Solo el administrador puede realizar esta operación.' });
    (req as any).dimerUser = user;
    next();
  }).catch(() => res.status(503).json({ success: false, error: 'Base de datos no disponible' }));
}

function routeError(res: Response, error: unknown) {
  console.error('[ADMIN-REQUEST-ERROR]', error);
  const message = error instanceof Error ? error.message : 'Error interno al procesar la solicitud';
  return res.status(500).json({ success: false, error: message });
}

function baseUrl(req: Request) {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const configured = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured && !configured.includes('ai.studio') && !configured.includes('aistudio.google.com')) {
    if (!(process.env.VERCEL && configured.includes('localhost'))) return configured;
  }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export function registerAdminRequestRoutes(app: Express) {
  app.delete('/api/requests/:id', requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).dimerUser as User;
      const requestId = String(req.params.id || '').trim();
      const request = await getRequest(requestId);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

      const protectedStatuses = new Set(['APROBADA', 'PAGADA', 'FINALIZADA', 'CANCELADA']);
      if (protectedStatuses.has(request.status)) {
        return res.status(400).json({
          success: false,
          error: `La solicitud ${request.folio} está en estado ${request.status} y no puede eliminarse.`
        });
      }

      await recordAuditLog({
        requestId: request.id,
        userId: admin.id,
        action: 'ELIMINACION_SOLICITUD',
        details: {
          folio: request.folio,
          previousStatus: request.status,
          requesterName: request.requesterName,
          reason: 'Eliminación administrativa de solicitud no aprobada'
        }
      });

      await deleteRequest(request.id);
      return res.json({ success: true, folio: request.folio });
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.post('/api/requests/:id/cancel', requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).dimerUser as User;
      const requestId = String(req.params.id || '').trim();
      const request = await getRequest(requestId);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

      if (request.status !== 'APROBADA') {
        return res.status(400).json({
          success: false,
          error: `Solo se pueden cancelar solicitudes APROBADAS. Estado actual: ${request.status}.`
        });
      }

      const reason = String(req.body?.reason || 'Viaje no realizado').trim() || 'Viaje no realizado';
      const updated = await updateRequest(request.id, {
        status: 'CANCELADA',
        comments: `Cancelada por administrador: ${reason}`,
        updatedAt: new Date().toISOString()
      });

      await recordAuditLog({
        requestId: request.id,
        userId: admin.id,
        action: 'CANCELACION_SOLICITUD_APROBADA',
        details: {
          folio: request.folio,
          reason,
          previousStatus: request.status,
          amountAuthorized: request.amountAuthorized
        }
      });

      return res.json({ success: true, request: updated });
    } catch (error) {
      return routeError(res, error);
    }
  });

  // El POST /api/requests histórico crea la solicitud, pero en la versión actual
  // no genera el token ni dispara las notificaciones. Este endpoint completa ese
  // paso después de que la solicitud ya quedó persistida, sin tocar SMTP ni el flujo
  // de aprobación existente.
  app.post('/api/requests/:id/notify', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const requestId = String(req.params.id || '').trim();
      const request = await getRequest(requestId);
      if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      if (!userHasRole(user, 'ADMIN') && request.userId !== user.id) {
        return res.status(403).json({ success: false, error: 'No autorizado para notificar esta solicitud' });
      }
      if (request.status !== 'PENDIENTE_APROBACION') {
        return res.status(400).json({ success: false, error: `La solicitud está en estado ${request.status} y no requiere notificación inicial.` });
      }
      if (!request.bossEmail) {
        return res.status(400).json({ success: false, error: 'La solicitud no tiene correo de aprobador asignado.' });
      }

      let current = request;
      let token = current.approvalToken || '';
      if (!token) {
        const tokenRecord = await createApprovalToken(current.id, current.bossEmail, current.bossId);
        token = tokenRecord.token;
        current = await updateRequest(current.id, {
          approvalToken: token,
          updatedAt: new Date().toISOString()
        });
      }

      const approvalUrl = `${baseUrl(req)}/api/approval/token-action?token=${encodeURIComponent(token)}`;
      const rejectUrl = approvalUrl;
      const requester = await getUserById(current.userId);
      const requesterUser = requester
        ? sanitizeUser(requester)
        : ({
            id: current.userId,
            name: current.requesterName || 'Colaborador',
            email: '',
            department: current.department || 'General',
            role: 'SOLICITANTE',
            status: 'ACTIVO'
          } as User);

      const bossHtml = buildBossApprovalEmailHtml({
        request: current,
        user: requesterUser,
        approveUrl,
        rejectUrl,
        token
      });
      const bossMail = await sendEmail({
        to: current.bossEmail,
        subject: `AUTORIZACIÓN DE VIÁTICOS - Folio ${current.folio}`,
        html: bossHtml,
        requestId: current.id,
        folio: current.folio
      });

      const confirmationHtml = buildRequesterConfirmationEmailHtml({
        request: current,
        user: requesterUser,
        bossName: current.bossName || current.bossEmail,
        bossEmail: current.bossEmail
      });
      const requesterMail = requesterUser.email
        ? await sendEmail({
            to: requesterUser.email,
            subject: `SOLICITUD DE VIÁTICOS REGISTRADA - Folio ${current.folio}`,
            html: confirmationHtml,
            requestId: current.id,
            folio: current.folio
          })
        : { status: 'FALLIDO', error: 'No se encontró correo del solicitante' } as const;

      await recordAuditLog({
        requestId: current.id,
        userId: user.id,
        action: 'NOTIFICACION_CREACION_SOLICITUD',
        details: {
          folio: current.folio,
          approvalTokenCreated: !request.approvalToken,
          bossEmail: current.bossEmail,
          requesterEmail: requesterUser.email,
          bossMailStatus: bossMail.status,
          requesterMailStatus: requesterMail.status,
          bossMailError: bossMail.error || null,
          requesterMailError: requesterMail.error || null
        }
      });

      const ok = bossMail.status === 'ENVIADO' && requesterMail.status === 'ENVIADO';
      return res.status(ok ? 200 : 502).json({
        success: ok,
        request: current,
        notifications: {
          approver: bossMail.status,
          requester: requesterMail.status,
          approverError: bossMail.error,
          requesterError: requesterMail.error
        }
      });
    } catch (error) {
      return routeError(res, error);
    }
  });
}
