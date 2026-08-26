import nodemailer from 'nodemailer';
import type { TravelRequest, User, EmailLog } from '../src/types';

// In-memory Outbox store for live UI inspection and debugging
export const outboxLogs: EmailLog[] = [];

// Initialize Nodemailer Transporter with fallback
export function getMailTransporter(overrideHost?: string) {
  const host = overrideHost || process.env.SMTP_HOST?.trim() || process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '465', 10);
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER)?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
  
  // Sanitize password: check all common variable names, trim quotes and remove internal spaces (Google App Passwords generated as 'xxxx xxxx xxxx xxxx')
  const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '';
  const pass = rawPass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (user && pass) {
    // If it's a Gmail/Google Workspace account or requested smtp.gmail.com, use standard Gmail service
    if (host.toLowerCase() === 'smtp.gmail.com' || (host.toLowerCase().includes('gmail.com') && !host.toLowerCase().includes('smtp-relay'))) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      name: 'dimer.com.mx', // Sets valid FQDN for EHLO
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return null;
}

export function getFromAddress(customFrom?: string): string {
  if (customFrom && customFrom.trim()) {
    return customFrom.trim().replace(/^["']|["']$/g, '');
  }
  const envFrom = (process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.MAIL_FROM)?.trim().replace(/^["']|["']$/g, '');
  if (envFrom) {
    return envFrom;
  }
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER)?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
  return `Dimer Notificaciones <${user}>`;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

/**
 * 1. Plantilla HTML oficial para el Jefe Directo con Token Seguro
 */
export function buildBossApprovalEmailHtml(params: {
  request: TravelRequest;
  user: User;
  approveUrl: string;
  rejectUrl: string;
  token: string;
}) {
  const { request, user, approveUrl, rejectUrl, token } = params;

  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || 'Operaciones';
  const requestType = request.requestType || 'Viáticos y Gastos de Viaje';
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'));
  const urgency = (request.urgency || 'media').toLowerCase();

  const urgencyBadgeStyle =
    urgency === 'alta'
      ? 'background: #fef2f2; color: #dc2626; border: 1px solid #f87171;'
      : urgency === 'baja'
      ? 'background: #f0fdf4; color: #16a34a; border: 1px solid #86efac;'
      : 'background: #fffbeb; color: #d97706; border: 1px solid #fcd34d;';

  const urgencyLabel = urgency.toUpperCase();

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; text-align: left; border-bottom: 3px solid #3b82f6; }
    .badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
    .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .subtitle { margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px 32px; }
    .alert-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #1e40af; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 700; color: #64748b; width: 35%; text-transform: uppercase; font-size: 11px; }
    .info-table td.value { color: #0f172a; font-weight: 500; }
    .breakdown-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; }
    .breakdown-title { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
    .breakdown-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; }
    .amount-highlight { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0; }
    .amount-highlight .lbl { font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; }
    .amount-highlight .val { font-size: 24px; font-weight: 900; color: #047857; }
    .btn-group { text-align: center; margin: 24px 0 12px 0; }
    .btn-approve { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 6px; font-size: 14px; margin: 4px; }
    .btn-reject { display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 6px; font-size: 13px; margin: 4px; }
    .token-security { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-top: 20px; font-size: 11px; color: #64748b; font-family: monospace; word-break: break-all; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">SOLICITUD POR AUTORIZAR - ${requestType}</span>
      <h1 class="title">Revisión y Dictamen de Jefatura</h1>
      <p class="subtitle">Folio Oficial: <strong>${request.folio}</strong></p>
    </div>
    <div class="content">
      <div class="alert-box">
        Estimado/a Líder, <strong>${requesterName}</strong> (${user.email}) ha generado una solicitud para su autorización formal.
      </div>

      <table class="info-table">
        <tr>
          <td class="label">Folio</td>
          <td class="value"><strong style="color: #2563eb; font-family: monospace;">${request.folio}</strong></td>
        </tr>
        <tr>
          <td class="label">Nombre del Solicitante</td>
          <td class="value"><strong>${requesterName}</strong> (${user.email})</td>
        </tr>
        <tr>
          <td class="label">Área o Departamento</td>
          <td class="value">${department}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud</td>
          <td class="value"><strong>${requestType}</strong></td>
        </tr>
        <tr>
          <td class="label">Fecha de la Solicitud</td>
          <td class="value">${requestDate}</td>
        </tr>
        <tr>
          <td class="label">Urgencia</td>
          <td class="value">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; ${urgencyBadgeStyle}">
              ${urgencyLabel}
            </span>
          </td>
        </tr>
        <tr>
          <td class="label">Descripción / Detalle</td>
          <td class="value" style="white-space: pre-line;">${detail}</td>
        </tr>
        ${request.destination ? `
        <tr>
          <td class="label">Destino / Lugar</td>
          <td class="value"><strong>${request.destination}</strong></td>
        </tr>
        ` : ''}
        ${request.startDate && request.endDate ? `
        <tr>
          <td class="label">Periodo de Ejecución</td>
          <td class="value">${new Date(request.startDate).toLocaleDateString('es-MX')} al ${new Date(request.endDate).toLocaleDateString('es-MX')}</td>
        </tr>
        ` : ''}
        ${request.comments ? `
        <tr>
          <td class="label">Observaciones Adicionales</td>
          <td class="value">${request.comments}</td>
        </tr>
        ` : ''}
      </table>

      <div class="amount-highlight">
        <div class="lbl">Monto Total Solicitado</div>
        <div class="val">${formatCurrency(request.amountRequested)} MXN</div>
      </div>

      <div class="btn-group">
        <a href="${approveUrl}" class="btn-approve" target="_blank">✓ APROBAR SOLICITUD</a>
        <a href="${rejectUrl}" class="btn-reject" target="_blank">✕ RECHAZAR SOLICITUD</a>
      </div>

      <div class="token-security">
        <strong>Enlace Seguro con Token Único:</strong><br>
        Token de un solo uso: ${token}<br>
        Válido por 7 días exclusivamente para ${request.bossEmail}.
      </div>
    </div>
    <div class="footer">
      Solicitud de Viáticos &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 2. Plantilla HTML oficial para Sistemas (sistemas@dimer.com.mx) y Finanzas tras Aprobación
 */
export function buildSystemsApprovedEmailHtml(params: {
  request: TravelRequest;
  user: User;
  approverName: string;
  approverEmail: string;
  approvedAt: string;
}) {
  const { request, user, approverName, approverEmail, approvedAt } = params;

  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || 'Operaciones';
  const requestType = request.requestType || 'Viáticos y Gastos de Viaje';
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'));
  const urgency = (request.urgency || 'media').toLowerCase();

  const urgencyBadgeStyle =
    urgency === 'alta'
      ? 'background: #fef2f2; color: #dc2626; border: 1px solid #f87171;'
      : urgency === 'baja'
      ? 'background: #f0fdf4; color: #16a34a; border: 1px solid #86efac;'
      : 'background: #fffbeb; color: #d97706; border: 1px solid #fcd34d;';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    .header { background: #064e3b; color: #ffffff; padding: 24px 32px; text-align: left; border-bottom: 3px solid #10b981; }
    .badge { display: inline-block; background: #10b981; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
    .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .content { padding: 28px 32px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 700; color: #64748b; width: 35%; text-transform: uppercase; font-size: 11px; }
    .info-table td.value { color: #0f172a; font-weight: 500; }
    .authorized-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
    .authorized-box .lbl { font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; }
    .authorized-box .val { font-size: 26px; font-weight: 900; color: #047857; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">SOLICITUD APROBADA - ${requestType}</span>
      <h1 class="title">SOLICITUD APROBADA - ${request.folio}</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #a7f3d0;">Notificación oficial a Sistemas & Finanzas</p>
    </div>
    <div class="content">
      <p style="font-size: 14px; margin-top: 0;">
        Se ha registrado la autorización formal de la siguiente solicitud:
      </p>

      <table class="info-table">
        <tr>
          <td class="label">Folio Oficial</td>
          <td class="value"><strong style="color: #059669; font-family: monospace;">${request.folio}</strong></td>
        </tr>
        <tr>
          <td class="label">Nombre del Solicitante</td>
          <td class="value"><strong>${requesterName}</strong> (${user.email})</td>
        </tr>
        <tr>
          <td class="label">Área o Departamento</td>
          <td class="value">${department}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud</td>
          <td class="value"><strong>${requestType}</strong></td>
        </tr>
        <tr>
          <td class="label">Fecha de la Solicitud</td>
          <td class="value">${requestDate}</td>
        </tr>
        <tr>
          <td class="label">Urgencia</td>
          <td class="value">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; ${urgencyBadgeStyle}">
              ${urgency.toUpperCase()}
            </span>
          </td>
        </tr>
        <tr>
          <td class="label">Jefe que Aprobó</td>
          <td class="value"><strong>${approverName}</strong> (${approverEmail})</td>
        </tr>
        <tr>
          <td class="label">Fecha y Hora de Aprobación</td>
          <td class="value">${new Date(approvedAt).toLocaleString('es-MX')}</td>
        </tr>
        <tr>
          <td class="label">Descripción / Detalle</td>
          <td class="value" style="white-space: pre-line;">${detail}</td>
        </tr>
        ${request.destination ? `
        <tr>
          <td class="label">Destino</td>
          <td class="value">${request.destination}</td>
        </tr>
        ` : ''}
        <tr>
          <td class="label">Monto Solicitado</td>
          <td class="value">${formatCurrency(request.amountRequested)} MXN</td>
        </tr>
        ${request.comments ? `
        <tr>
          <td class="label">Observaciones / Dictamen</td>
          <td class="value"><em>"${request.comments}"</em></td>
        </tr>
        ` : ''}
      </table>

      <div class="authorized-box">
        <div class="lbl">Monto Total Autorizado</div>
        <div class="val">${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</div>
      </div>
    </div>
    <div class="footer">
      Sistema de Gestión de Solicitudes &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 3. Plantilla HTML oficial para Código de Verificación de Cuenta Dimer
 */
export function buildVerificationEmailHtml(params: {
  name: string;
  email: string;
  code: string;
  expiresMinutes?: number;
}): string {
  const { name, email, code, expiresMinutes = 15 } = params;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Código de Verificación - Viáticos Dimer</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .header p { margin: 6px 0 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
    .body { padding: 32px 28px; text-align: center; }
    .greeting { font-size: 15px; color: #334155; margin-bottom: 20px; line-height: 1.5; text-align: left; }
    .code-box { background: #f8fafc; border: 2px dashed #6366f1; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .code-label { font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .code-digits { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.25em; color: #0f172a; margin: 0; }
    .validity { font-size: 12px; color: #64748b; margin-top: 8px; }
    .security-note { font-size: 12px; color: #64748b; background-color: #f8fafc; border-left: 3px solid #6366f1; padding: 12px 14px; text-align: left; border-radius: 4px; margin-top: 24px; }
    .footer { background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Viáticos Dimer</h1>
      <p>Verificación de Seguridad de Cuenta</p>
    </div>
    <div class="body">
      <div class="greeting">
        Hola <strong>${name}</strong>,<br>
        Has solicitado registrar tu cuenta con el correo <strong>${email}</strong> en el Sistema de Gestión de Viáticos Dimer. Usa el siguiente código para completar tu registro:
      </div>

      <div class="code-box">
        <div class="code-label">Tu Código de Verificación</div>
        <div class="code-digits">${code}</div>
        <div class="validity">Válido por <strong>${expiresMinutes} minutos</strong> (de un solo uso)</div>
      </div>

      <div class="security-note">
        <strong>Importante:</strong> Si tú no solicitaste este código, puedes ignorar este mensaje de forma segura. Nunca compartas este código con nadie.
      </div>
    </div>
    <div class="footer">
      Sistema de Gestión de Viáticos &copy; 2026 &bull; Dimer Corporativo &bull; Soporte: sistemas@dimer.com.mx
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 4. Envío de correo electrónico con registro en la bitácora Outbox
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  requestId?: string;
  folio?: string;
}): Promise<{ success: boolean; logId: string; status: 'ENVIADO' | 'SIMULADO' | 'FALLIDO'; error?: string }> {
  const { to, subject, html, from: customFrom, replyTo, requestId, folio } = params;
  const logId = `MAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  const host = process.env.SMTP_HOST?.trim() || process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '465', 10);
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER)?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
  const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '';
  const pass = rawPass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  const effectiveFrom = getFromAddress(customFrom);
  const effectiveReplyTo = replyTo || (process.env.SMTP_REPLY_TO?.trim()) || undefined;

  console.log(`[MAIL SERVICE INITIATION] Destinatario: ${to} | Asunto: "${subject}" | Host: ${host}:${port} | Usuario: ${user} | Password configurada: ${pass ? `SÍ (${pass.length} chars)` : 'NO'}`);

  if (!pass) {
    const errorMsg = `No se puede enviar correo real a ${to}: Falta configurar SMTP_PASS (o SMTP_PASSWORD) en las variables de entorno de Vercel.`;
    console.error(`[MAIL SERVICE ERROR] ${errorMsg}`);
    
    // In local dev without SMTP credentials, record simulation with warning
    const isProdOrVercel = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
    const log: EmailLog = {
      id: logId,
      requestId,
      folio,
      to,
      subject,
      html,
      status: isProdOrVercel ? 'FALLIDO' : 'SIMULADO',
      error: errorMsg,
      createdAt: new Date().toISOString(),
    };
    outboxLogs.unshift(log);
    return {
      success: !isProdOrVercel,
      logId,
      status: isProdOrVercel ? 'FALLIDO' : 'SIMULADO',
      error: errorMsg,
    };
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    const errorMsg = `No se pudo inicializar el transporte SMTP para ${user}@${host}.`;
    console.error(`[MAIL SERVICE ERROR] ${errorMsg}`);
    const log: EmailLog = {
      id: logId,
      requestId,
      folio,
      to,
      subject,
      html,
      status: 'FALLIDO',
      error: errorMsg,
      createdAt: new Date().toISOString(),
    };
    outboxLogs.unshift(log);
    return { success: false, logId, status: 'FALLIDO', error: errorMsg };
  }

  try {
    const info = await transporter.sendMail({
      from: effectiveFrom,
      replyTo: effectiveReplyTo,
      to,
      subject,
      html,
    });

    const log: EmailLog = {
      id: logId,
      requestId,
      folio,
      to,
      subject,
      html,
      status: 'ENVIADO',
      createdAt: new Date().toISOString(),
    };
    outboxLogs.unshift(log);
    console.log(`[MAIL SERVICE SUCCESS] Correo SMTP ENVIADO exitosamente desde "${effectiveFrom}" a ${to} (Folio: ${folio || 'N/A'}, MessageId: ${info.messageId || 'N/A'})`);
    return { success: true, logId, status: 'ENVIADO' };
  } catch (err: any) {
    console.error(`[MAIL SERVICE ERROR] Falla en envío SMTP a ${to}:`, {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
    });

    // Fallback: Try with alternative transport method (service: 'gmail') if host was smtp.gmail.com or failed
    try {
      console.warn(`[MAIL SERVICE] Intentando fallback con transporte directo 'gmail'...`);
      const fallbackTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });

      const fallbackInfo = await fallbackTransporter.sendMail({
        from: effectiveFrom,
        replyTo: effectiveReplyTo,
        to,
        subject,
        html,
      });

      const log: EmailLog = {
        id: logId,
        requestId,
        folio,
        to,
        subject,
        html,
        status: 'ENVIADO',
        createdAt: new Date().toISOString(),
      };
      outboxLogs.unshift(log);
      console.log(`[MAIL SERVICE SUCCESS] Correo SMTP ENVIADO exitosamente vía fallback Gmail desde "${effectiveFrom}" a ${to} (MessageId: ${fallbackInfo.messageId || 'N/A'})`);
      return { success: true, logId, status: 'ENVIADO' };
    } catch (fallbackErr: any) {
      console.error(`[MAIL SERVICE ERROR] El fallback de correo también falló:`, {
        message: fallbackErr.message,
        code: fallbackErr.code,
        response: fallbackErr.response,
      });
    }

    const detailError = `Error SMTP: ${err.message}${err.response ? ` (${err.response})` : ''}`;
    const log: EmailLog = {
      id: logId,
      requestId,
      folio,
      to,
      subject,
      html,
      status: 'FALLIDO',
      error: detailError,
      createdAt: new Date().toISOString(),
    };
    outboxLogs.unshift(log);
    return { success: false, logId, status: 'FALLIDO', error: detailError };
  }
}

/**
 * 4. Plantilla de correo para notificación al Administrador tras el registro de un nuevo usuario
 */
export function buildNewAccountAdminEmailHtml(params: {
  user: { name: string; email: string; department: string; role: string };
  registeredAt: string;
}) {
  const { user, registeredAt } = params;
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    .header { background: #1e1b4b; color: #ffffff; padding: 24px 32px; border-bottom: 3px solid #6366f1; }
    .badge { display: inline-block; background: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
    .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .content { padding: 28px 32px; }
    .alert-box { background: #eef2ff; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #3730a3; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 700; color: #64748b; width: 35%; text-transform: uppercase; font-size: 11px; }
    .info-table td.value { color: #0f172a; font-weight: 600; }
    .action-notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #92400e; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">NUEVO USUARIO REGISTRADO</span>
      <h1 class="title">Revisión y Asignación de Rol Requerida</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #c7d2fe;">Sistema de Viáticos Dimer &bull; Notificación a TI / Administración</p>
    </div>
    <div class="content">
      <div class="alert-box">
        Se ha registrado una nueva cuenta de colaborador en el sistema de viáticos Dimer y se encuentra en espera de revisión de roles.
      </div>

      <table class="info-table">
        <tr>
          <td class="label">Nombre del Colaborador</td>
          <td class="value">${user.name}</td>
        </tr>
        <tr>
          <td class="label">Correo Corporativo</td>
          <td class="value" style="color: #4f46e5;">${user.email}</td>
        </tr>
        <tr>
          <td class="label">Departamento</td>
          <td class="value">${user.department}</td>
        </tr>
        <tr>
          <td class="label">Rol Inicial</td>
          <td class="value"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace;">${user.role}</span></td>
        </tr>
        <tr>
          <td class="label">Fecha y Hora</td>
          <td class="value">${new Date(registeredAt).toLocaleString('es-MX')}</td>
        </tr>
      </table>

      <div class="action-notice">
        <strong>Acción requerida para el Administrador:</strong><br>
        Por favor ingresa al módulo de <strong>Administración (RBAC)</strong> en el sistema de viáticos para revisar esta cuenta y asignarle su rol oficial definitivo (Solicitante, Jefe Aprobador, Finanzas, etc.).
      </div>
    </div>
    <div class="footer">
      Sistema de Gestión de Viáticos &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 5. Página HTML independiente para respuesta directa 1-clic desde correo (sin requerir login previo)
 */
export function buildTokenApprovalResultPageHtml(params: {
  status: 'APROBADA' | 'RECHAZADA' | 'YA_PROCESADA' | 'INVALIDA' | 'CANCELADA';
  request?: TravelRequest;
  actionTaken?: string;
  errorMessage?: string;
  processedBy?: string;
  processedAt?: string;
}) {
  const { status, request, actionTaken, errorMessage, processedBy, processedAt } = params;

  const isSuccess = status === 'APROBADA';
  const isRejected = status === 'RECHAZADA';
  const isAlready = status === 'YA_PROCESADA';

  let title = 'Dictamen de Solicitud de Viáticos';
  let bannerColor = '#0f172a';
  let badgeColor = '#3b82f6';
  let mainHeading = 'Resultado del Dictamen';
  let message = '';

  if (isSuccess) {
    title = 'Solicitud Autorizada con Éxito';
    bannerColor = '#064e3b';
    badgeColor = '#10b981';
    mainHeading = '✓ Solicitud Autorizada con Éxito';
    message = 'La solicitud ha quedado formalmente AUTORIZADA en el sistema de viáticos Dimer. Se ha notificado a Finanzas y a Sistemas para la correspondiente dispersión de fondos y seguimiento.';
  } else if (isRejected) {
    title = 'Solicitud Rechazada';
    bannerColor = '#881337';
    badgeColor = '#f43f5e';
    mainHeading = '✕ Solicitud Rechazada';
    message = 'La solicitud ha sido registrada como RECHAZADA. El solicitante y las áreas correspondientes han sido informados del dictamen.';
  } else if (isAlready) {
    title = 'Solicitud Ya Procesada';
    bannerColor = '#1e293b';
    badgeColor = '#eab308';
    mainHeading = 'Esta Solicitud Ya Fue Procesada';
    message = `Esta solicitud ya fue atendida previamente (${request?.status}). No se requiere ninguna acción adicional.`;
  } else {
    title = 'Enlace No Válido';
    bannerColor = '#450a0a';
    badgeColor = '#ef4444';
    mainHeading = 'Enlace No Válido o Expirado';
    message = errorMessage || 'El enlace utilizado no es válido, ha expirado o el token de seguridad ya fue consumido.';
  }

  const formatCurrency = (val?: number | null) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Dimer</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .card {
      max-width: 600px;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      border: 1px solid #cbd5e1;
    }
    .header {
      background: ${bannerColor};
      color: #ffffff;
      padding: 28px 32px;
      text-align: left;
      border-bottom: 4px solid ${badgeColor};
    }
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #ffffff;
    }
    .logo-text span {
      color: #38bdf8;
    }
    .badge {
      display: inline-block;
      background: ${badgeColor};
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: monospace;
    }
    .title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
    }
    .subtitle {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
    .content {
      padding: 28px 32px;
    }
    .message-box {
      background: #f8fafc;
      border-left: 4px solid ${badgeColor};
      padding: 14px 18px;
      border-radius: 6px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    .info-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .info-table td.label {
      font-weight: 700;
      color: #64748b;
      width: 38%;
      text-transform: uppercase;
      font-size: 11px;
    }
    .info-table td.value {
      color: #0f172a;
      font-weight: 600;
    }
    .amount-highlight {
      background: ${isSuccess ? '#ecfdf5' : '#f8fafc'};
      border: 1px solid ${isSuccess ? '#a7f3d0' : '#e2e8f0'};
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin: 20px 0;
    }
    .amount-highlight .lbl {
      font-size: 11px;
      font-weight: 700;
      color: ${isSuccess ? '#065f46' : '#64748b'};
      text-transform: uppercase;
    }
    .amount-highlight .val {
      font-size: 26px;
      font-weight: 900;
      color: ${isSuccess ? '#047857' : '#0f172a'};
      margin-top: 4px;
    }
    .btn-container {
      margin-top: 24px;
      text-align: center;
    }
    .btn-close {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }
    .btn-close:hover {
      background: #334155;
    }
    .footer {
      background: #f8fafc;
      padding: 16px 32px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-row">
        <div class="logo-text">DIMER<span>.</span></div>
        <span class="badge">${status}</span>
      </div>
      <h1 class="title">${mainHeading}</h1>
      <p class="subtitle">${request ? `Folio Oficial: <strong>${request.folio}</strong>` : 'Sistema de Viáticos Dimer'}</p>
    </div>
    <div class="content">
      <div class="message-box">
        ${message}
      </div>

      ${request ? `
      <table class="info-table">
        <tr>
          <td class="label">Folio</td>
          <td class="value"><strong style="color: #2563eb; font-family: monospace;">${request.folio}</strong></td>
        </tr>
        <tr>
          <td class="label">Solicitante</td>
          <td class="value">${request.requesterName}</td>
        </tr>
        <tr>
          <td class="label">Departamento</td>
          <td class="value">${request.department}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud</td>
          <td class="value">${request.requestType}</td>
        </tr>
        ${request.destination ? `
        <tr>
          <td class="label">Destino</td>
          <td class="value">${request.destination}</td>
        </tr>
        ` : ''}
        <tr>
          <td class="label">Procesado Por</td>
          <td class="value"><strong>${processedBy || request.approvedBy || request.rejectedBy || request.bossEmail}</strong></td>
        </tr>
        <tr>
          <td class="label">Fecha y Hora</td>
          <td class="value">${new Date(processedAt || Date.now()).toLocaleString('es-MX')}</td>
        </tr>
      </table>

      <div class="amount-highlight">
        <div class="lbl">${isSuccess ? 'Monto Total Autorizado' : 'Monto de la Solicitud'}</div>
        <div class="val">${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</div>
      </div>
      ` : ''}

      <div class="btn-container">
        <button onclick="window.close()" class="btn-close">
          Cerrar esta ventana
        </button>
      </div>
    </div>
    <div class="footer">
      Sistema de Gestión de Viáticos &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}
