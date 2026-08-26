import nodemailer from 'nodemailer';
import type { TravelRequest, User, EmailLog } from '../src/types';
import { USERS } from './db';

export const outboxLogs: EmailLog[] = [];

export function getMailTransporter(overrideHost?: string) {
  const host = overrideHost || process.env.SMTP_HOST?.trim() || process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '465', 10);
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER)?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
  const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '';
  const pass = rawPass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  if (user && pass) {
    if (host.toLowerCase() === 'smtp.gmail.com' || (host.toLowerCase().includes('gmail.com') && !host.toLowerCase().includes('smtp-relay'))) {
      return nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, tls: { rejectUnauthorized: false } });
    }
    return nodemailer.createTransport({ host, port, secure, name: 'dimer.com.mx', auth: { user, pass }, tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
  }
  return null;
}

export function getFromAddress(customFrom?: string): string {
  if (customFrom && customFrom.trim()) return customFrom.trim().replace(/^["']|["']$/g, '');
  const envFrom = (process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.MAIL_FROM)?.trim().replace(/^["']|["']$/g, '');
  if (envFrom) return envFrom;
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER)?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
  return `Dimer Notificaciones <${user}>`;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

export function buildBossApprovalEmailHtml(params: { request: TravelRequest; user: User; approveUrl: string; rejectUrl: string; token: string }) {
  const { request, user, approveUrl, rejectUrl, token } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || 'Operaciones';
  const requestType = request.requestType || 'Viáticos y Gastos de Viaje';
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'));
  const urgency = (request.urgency || 'media').toLowerCase();
  const urgencyBadgeStyle = urgency === 'alta' ? 'background: #fef2f2; color: #dc2626; border: 1px solid #f87171;' : urgency === 'baja' ? 'background: #f0fdf4; color: #16a34a; border: 1px solid #86efac;' : 'background: #fffbeb; color: #d97706; border: 1px solid #fcd34d;';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.btn{display:inline-block;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px;font-size:14px;margin:4px}.approve{background:#059669}.reject{background:#dc2626}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD POR AUTORIZAR - ${requestType}</div><h1>Revisión y Dictamen de Jefatura</h1><p>Folio Oficial: <strong>${request.folio}</strong></p></div><div class="content"><p>Estimado/a Líder, <strong>${requesterName}</strong> (${user.email}) ha generado una solicitud para su autorización formal.</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${request.folio}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${requesterName}</strong> (${user.email})</td></tr><tr><td class="label">Departamento</td><td class="value">${department}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${requestType}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${requestDate}</td></tr><tr><td class="label">Urgencia</td><td class="value"><span style="${urgencyBadgeStyle}">${urgency.toUpperCase()}</span></td></tr><tr><td class="label">Detalle</td><td class="value">${detail}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value"><strong>${request.destination}</strong></td></tr>` : ''}${request.startDate && request.endDate ? `<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString('es-MX')} al ${new Date(request.endDate).toLocaleDateString('es-MX')}</td></tr>` : ''}${request.comments ? `<tr><td class="label">Observaciones</td><td class="value">${request.comments}</td></tr>` : ''}</table><div class="amount"><div>Monto Total Solicitado</div><strong style="font-size:24px;color:#047857">${formatCurrency(request.amountRequested)} MXN</strong></div><div style="text-align:center"><a href="${approveUrl}" class="btn approve">✓ APROBAR SOLICITUD</a><a href="${rejectUrl}" class="btn reject">✕ RECHAZAR SOLICITUD</a></div><p style="font-size:11px;color:#64748b">Token de un solo uso: ${token}</p></div><div class="footer">Solicitud de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildSystemsApprovedEmailHtml(params: { request: TravelRequest; user: User; approverName: string; approverEmail: string; approvedAt: string }) {
  const { request, user, approverName, approverEmail, approvedAt } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || 'Operaciones';
  const requestType = request.requestType || 'Viáticos y Gastos de Viaje';
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'));
  const urgency = (request.urgency || 'media').toLowerCase();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#064e3b;color:#fff;padding:24px 32px;border-bottom:3px solid #10b981}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.authorized{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;text-align:center;margin:20px 0}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD APROBADA - ${requestType}</div><h1>SOLICITUD APROBADA - ${request.folio}</h1><p>Notificación oficial a Sistemas, Finanzas y Solicitante</p></div><div class="content"><p>Se ha registrado la autorización formal de la siguiente solicitud:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${request.folio}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${requesterName}</strong> (${user.email})</td></tr><tr><td class="label">Departamento</td><td class="value">${department}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${requestType}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${requestDate}</td></tr><tr><td class="label">Urgencia</td><td class="value">${urgency.toUpperCase()}</td></tr><tr><td class="label">Jefe que Aprobó</td><td class="value"><strong>${approverName}</strong> (${approverEmail})</td></tr><tr><td class="label">Fecha/Hora Aprobación</td><td class="value">${new Date(approvedAt).toLocaleString('es-MX')}</td></tr><tr><td class="label">Detalle</td><td class="value">${detail}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value">${request.destination}</td></tr>` : ''}<tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr>${request.comments ? `<tr><td class="label">Observaciones</td><td class="value">${request.comments}</td></tr>` : ''}</table><div class="authorized"><div>Monto Total Autorizado</div><strong style="font-size:26px;color:#047857">${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</strong></div></div><div class="footer">Sistema de Gestión de Solicitudes © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildVerificationEmailHtml(params: { name: string; email: string; code: string; expiresMinutes?: number }): string {
  const { name, email, code, expiresMinutes = 15 } = params;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Código de Verificación - Viáticos Dimer</title><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:28px 24px;text-align:center}.body{padding:32px 28px;text-align:center}.code-box{background:#f8fafc;border:2px dashed #6366f1;border-radius:12px;padding:24px;margin:24px 0}.code-digits{font-family:monospace;font-size:36px;font-weight:900;letter-spacing:.25em;color:#0f172a}.footer{background:#f8fafc;padding:18px 24px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Viáticos Dimer</h1><p>Verificación de Seguridad de Cuenta</p></div><div class="body"><p>Hola <strong>${name}</strong>,</p><p>Has solicitado registrar tu cuenta con el correo <strong>${email}</strong>.</p><div class="code-box"><div>Tu Código de Verificación</div><div class="code-digits">${code}</div><div>Válido por <strong>${expiresMinutes} minutos</strong></div></div><p style="font-size:12px;color:#64748b">Si tú no solicitaste este código, ignora este mensaje.</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export async function sendEmail(params: { to: string; subject: string; html: string; from?: string; replyTo?: string; requestId?: string; folio?: string }): Promise<{ success: boolean; logId: string; status: 'ENVIADO' | 'SIMULADO' | 'FALLIDO'; error?: string }> {
  const { to, subject, html, from: customFrom, replyTo, requestId, folio } = params;
  const logId = `MAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const host = process.env.SMTP_HOST?.trim() || process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '465', 10);
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER)?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
  const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '';
  const pass = rawPass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  const effectiveFrom = getFromAddress(customFrom);
  const effectiveReplyTo = replyTo || process.env.SMTP_REPLY_TO?.trim() || undefined;

  // DIMER_APPROVAL_REQUESTER_COPY_V1
  // Only the Systems approval notification carries the requester copy.
  // Finance continues receiving its normal notification, so no duplicate is created.
  let requesterApprovalCopy: string | undefined;
  const isApprovalNotification = /SOLICITUD DE VIÁTICOS APROBADA/i.test(subject);
  if (isApprovalNotification && requestId && to.trim().toLowerCase() === 'sistemas@dimer.com.mx') {
    const requester = USERS.find(u => u.id === requestId);
    const requesterEmail = requester?.email?.trim().toLowerCase();
    const financeEmail = (process.env.FINANZAS_EMAIL || 'finanzas@dimer.com.mx').trim().toLowerCase();
    if (requesterEmail && requesterEmail !== 'sistemas@dimer.com.mx' && requesterEmail !== financeEmail) {
      requesterApprovalCopy = requesterEmail;
    }
  }

  console.log(`[MAIL SERVICE INITIATION] Destinatario: ${to} | CC solicitante: ${requesterApprovalCopy || 'NO'} | Asunto: "${subject}" | Host: ${host}:${port} | Usuario: ${user} | Password configurada: ${pass ? `SÍ (${pass.length} chars)` : 'NO'}`);

  if (!pass) {
    const errorMsg = `No se puede enviar correo real a ${to}: Falta configurar SMTP_PASS (o SMTP_PASSWORD) en las variables de entorno de Vercel.`;
    console.error(`[MAIL SERVICE ERROR] ${errorMsg}`);
    const isProdOrVercel = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
    const log: EmailLog = { id: logId, requestId, folio, to, subject, html, status: isProdOrVercel ? 'FALLIDO' : 'SIMULADO', error: errorMsg, createdAt: new Date().toISOString() };
    outboxLogs.unshift(log);
    return { success: !isProdOrVercel, logId, status: isProdOrVercel ? 'FALLIDO' : 'SIMULADO', error: errorMsg };
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    const errorMsg = `No se pudo inicializar el transporte SMTP para ${user}@${host}.`;
    const log: EmailLog = { id: logId, requestId, folio, to, subject, html, status: 'FALLIDO', error: errorMsg, createdAt: new Date().toISOString() };
    outboxLogs.unshift(log);
    return { success: false, logId, status: 'FALLIDO', error: errorMsg };
  }

  try {
    const info = await transporter.sendMail({ from: effectiveFrom, replyTo: effectiveReplyTo, to, cc: requesterApprovalCopy, subject, html });
    const log: EmailLog = { id: logId, requestId, folio, to, subject, html, status: 'ENVIADO', createdAt: new Date().toISOString() };
    outboxLogs.unshift(log);
    console.log(`[MAIL SERVICE SUCCESS] Correo SMTP ENVIADO a ${to}${requesterApprovalCopy ? ` con copia a ${requesterApprovalCopy}` : ''} (Folio: ${folio || 'N/A'}, MessageId: ${info.messageId || 'N/A'})`);
    return { success: true, logId, status: 'ENVIADO' };
  } catch (err: any) {
    console.error(`[MAIL SERVICE ERROR] Falla en envío SMTP a ${to}:`, { message: err.message, code: err.code, command: err.command, response: err.response, responseCode: err.responseCode });
    try {
      const fallbackTransporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, tls: { rejectUnauthorized: false } });
      const fallbackInfo = await fallbackTransporter.sendMail({ from: effectiveFrom, replyTo: effectiveReplyTo, to, cc: requesterApprovalCopy, subject, html });
      const log: EmailLog = { id: logId, requestId, folio, to, subject, html, status: 'ENVIADO', createdAt: new Date().toISOString() };
      outboxLogs.unshift(log);
      console.log(`[MAIL SERVICE SUCCESS] Fallback Gmail ENVIADO a ${to}${requesterApprovalCopy ? ` con copia a ${requesterApprovalCopy}` : ''} (MessageId: ${fallbackInfo.messageId || 'N/A'})`);
      return { success: true, logId, status: 'ENVIADO' };
    } catch (fallbackErr: any) {
      console.error('[MAIL SERVICE ERROR] Fallback Gmail también falló:', { message: fallbackErr.message, code: fallbackErr.code, response: fallbackErr.response });
    }
    const detailError = `Error SMTP: ${err.message}${err.response ? ` (${err.response})` : ''}`;
    const log: EmailLog = { id: logId, requestId, folio, to, subject, html, status: 'FALLIDO', error: detailError, createdAt: new Date().toISOString() };
    outboxLogs.unshift(log);
    return { success: false, logId, status: 'FALLIDO', error: detailError };
  }
}

export function buildNewAccountAdminEmailHtml(params: { user: { name: string; email: string; department: string; role: string }; registeredAt: string }) {
  const { user, registeredAt } = params;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#1e1b4b;color:#fff;padding:24px 32px;border-bottom:3px solid #6366f1}.content{padding:28px 32px}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><h1>Nuevo Usuario Registrado</h1><p>Revisión y Asignación de Rol Requerida</p></div><div class="content"><p>Se ha registrado una nueva cuenta de colaborador.</p><table style="width:100%;border-collapse:collapse"><tr><td>Nombre</td><td>${user.name}</td></tr><tr><td>Correo</td><td>${user.email}</td></tr><tr><td>Departamento</td><td>${user.department}</td></tr><tr><td>Rol Inicial</td><td>${user.role}</td></tr><tr><td>Fecha</td><td>${new Date(registeredAt).toLocaleString('es-MX')}</td></tr></table></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildTokenApprovalResultPageHtml(params: { status: 'APROBADA' | 'RECHAZADA' | 'YA_PROCESADA' | 'INVALIDA' | 'CANCELADA'; request?: TravelRequest; actionTaken?: string; errorMessage?: string; processedBy?: string; processedAt?: string }) {
  const { status, request, errorMessage, processedBy, processedAt } = params;
  const isSuccess = status === 'APROBADA';
  const isRejected = status === 'RECHAZADA';
  const isAlready = status === 'YA_PROCESADA';
  let mainHeading = 'Resultado del Dictamen';
  let message = errorMessage || 'El enlace utilizado no es válido, ha expirado o el token ya fue consumido.';
  if (isSuccess) { mainHeading = '✓ Solicitud Autorizada con Éxito'; message = 'La solicitud ha quedado formalmente AUTORIZADA en el sistema de viáticos Dimer. Se ha notificado a Finanzas, Sistemas y al solicitante.'; }
  else if (isRejected) { mainHeading = '✕ Solicitud Rechazada'; message = 'La solicitud ha sido registrada como RECHAZADA. El solicitante y las áreas correspondientes han sido informados.'; }
  else if (isAlready) { mainHeading = 'Esta Solicitud Ya Fue Procesada'; message = `Esta solicitud ya fue atendida previamente (${request?.status}).`; }
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dictamen de Solicitud - Dimer</title><style>body{font-family:Arial,sans-serif;background:#0f172a;margin:0;padding:24px;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden}.header{background:${isSuccess?'#064e3b':isRejected?'#881337':'#1e293b'};color:#fff;padding:28px 32px;border-bottom:4px solid ${isSuccess?'#10b981':isRejected?'#f43f5e':'#3b82f6'}}.content{padding:28px 32px}.message{background:#f8fafc;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:6px;margin-bottom:24px}.info{width:100%;border-collapse:collapse}.info td{padding:9px;border-bottom:1px solid #f1f5f9}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><h1>${mainHeading}</h1><p>${request ? `Folio Oficial: <strong>${request.folio}</strong>` : 'Sistema de Viáticos Dimer'}</p></div><div class="content"><div class="message">${message}</div>${request?`<table class="info"><tr><td>Solicitante</td><td>${request.requesterName}</td></tr><tr><td>Departamento</td><td>${request.department}</td></tr><tr><td>Destino</td><td>${request.destination || ''}</td></tr><tr><td>Procesado por</td><td>${processedBy || request.approvedBy || request.rejectedBy || request.bossEmail}</td></tr><tr><td>Fecha/Hora</td><td>${new Date(processedAt || Date.now()).toLocaleString('es-MX')}</td></tr></table><p><strong>Monto:</strong> ${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</p>`:''}</div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}
