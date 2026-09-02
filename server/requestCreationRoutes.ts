import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { getUserById, listRoles, sanitizeUser, listBosses, generateNextFolio, insertRequest, updateRequest, createApprovalToken, recordAuditLog } from './db.js';
import { buildBossApprovalEmailHtml, buildRequesterConfirmationEmailHtml, sendEmail } from './mailService.js';
import type { User, TravelRequest } from '../src/types.js';

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

async function auth(req: Request): Promise<User | null> {
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

function errorResponse(res: Response, error: unknown) {
  console.error('[REQUEST-CREATE]', error);
  return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error al procesar la solicitud' });
}

export function registerRequestCreationRoutes(app: Express) {
  app.post('/api/requests/create', async (req, res) => {
    try {
      const user = await auth(req);
      if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });

      const b = req.body || {};
      const bossId = String(b.bossId || '').trim();
      const bossEmailInput = String(b.bossEmail || '').trim().toLowerCase();
      if (!bossEmailInput) return res.status(400).json({ success: false, error: 'Correo del jefe/aprobador requerido' });

      const bosses = await listBosses();
      const boss = bosses.find(x => (bossId && x.id === bossId) || x.email?.trim().toLowerCase() === bossEmailInput);
      if (!boss) return res.status(400).json({ success: false, error: 'No se encontró el jefe/aprobador seleccionado en el catálogo.' });

      const folio = await generateNextFolio();
      const id = `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const now = new Date().toISOString();
      const created = await insertRequest({
        id,
        folio,
        status: 'PENDIENTE_APROBACION',
        userId: user.id,
        requesterName: String(b.requesterName || user.name || '').trim(),
        department: String(b.department || user.department || '').trim(),
        requestType: String(b.requestType || '').trim(),
        detail: String(b.detail || '').trim(),
        requestDate: String(b.requestDate || now.slice(0, 10)).slice(0, 10),
        depositDate: String(b.depositDate || '').slice(0, 10) || undefined,
        urgency: String(b.urgency || 'media').trim().toLowerCase() as any,
        bossId: boss.id,
        bossEmail: boss.email,
        bossName: boss.name || String(b.bossName || '').trim() || boss.email,
        startDate: b.startDate || null,
        endDate: b.endDate || null,
        destination: String(b.destination || '').trim(),
        reason: String(b.reason || b.detail || '').trim(),
        amountRequested: Number(b.amountRequested || 0),
        amountAuthorized: null,
        transportCost: Number(b.transportCost || 0),
        hotelCost: Number(b.hotelCost || 0),
        foodCost: Number(b.foodCost || 0),
        miscCost: Number(b.miscCost || 0),
        comments: String(b.comments || '').trim() || null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        approvalToken: null,
        createdAt: now,
        updatedAt: now
      } as TravelRequest);

      const tokenRecord = await createApprovalToken(created.id, created.bossEmail, created.bossId);
      const request = await updateRequest(created.id, { approvalToken: tokenRecord.token, updatedAt: new Date().toISOString() });
      const requesterRecord = await getUserById(request.userId);
      const requester = requesterRecord
        ? sanitizeUser(requesterRecord)
        : ({ ...user, id: request.userId, name: request.requesterName || user.name, department: request.department || user.department } as User);

      const approvalUrl = `${baseUrl(req)}/api/approval/token-action?token=${encodeURIComponent(tokenRecord.token)}`;
      const bossMail = await sendEmail({
        to: request.bossEmail,
        subject: `AUTORIZACIÓN DE VIÁTICOS - Folio ${request.folio}`,
        html: buildBossApprovalEmailHtml({ request, user: requester, approveUrl: approvalUrl, rejectUrl: approvalUrl, token: tokenRecord.token }),
        requestId: request.id,
        folio: request.folio
      });

      const requesterMail = requester.email
        ? await sendEmail({
            to: requester.email,
            subject: `SOLICITUD DE VIÁTICOS REGISTRADA - Folio ${request.folio}`,
            html: buildRequesterConfirmationEmailHtml({ request, user: requester, bossName: request.bossName || request.bossEmail, bossEmail: request.bossEmail }),
            requestId: request.id,
            folio: request.folio
          })
        : { status: 'FALLIDO', error: 'No se encontró correo del solicitante' } as const;

      await recordAuditLog({
        requestId: request.id,
        userId: user.id,
        action: 'CREACION_SOLICITUD',
        details: {
          folio: request.folio,
          approverEmail: request.bossEmail,
          requesterEmail: requester.email,
          approvalTokenCreated: true,
          approverMailStatus: bossMail.status,
          approverMailError: bossMail.error || null,
          requesterMailStatus: requesterMail.status,
          requesterMailError: requesterMail.error || null
        }
      });

      return res.json({
        success: true,
        request,
        notifications: {
          approver: bossMail.status,
          approverError: bossMail.error,
          requester: requesterMail.status,
          requesterError: requesterMail.error
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });
}
