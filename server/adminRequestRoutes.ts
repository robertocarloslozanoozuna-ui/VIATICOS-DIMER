import type { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { getUserById, getRequest, deleteRequest, updateRequest, recordAuditLog, listRoles, sanitizeUser } from './db.js';
import type { User } from '../src/types.js';

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
    if (user.role !== 'ADMIN') return res.status(403).json({ success: false, error: 'Solo el administrador puede realizar esta operación.' });
    (req as any).dimerUser = user;
    next();
  }).catch(() => res.status(503).json({ success: false, error: 'Base de datos no disponible' }));
}

function routeError(res: Response, error: unknown) {
  console.error('[ADMIN-REQUEST-ERROR]', error);
  const message = error instanceof Error ? error.message : 'Error interno al procesar la solicitud';
  return res.status(500).json({ success: false, error: message });
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

      // Registrar la auditoría antes de eliminar para evitar conflictos con
      // instalaciones de Supabase que tengan una FK audit_logs.request_id.
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
}
