import type { Express, Request, Response } from 'express';
import { getUserById, getRequest, validateApprovalToken, processApprovalTokenAction, recordAuditLog, sanitizeUser } from './db.js';
import { buildTokenApprovalDecisionPageHtml, buildTokenApprovalResultPageHtml, buildSystemsApprovedEmailHtml, buildRejectionEmailHtml, sendEmail } from './mailService.js';
import type { TravelRequest, User } from '../src/types.js';

async function resolveUser(request: TravelRequest): Promise<User> {
  const raw = request.userId ? await getUserById(request.userId) : null;
  if (raw) return sanitizeUser(raw);
  return { id: request.userId || 'usr_solicitante', name: request.requesterName || 'Colaborador', email: '', department: request.department || 'General', role: 'SOLICITANTE', status: 'ACTIVO' } as User;
}

export function registerApprovalRoutes(app: Express) {
  const getDecision = async (req: Request, res: Response) => {
    try {
      const token = String(req.query?.token || req.params?.token || '').trim();
      if (!token) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: 'INVALIDA', errorMessage: 'Token no proporcionado.' }));
      const validation = await validateApprovalToken(token);
      if (!validation.valid || !validation.request) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: 'INVALIDA', errorMessage: validation.error || 'Este enlace ya no es válido.' }));
      const user = await resolveUser(validation.request);
      return res.send(buildTokenApprovalDecisionPageHtml({ request: validation.request, user, token, initialAction: 'approve', approverEmail: validation.tokenRecord?.bossEmail || validation.request.bossEmail }));
    } catch (e) { return res.status(500).send(buildTokenApprovalResultPageHtml({ status: 'INVALIDA', errorMessage: e instanceof Error ? e.message : 'Error procesando autorización.' })); }
  };

  const submitDecision = async (req: Request, res: Response) => {
    try {
      const token = String(req.body?.token || req.query?.token || '').trim();
      const decision = String(req.body?.decision || req.body?.action || req.query?.decision || '').toUpperCase();
      if (!token || !['APROBADA', 'RECHAZADA'].includes(decision)) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: 'INVALIDA', errorMessage: 'Token o decisión inválidos.' }));
      const validation = await validateApprovalToken(token);
      if (!validation.valid || !validation.request) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: 'INVALIDA', errorMessage: validation.error || 'Este enlace ya no es válido.' }));
      const comments = String(req.body?.comments || req.body?.reason || '').trim();
      if (decision === 'RECHAZADA' && !comments) {
        const user = await resolveUser(validation.request);
        return res.status(400).send(buildTokenApprovalDecisionPageHtml({ request: validation.request, user, token, initialAction: 'reject', approverEmail: validation.tokenRecord?.bossEmail || validation.request.bossEmail, errorMessage: 'Debes indicar obligatoriamente el motivo por el cual se rechaza la solicitud.' }));
      }
      const amount = req.body?.amountAuthorized !== undefined && req.body?.amountAuthorized !== '' ? Number(req.body.amountAuthorized) : undefined;
      const result = await processApprovalTokenAction(token, decision as 'APROBADA' | 'RECHAZADA', decision === 'APROBADA' ? amount : undefined, comments || undefined);
      const requestId = String(result?.requestId || result?.request_id || validation.request.id);
      const request = await getRequest(requestId) || validation.request;
      const approverEmail = String(result?.bossEmail || validation.tokenRecord?.bossEmail || request.bossEmail || 'sistemas@dimer.com.mx');
      const approverName = String(result?.bossName || validation.tokenRecord?.bossEmail || request.bossName || request.bossEmail || 'Jefe Aprobador');
      const user = await resolveUser(request);
      if (decision === 'APROBADA') {
        const baseHtml = buildSystemsApprovedEmailHtml({ request, user, approverName, approverEmail, approvedAt: request.approvedAt || new Date().toISOString() });
        const requesterEmail = user.email.trim().toLowerCase();

        // FINANZAS_URL es el nombre actualmente utilizado en Vercel por la configuración
        // del proyecto. FINANZAS_EMAIL se conserva como compatibilidad con instalaciones
        // anteriores. No existe fallback a finanzas@dimer.com.mx para evitar que un alias
        // antiguo pueda redirigir accidentalmente la notificación a Sistemas.
        const configuredFinanzas = String(process.env.FINANZAS_URL || process.env.FINANZAS_EMAIL || '').trim().toLowerCase();
        const finanzasEmail = configuredFinanzas && configuredFinanzas !== 'sistemas@dimer.com.mx' ? configuredFinanzas : '';

        // SOLICITANTE y FINANZAS son notificaciones independientes.
        // SISTEMAS no recibe copia de una aprobación, salvo que sea el propio solicitante.
        const recipientCopies: Array<{ to: string; label: string; subjectSuffix: string }> = [];
        if (requesterEmail) recipientCopies.push({ to: requesterEmail, label: 'SOLICITANTE', subjectSuffix: 'SOLICITANTE' });
        if (finanzasEmail && finanzasEmail !== requesterEmail) recipientCopies.push({ to: finanzasEmail, label: 'FINANZAS', subjectSuffix: 'FINANZAS' });

        if (!finanzasEmail) {
          console.error('[FINANZAS] No se enviará la notificación porque FINANZAS_URL/FINANZAS_EMAIL no está configurada o apunta a sistemas@dimer.com.mx.');
        }

        for (const recipient of recipientCopies) {
          const html = `<div style="font-family:Arial,sans-serif;font-size:11px;color:#666;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.4px;">Notificación para: <strong>${recipient.label}</strong></div>${baseHtml}`;
          try {
            await sendEmail({
              to: recipient.to,
              subject: `SOLICITUD DE VIÁTICOS APROBADA - Folio ${request.folio} - ${recipient.subjectSuffix}`,
              html,
              requestId: request.id,
              folio: request.folio
            });
          } catch {}
        }
      } else {
        const html = buildRejectionEmailHtml({ request, user, rejectorName: approverName, rejectorEmail: approverEmail, reason: request.comments || comments || 'Solicitud no autorizada' });
        const targets = [user.email.trim().toLowerCase(), 'sistemas@dimer.com.mx'].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
        for (const to of targets) { try { await sendEmail({ to, subject: `SOLICITUD DE VIÁTICOS NO AUTORIZADA - Folio ${request.folio}`, html, requestId: request.id, folio: request.folio }); } catch {} }
      }
      await recordAuditLog({ requestId: request.id, userId: validation.tokenRecord?.bossId || 'token_auth', action: decision === 'APROBADA' ? 'APROBACION_VIA_TOKEN' : 'RECHAZO_VIA_TOKEN', details: { folio: request.folio, decision, approverEmail, comments } });
      return res.send(buildTokenApprovalResultPageHtml({ status: decision as 'APROBADA' | 'RECHAZADA', request, actionTaken: decision, processedBy: approverEmail, processedAt: String(result?.processedAt || new Date().toISOString()) }));
    } catch (e) { return res.status(500).send(buildTokenApprovalResultPageHtml({ status: 'INVALIDA', errorMessage: e instanceof Error ? e.message : 'Error procesando autorización.' })); }
  };

  app.get(['/api/approval/decision','/api/approval/token-action','/approval-response/:token/:decision','/api/approval-response/:token/:decision'], getDecision);
  app.post(['/api/approval/submit-decision','/api/approval/token-action','/api/approval/decision'], submitDecision);
}
