import express from 'express';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { createApp } from '../server/app.js';
import { supabase } from '../server/supabase.js';
import { getBossById, generateNextFolio, createApprovalToken, insertRequest, recordAuditLog, getUserById, sanitizeUser } from '../server/db.js';
import { buildBossApprovalEmailHtml, sendEmail } from '../server/mailService.js';
import type { TravelRequest, User } from '../src/types.js';

const app = createApp();
const gateway = express();
gateway.set('trust proxy', 1);
gateway.use(express.json({ limit: '10mb' }));

function cookies(req: Request) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i < 0 ? [v, ''] : [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}

function jwtUserId(token: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET');
  const p = token.split('.');
  if (p.length !== 3) throw new Error('JWT inválido');
  const expected = crypto.createHmac('sha256', secret).update(`${p[0]}.${p[1]}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(p[2]))) throw new Error('JWT inválido');
  const payload = JSON.parse(Buffer.from(p[1], 'base64url').toString('utf8')) as { sub?: string; exp?: number };
  if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Sesión expirada');
  return payload.sub;
}

async function createRequest(req: Request, res: Response) {
  let stage = 'autenticación';
  try {
    const token = cookies(req).dimer_session || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
    const userId = jwtUserId(token);
    const rawUser = await getUserById(userId);
    if (!rawUser || rawUser.status !== 'ACTIVO') return res.status(401).json({ success: false, error: 'Sesión inválida o usuario inactivo' });
    const user = sanitizeUser(rawUser) as User;
    const b = req.body || {};
    const boss = b.bossId ? await getBossById(String(b.bossId)) : null;
    const bossEmail = String(boss?.email || b.bossEmail || '').trim().toLowerCase();
    if (!bossEmail) return res.status(400).json({ success: false, error: 'Debe seleccionar un jefe que autoriza' });
    const reason = String(b.detail || b.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, error: 'La descripción o detalle es obligatorio' });
    const amount = Number(b.amountRequested ?? 0);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, error: 'Monto solicitado no válido' });

    const id = `req_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    stage = 'generación de folio';
    const folio = await generateNextFolio();
    stage = 'creación de token';
    const approval = await createApprovalToken(id, bossEmail, boss?.id);
    stage = 'inserción en Supabase';
    const now = new Date().toISOString();
    const request: TravelRequest = {
      id, folio, status: 'PENDIENTE_APROBACION', userId: user.id,
      requesterName: String(b.requesterName || user.name), department: String(b.department || user.department || 'General'),
      requestType: String(b.requestType || 'Viáticos y Gastos de Viaje'), detail: reason,
      requestDate: String(b.requestDate || now.slice(0, 10)), urgency: String(b.urgency || 'media'),
      bossId: boss?.id, bossEmail, bossName: boss?.name || bossEmail,
      startDate: String(b.startDate || now), endDate: String(b.endDate || b.startDate || now),
      destination: String(b.destination || 'Oficina / Centro Corporativo'), reason,
      amountRequested: amount, amountAuthorized: null,
      transportCost: Number(b.transportCost ?? 0), hotelCost: Number(b.hotelCost ?? 0), foodCost: Number(b.foodCost ?? 0), miscCost: Number(b.miscCost ?? 0),
      comments: b.comments ? String(b.comments).trim() : null, approvedBy: undefined, approvedAt: undefined,
      approvalToken: approval.token, createdAt: now, updatedAt: now
    } as TravelRequest;
    const saved = await insertRequest(request);
    stage = 'auditoría';
    await recordAuditLog({ requestId: saved.id, userId: user.id, action: 'CREACION_SOLICITUD', details: { folio: saved.folio, amountRequested: saved.amountRequested, bossEmail } });

    const base = (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `https://${process.env.VERCEL_URL || req.headers.host}`)).replace(/\/$/, '');
    const approveUrl = `${base}/api/approval/token-action?token=${encodeURIComponent(approval.token)}&action=approve`;
    const rejectUrl = `${base}/api/approval/token-action?token=${encodeURIComponent(approval.token)}&action=reject`;
    const html = buildBossApprovalEmailHtml({ request: saved, user, approveUrl, rejectUrl, token: approval.token });
    stage = 'correo';
    let mailResult: any;
    try {
      mailResult = await sendEmail({ to: bossEmail, subject: `SOLICITUD POR AUTORIZAR - Folio ${folio}`, html, requestId: id, folio });
    } catch (e) {
      mailResult = { success: false, status: 'FALLIDO', error: e instanceof Error ? e.message : String(e) };
      console.error('[DIMER REQUEST EMAIL ERROR]', e);
    }
    if (bossEmail !== 'sistemas@dimer.com.mx') {
      try { await sendEmail({ to: 'sistemas@dimer.com.mx', subject: `Nueva solicitud por autorizar - ${folio}`, html, requestId: id, folio }); }
      catch (e) { console.error('[DIMER SYSTEM EMAIL ERROR]', e); }
    }
    return res.status(201).json({ success: true, request: saved, approvalToken: approval.token, mailResult });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[DIMER POST /api/requests GATEWAY ERROR]', { stage, message, stack: e instanceof Error ? e.stack : undefined });
    return res.status(503).json({ success: false, error: message || 'Error interno al crear la solicitud', stage, database: 'supabase', runtime: 'vercel-serverless' });
  }
}

gateway.post('/api/requests', createRequest);
gateway.use(app);

export default function handler(req: Request, res: Response) {
  return gateway(req, res);
}
