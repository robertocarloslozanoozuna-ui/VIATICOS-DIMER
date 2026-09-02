import nodemailer from 'nodemailer';
import type { TravelRequest, User, EmailLog } from '../src/types';
import { recordAuditLog } from './db.js';

export const outboxLogs: EmailLog[] = [];

/**
 * SMTP configuration is intentionally canonical and deterministic.
 * Only SMTP_* variables are used by production mail delivery.
 * This prevents stale fallback variables from silently overriding the
 * credentials configured in Vercel / AI Studio.
 */
export function credentials(){
  const host=(process.env.SMTP_HOST||process.env.EMAIL_HOST||'smtp.gmail.com').trim();
  const port=parseInt(process.env.SMTP_PORT||process.env.EMAIL_PORT||'465',10);
  const user=(process.env.DIMER_SMTP_USER||process.env.SMTP_USER||process.env.GMAIL_USER||process.env.EMAIL_USER||'sistemas@dimer.com.mx').trim().replace(/^["']|["']$/g,'');
  const pass=(process.env.DIMER_SMTP_APP_PASSWORD||process.env.SMTP_PASS||process.env.SMTP_PASSWORD||process.env.GMAIL_APP_PASSWORD||process.env.EMAIL_PASS||'').trim().replace(/^["']|["']$/g,'').replace(/\s+/g,'');
  const secure=(process.env.SMTP_SECURE||'').trim().toLowerCase()==='true'||port===465;
  return {host,port,user,pass,secure};
}

export function getMailTransporter(){
  const c=credentials();
  if(!c.user||!c.pass)return null;
  return nodemailer.createTransport({
    host:c.host,
    port:c.port,
    secure:c.secure,
    auth:{user:c.user,pass:c.pass},
    tls:{rejectUnauthorized:false},
    connectionTimeout:15000,
    greetingTimeout:15000,
    socketTimeout:20000,
  });
}

export function getFromAddress(customFrom?:string){
  const c=credentials();
  const rawFrom=customFrom?.trim()||process.env.SMTP_FROM?.trim()||'Dimer Notificaciones';
  let displayName='Dimer Notificaciones';
  let fromEmail=c.user||'sistemas@dimer.com.mx';

  // SMTP_FROM can now be either:
  //   - NO_REPLY@dimer.com.mx
  //   - "Dimer Notificaciones" <NO_REPLY@dimer.com.mx>
  // In both cases the address is used as the actual RFC From address,
  // while SMTP authentication remains systems@dimer.com.mx.
  const bracketMatch=rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if(bracketMatch){
    const candidateEmail=bracketMatch[2]?.trim();
    if(candidateEmail?.includes('@')) fromEmail=candidateEmail;
    if(bracketMatch[1]?.trim()){
      displayName=bracketMatch[1].trim().replace(/^["']|["']$/g,'');
    }
  } else if(rawFrom.includes('@')){
    fromEmail=rawFrom.replace(/^["']|["']$/g,'').trim();
    const localPart=fromEmail.split('@')[0]?.trim();
    if(localPart) displayName=localPart;
  } else {
    displayName=rawFrom.replace(/^["']|["']$/g,'');
  }

  return `"${displayName}" <${fromEmail}>`;
}

const esc=(v:unknown)=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]!));
const formatCurrency=(amount:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(amount||0));

export function buildBossApprovalEmailHtml(params:{request:TravelRequest;user:User;approveUrl:string;rejectUrl:string;token:string}){
  const {request,user,approveUrl,rejectUrl,token}=params;
  const requesterName=request.requesterName||user.name;
  const department=request.department||user.department||'Operaciones';
  const requestType=request.requestType||'Viáticos y Gastos de Viaje';
  const detail=request.detail||request.reason;
  const requestDate=request.requestDate||(request.createdAt?new Date(request.createdAt).toLocaleDateString('es-MX'):new Date().toLocaleDateString('es-MX'));
  const depositDate=request.depositDate?new Date(request.depositDate+'T00:00:00').toLocaleDateString('es-MX'):'';
  const urgency=(request.urgency||'media').toLowerCase();
  const urgencyBadgeStyle=urgency==='alta'?'background:#fef2f2;color:#dc2626;border:1px solid #f87171;':urgency==='baja'?'background:#f0fdf4;color:#16a34a;border:1px solid #86efac;':'background:#fffbeb;color:#d97706;border:1px solid #fcd34d;';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.btn{display:inline-block;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px;font-size:14px;margin:4px}.approve{background:#059669}.reject{background:#dc2626}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD POR AUTORIZAR - ${esc(requestType)}</div><h1>Revisión y Dictamen del Supervisor</h1><p>Folio Oficial: <strong>${esc(request.folio)}</strong></p></div><div class="content"><p>Estimado/a Líder, <strong>${esc(requesterName)}</strong> (${esc(user.email)}) ha generado una solicitud para su autorización formal.</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr>${depositDate?`<tr><td class="label">Fecha requerida de depósito</td><td class="value"><strong>${esc(depositDate)}</strong></td></tr>`:``}<tr><td class="label">Urgencia</td><td class="value"><span style="${urgencyBadgeStyle}">${esc(urgency.toUpperCase())}</span></td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination?`<tr><td class="label">Destino</td><td class="value"><strong>${esc(request.destination)}</strong></td></tr>`:''}${request.startDate&&request.endDate?`<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString('es-MX')} al ${new Date(request.endDate).toLocaleDateString('es-MX')}</td></tr>`:''}${request.comments?`<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>`:''}</table><div class="amount"><div>Monto Total Solicitado</div><strong style="font-size:24px;color:#047857">${formatCurrency(request.amountRequested)} MXN</strong></div><div style="text-align:center"><a href="${approveUrl}" class="btn approve">✓ APROBAR SOLICITUD</a><a href="${rejectUrl}" class="btn reject">✕ RECHAZAR SOLICITUD</a></div><p style="font-size:11px;color:#64748b">Token de un solo uso: ${esc(token)}</p></div><div class="footer">Solicitud de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildSystemsApprovedEmailHtml(params:{request:TravelRequest;user:User;approverName:string;approverEmail:string;approvedAt:string}){
  const {request,user,approverName,approverEmail,approvedAt}=params;
  const requesterName=request.requesterName||user.name;
  const department=request.department||user.department||'Operaciones';
  const requestType=request.requestType||'Viáticos y Gastos de Viaje';
  const detail=request.detail||request.reason;
  const requestDate=request.requestDate||(request.createdAt?new Date(request.createdAt).toLocaleDateString('es-MX'):new Date().toLocaleDateString('es-MX'));
  const depositDate=request.depositDate?new Date(request.depositDate+'T00:00:00').toLocaleDateString('es-MX'):'';
  const urgency=(request.urgency||'media').toLowerCase();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#064e3b;color:#fff;padding:24px 32px;border-bottom:3px solid #10b981}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.authorized{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;text-align:center;margin:20px 0}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD APROBADA - ${esc(requestType)}</div><h1>SOLICITUD APROBADA - ${esc(request.folio)}</h1><p>Notificación oficial a Sistemas, Finanzas y Solicitante</p></div><div class="content"><p>Se ha registrado la autorización formal de la siguiente solicitud:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr>${depositDate?`<tr><td class="label">Fecha requerida de depósito</td><td class="value"><strong>${esc(depositDate)}</strong></td></tr>`:``}<tr><td class="label">Urgencia</td><td class="value">${esc(urgency.toUpperCase())}</td></tr><tr><td class="label">Supervisor que Aprobó</td><td class="value"><strong>${esc(approverName)}</strong> (${esc(approverEmail)})</td></tr><tr><td class="label">Fecha/Hora Aprobación</td><td class="value">${esc(new Date(approvedAt).toLocaleString('es-MX'))}</td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination?`<tr><td class="label">Destino</td><td class="value">${esc(request.destination)}</td></tr>`:''}<tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr>${request.comments?`<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>`:''}</table><div class="authorized"><div>Monto Total Autorizado</div><strong style="font-size:26px;color:#047857">${formatCurrency(request.amountAuthorized||request.amountRequested)} MXN</strong></div></div><div class="footer">Sistema de Gestión de Solicitudes © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildRequesterConfirmationEmailHtml(params:{request:TravelRequest;user:User;bossName:string;bossEmail:string}){
  const {request,user,bossName,bossEmail}=params;
  const requesterName=request.requesterName||user.name;
  const department=request.department||user.department||'Operaciones';
  const requestType=request.requestType||'Viáticos y Gastos de Viaje';
  const detail=request.detail||request.reason;
  const requestDate=request.requestDate||(request.createdAt?new Date(request.createdAt).toLocaleDateString('es-MX'):new Date().toLocaleDateString('es-MX'));
  const depositDate=request.depositDate?new Date(request.depositDate+'T00:00:00').toLocaleDateString('es-MX'):'';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.status-banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:16px 0;color:#1e40af;font-size:13px}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD REGISTRADA - ${esc(requestType)}</div><h1>Confirmación de Solicitud de Viáticos</h1><p>Folio Oficial: <strong>${esc(request.folio)}</strong></p></div><div class="content"><p>Hola <strong>${esc(requesterName)}</strong>, tu solicitud ha sido registrada en el sistema y enviada para dictamen de tu supervisor/a.</p><div class="status-banner"><strong>Estatus actual:</strong> Pendiente de Autorización<br><strong>Aprobador asignado:</strong> ${esc(bossName)} (${esc(bossEmail)})</div><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr>${depositDate?`<tr><td class="label">Fecha requerida de depósito</td><td class="value"><strong>${esc(depositDate)}</strong></td></tr>`:``}<tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination?`<tr><td class="label">Destino</td><td class="value"><strong>${esc(request.destination)}</strong></td></tr>`:''}${request.startDate&&request.endDate?`<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString('es-MX')} al ${new Date(request.endDate).toLocaleDateString('es-MX')}</td></tr>`:''}</table><div class="amount"><div>Monto Solicitado</div><strong style="font-size:24px;color:#0f172a">${formatCurrency(request.amountRequested)} MXN</strong></div><p style="font-size:12px;color:#64748b">Recibirás una notificación por este medio en cuanto tu solicitud sea dictaminada.</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildRejectionEmailHtml(params:{request:TravelRequest;user:User;rejectorName:string;rejectorEmail:string;reason:string}){
  const {request,user,rejectorName,rejectorEmail,reason}=params;
  const requesterName=request.requesterName||user.name;
  const department=request.department||user.department||'Operaciones';
  const requestType=request.requestType||'Viáticos y Gastos de Viaje';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#991b1b;color:#fff;padding:24px 32px;border-bottom:3px solid #dc2626}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.reason-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;color:#991b1b}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD NO AUTORIZADA - ${esc(requestType)}</div><h1>SOLICITUD RECHAZADA - ${esc(request.folio)}</h1><p>Notificación oficial de dictamen</p></div><div class="content"><p>Estimado/a <strong>${esc(requesterName)}</strong>, te informamos que la siguiente solicitud de viáticos no fue autorizada:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Dictaminado por</td><td class="value"><strong>${esc(rejectorName)}</strong> (${esc(rejectorEmail)})</td></tr><tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr></table><div class="reason-box"><strong>Motivo del rechazo / observaciones:</strong><div style="margin-top:6px;font-size:14px">${esc(reason||'No se especificó motivo')}</div></div><p style="font-size:12px;color:#64748b">Si tienes dudas sobre este dictamen, contacta directamente a tu líder o al departamento correspondiente.</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildVerificationEmailHtml(p:{name:string;email:string;code:string;expiresMinutes?:number}){
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Código de Verificación - Viáticos Dimer</title><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:28px 24px;text-align:center}.body{padding:32px 28px;text-align:center}.code-box{background:#f8fafc;border:2px dashed #6366f1;border-radius:12px;padding:24px;margin:24px 0}.code-digits{font-family:monospace;font-size:36px;font-weight:900;letter-spacing:.25em;color:#0f172a}.footer{background:#f8fafc;padding:18px 24px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Viáticos Dimer</h1><p>Verificación de Seguridad de Cuenta</p></div><div class="body"><p>Hola <strong>${esc(p.name)}</strong>,</p><p>Has solicitado registrar tu cuenta con el correo <strong>${esc(p.email)}</strong>.</p><div class="code-box"><div>Tu Código de Verificación</div><div class="code-digits">${esc(p.code)}</div><div>Válido por <strong>${p.expiresMinutes||15} minutos</strong></div></div><p style="font-size:12px;color:#64748b">Si tú no solicitaste este código, ignora este mensaje.</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildNewAccountAdminEmailHtml(p:{user:{name:string;email:string;department:string;role:string};registeredAt:string}){
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:24px;text-align:center}.body{padding:28px}.footer{background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Nueva cuenta registrada</h1></div><div class="body"><p><strong>${esc(p.user.name)}</strong> registró ${esc(p.user.email)}.</p><p>Departamento: ${esc(p.user.department)}<br>Rol inicial: ${esc(p.user.role)}<br>Fecha: ${esc(p.registeredAt)}</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildTokenApprovalDecisionPageHtml(p:{
  request:TravelRequest;
  user:User;
  token:string;
  initialAction:'approve'|'reject';
  approverEmail:string;
  approverName?:string;
  errorMessage?:string;
}){
  const r=p.request;
  const isApprove=p.initialAction==='approve';
  const detail=r.detail||r.reason;
  const requesterName=r.requesterName||p.user.name||'Colaborador';
  const requesterEmail=p.user.email||(r as any).requesterEmail||'';
  const department=r.department||p.user.department||'General';
  const requestType=r.requestType||'Viáticos y Gastos de Viaje';
  const requestDate=r.requestDate||(r.createdAt?new Date(r.createdAt).toLocaleDateString('es-MX'):new Date().toLocaleDateString('es-MX'));
  const urgency=(r.urgency||'media').toLowerCase();
  const urgencyBadgeStyle=urgency==='alta'?'background:#fef2f2;color:#dc2626;border:1px solid #f87171;':urgency==='baja'?'background:#f0fdf4;color:#16a34a;border:1px solid #86efac;':'background:#fffbeb;color:#d97706;border:1px solid #fcd34d;';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dictamen de Solicitud ${esc(r.folio)} - Dimer</title>
  <style>
    *, *:before, *:after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px 12px; color: #0f172a; line-height: 1.5; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.08), 0 2px 6px -1px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 28px; border-bottom: 4px solid #2563eb; }
    .brand-badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; margin-bottom: 8px; }
    .header h1 { font-size: 22px; margin: 4px 0; font-weight: 800; color: #ffffff; }
    .header p { margin: 2px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px; }
    .error-alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px 18px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; }
    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
    .info-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #edf2f7; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 600; width: 38%; }
    .info-val { color: #0f172a; font-weight: 600; width: 62%; text-align: right; word-break: break-word; }
    .breakdown-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin-top: 14px; }
    .breakdown-row { display: flex; justify-content: space-between; font-size: 12px; color: #1e40af; padding: 3px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #1e3a8a; border-top: 1px dashed #93c5fd; padding-top: 8px; margin-top: 6px; }
    
    .tab-buttons { display: flex; gap: 8px; margin-bottom: 20px; }
    .tab-btn { flex: 1; padding: 14px; border: 2px solid #e2e8f0; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; text-align: center; background: #f8fafc; color: #64748b; transition: all 0.2s; }
    .tab-btn.active-approve { background: #ecfdf5; border-color: #059669; color: #065f46; box-shadow: 0 0 0 1px #059669; }
    .tab-btn.active-reject { background: #fef2f2; border-color: #dc2626; color: #991b1b; box-shadow: 0 0 0 1px #dc2626; }
    
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .form-control { width: 100%; padding: 12px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; background: #fff; color: #0f172a; transition: border 0.2s; }
    .form-control:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
    textarea.form-control { min-height: 95px; resize: vertical; }
    
    .submit-btn { width: 100%; padding: 15px 20px; font-size: 16px; font-weight: 800; color: #ffffff; border: none; border-radius: 10px; cursor: pointer; transition: background 0.2s, transform 0.1s; }
    .submit-btn:active { transform: scale(0.99); }
    .btn-approve { background: #059669; }
    .btn-approve:hover { background: #047857; }
    .btn-reject { background: #dc2626; }
    .btn-reject:hover { background: #b91c1c; }

    .warning-box { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 14px; border-radius: 10px; font-size: 13px; margin-bottom: 18px; }
    .footer { background: #f8fafc; padding: 18px 28px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-badge">Dimer • Autorizaciones</div>
      <h1>Dictamen de Solicitud de Viáticos</h1>
      <p>Folio Oficial: <strong style="color:#ffffff">${esc(r.folio)}</strong></p>
    </div>
    
    <div class="content">
      ${p.errorMessage ? `<div class="error-alert"><strong>Atención:</strong> ${esc(p.errorMessage)}</div>` : ''}

      <div class="section-title">Resumen de la Solicitud</div>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Folio</span>
          <span class="info-val" style="font-size:14px;color:#2563eb;"><strong>${esc(r.folio)}</strong></span>
        </div>
        <div class="info-row">
          <span class="info-label">Solicitante</span>
          <span class="info-val">${esc(requesterName)}${requesterEmail ? ` <span style="font-weight:400;color:#64748b">(${esc(requesterEmail)})</span>` : ''}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Departamento</span>
          <span class="info-val">${esc(department)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tipo</span>
          <span class="info-val">${esc(requestType)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha Solicitud</span>
          <span class="info-val">${esc(requestDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Urgencia</span>
          <span class="info-val"><span style="padding:2px 8px;border-radius:4px;font-size:11px;${urgencyBadgeStyle}">${esc(urgency.toUpperCase())}</span></span>
        </div>
        ${r.destination ? `
        <div class="info-row">
          <span class="info-label">Destino</span>
          <span class="info-val">${esc(r.destination)}</span>
        </div>` : ''}
        ${r.startDate && r.endDate ? `
        <div class="info-row">
          <span class="info-label">Periodo</span>
          <span class="info-val">${new Date(r.startDate).toLocaleDateString('es-MX')} al ${new Date(r.endDate).toLocaleDateString('es-MX')}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">Motivo / Detalle</span>
          <span class="info-val">${esc(detail)}</span>
        </div>

        <div class="breakdown-box">
          ${r.transportCost ? `<div class="breakdown-row"><span>Transporte / Combustible:</span><span>${formatCurrency(r.transportCost)} MXN</span></div>` : ''}
          ${r.hotelCost ? `<div class="breakdown-row"><span>Hospedaje:</span><span>${formatCurrency(r.hotelCost)} MXN</span></div>` : ''}
          ${r.foodCost ? `<div class="breakdown-row"><span>Alimentos:</span><span>${formatCurrency(r.foodCost)} MXN</span></div>` : ''}
          ${r.miscCost ? `<div class="breakdown-row"><span>Varios / Casetas:</span><span>${formatCurrency(r.miscCost)} MXN</span></div>` : ''}
          <div class="total-row">
            <span>Monto Total Solicitado:</span>
            <span>${formatCurrency(r.amountRequested)} MXN</span>
          </div>
        </div>
      </div>

      <div class="section-title">Selecciona tu Dictamen</div>
      
      <div class="tab-buttons">
        <div id="btnTabApprove" class="tab-btn ${isApprove ? 'active-approve' : ''}" onclick="selectDecision('approve')">
          ✓ Aprobar Solicitud
        </div>
        <div id="btnTabReject" class="tab-btn ${!isApprove ? 'active-reject' : ''}" onclick="selectDecision('reject')">
          ✕ Rechazar Solicitud
        </div>
      </div>

      <!-- FORMULARIO DE APROBACIÓN -->
      <form id="formApprove" method="POST" action="/api/approval/submit-decision" style="${isApprove ? 'display:block;' : 'display:none;'}">
        <input type="hidden" name="token" value="${esc(p.token)}">
        <input type="hidden" name="decision" value="APROBADA">

        <div class="form-group">
          <label class="form-label" for="amountAuthorized">Monto a Autorizar (MXN) *</label>
          <input type="number" step="0.01" min="0" id="amountAuthorized" name="amountAuthorized" class="form-control" value="${esc(r.amountAuthorized || r.amountRequested)}" required>
          <span style="font-size:11px;color:#64748b;margin-top:3px;display:block">Puedes ajustar el monto final autorizado si corresponde.</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="approveComments">Observaciones de Autorización (Opcional)</label>
          <textarea id="approveComments" name="comments" class="form-control" placeholder="Instrucciones o notas adicionales para Finanzas y el solicitante...">${esc(r.comments || '')}</textarea>
        </div>

        <button type="submit" class="submit-btn btn-approve">
          ✓ Confirmar y Autorizar Solicitud
        </button>
      </form>

      <!-- FORMULARIO DE RECHAZO -->
      <form id="formReject" method="POST" action="/api/approval/submit-decision" style="${!isApprove ? 'display:block;' : 'display:none;'}">
        <input type="hidden" name="token" value="${esc(p.token)}">
        <input type="hidden" name="decision" value="RECHAZADA">

        <div class="warning-box">
          <strong>Confirmación requerida:</strong> Estás a punto de no autorizar esta solicitud. Se enviará una notificación por correo al colaborador y a Sistemas con el motivo detallado.
        </div>

        <div class="form-group">
          <label class="form-label" for="rejectReason">Motivo del Rechazo (Obligatorio) *</label>
          <textarea id="rejectReason" name="comments" class="form-control" placeholder="Escribe aquí de forma clara y detallada el motivo por el cual no se autoriza esta solicitud..." required minlength="3"></textarea>
        </div>

        <button type="submit" class="submit-btn btn-reject">
          ✕ Confirmar Rechazo de Solicitud
        </button>
      </form>
    </div>

    <div class="footer">
      Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo
    </div>
  </div>

  <script>
    function selectDecision(type) {
      var tabApprove = document.getElementById('btnTabApprove');
      var tabReject = document.getElementById('btnTabReject');
      var formApprove = document.getElementById('formApprove');
      var formReject = document.getElementById('formReject');
      var rejectReason = document.getElementById('rejectReason');

      if (type === 'approve') {
        tabApprove.className = 'tab-btn active-approve';
        tabReject.className = 'tab-btn';
        formApprove.style.display = 'block';
        formReject.style.display = 'none';
        if (rejectReason) rejectReason.removeAttribute('required');
      } else {
        tabApprove.className = 'tab-btn';
        tabReject.className = 'tab-btn active-reject';
        formApprove.style.display = 'none';
        formReject.style.display = 'block';
        if (rejectReason) rejectReason.setAttribute('required', 'required');
      }
    }
  </script>
</body>
</html>`;
}

export function buildTokenApprovalResultPageHtml(p:{status:string;request?:TravelRequest;actionTaken?:string;errorMessage?:string;processedBy?:string;processedAt?:string}){
  const r=p.request;
  const isApproved=p.status==='APROBADA';
  const isRejected=p.status==='RECHAZADA';
  const isInvalid=p.status==='INVALIDA'||!p.status;
  
  const headerBg=isApproved?'#059669':isRejected?'#dc2626':'#0f172a';
  const title=isApproved?'¡Solicitud Autorizada Exitosamente!':isRejected?'Solicitud No Autorizada / Rechazada':p.errorMessage||'Dictamen de Solicitud';
  
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} - Dimer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; padding: 24px 12px; margin: 0; color: #0f172a; }
    .card { max-width: 620px; margin: 20px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .head { background: ${headerBg}; color: #fff; padding: 28px 32px; text-align: center; }
    .head h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .head p { margin: 6px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85); }
    .body { padding: 28px 32px; }
    .status-badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 13px; margin-bottom: 16px; ${isApproved?'background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;':isRejected?'background:#fef2f2;color:#991b1b;border:1px solid #fecaca;':'background:#eff6ff;color:#1e40af;'} }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .label { font-weight: 700; color: #64748b; width: 35%; }
    .value { color: #0f172a; font-weight: 600; }
    .note-box { background: ${isApproved?'#ecfdf5':'#fef2f2'}; border: 1px solid ${isApproved?'#a7f3d0':'#fecaca'}; color: ${isApproved?'#065f46':'#991b1b'}; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; }
    .foot { padding: 16px; background: #f8fafc; color: #94a3b8; font-size: 11px; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>${esc(title)}</h1>
      <p>Sistema de Gestión de Viáticos • Dimer Corporativo</p>
    </div>
    <div class="body">
      ${isInvalid ? `
        <div class="note-box" style="background:#fffbeb;border-color:#fde68a;color:#92400e">
          <strong>Aviso:</strong> ${esc(p.errorMessage || 'El enlace no es válido o la solicitud ya fue dictaminada con anterioridad.')}
        </div>
      ` : ''}

      ${r ? `
        <div style="text-align:center;">
          <div class="status-badge">${esc(p.status)}</div>
        </div>
        <table class="table">
          <tr><td class="label">Folio Oficial</td><td class="value"><strong>${esc(r.folio)}</strong></td></tr>
          <tr><td class="label">Solicitante</td><td class="value">${esc(r.requesterName)}</td></tr>
          <tr><td class="label">Departamento</td><td class="value">${esc(r.department)}</td></tr>
          <tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(r.amountRequested)} MXN</td></tr>
          ${isApproved ? `<tr><td class="label">Monto Autorizado</td><td class="value"><strong style="color:#059669;font-size:16px">${formatCurrency(r.amountAuthorized || r.amountRequested)} MXN</strong></td></tr>` : ''}
          <tr><td class="label">Dictaminado por</td><td class="value">${esc(p.processedBy || r.bossEmail)}</td></tr>
          <tr><td class="label">Fecha y Hora</td><td class="value">${esc(new Date(p.processedAt || Date.now()).toLocaleString('es-MX'))}</td></tr>
          ${r.comments ? `<tr><td class="label">${isRejected ? 'Motivo de Rechazo' : 'Observaciones'}</td><td class="value">${esc(r.comments)}</td></tr>` : ''}
        </table>
        
        <div class="note-box">
          ${isApproved 
            ? '✓ Se ha notificado formalmente al colaborador y la orden fue enviada al área de Finanzas y Sistemas.' 
            : '✓ Se ha registrado el rechazo formal y se notificó al colaborador con el motivo ingresado.'}
        </div>
      ` : ''}
    </div>
    <div class="foot">
      Sistema de Viáticos Dimer © 2026 • Dimer Corporativo
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(p:{to:string;subject:string;html:string;from?:string;replyTo?:string;requestId?:string;folio?:string}):Promise<{success:boolean;logId:string;status:'ENVIADO'|'SIMULADO'|'FALLIDO';error?:string}>{
  const logId=`MAIL-${Date.now()}-${Math.floor(Math.random()*100000)}`;
  const timestamp=new Date().toISOString();
  const transporter=getMailTransporter();
  let status:'ENVIADO'|'SIMULADO'|'FALLIDO'='ENVIADO';
  let errorMsg:string|undefined;

  if(!transporter){
    errorMsg='Faltan credenciales SMTP: se requieren SMTP_USER y SMTP_PASS';
    status=process.env.VERCEL||process.env.NODE_ENV==='production'?'FALLIDO':'SIMULADO';
  } else {
    try{
      const c=credentials();
      const rawUserVar=process.env.DIMER_SMTP_USER?'DIMER_SMTP_USER':process.env.SMTP_USER?'SMTP_USER':process.env.GMAIL_USER?'GMAIL_USER':'DEFAULT';
      const rawPass=process.env.DIMER_SMTP_APP_PASSWORD||process.env.SMTP_PASS||process.env.SMTP_PASSWORD||'';
      const hasLeadingTrailingWhitespace=rawPass!==rawPass.trim();
      const fromFormatted=getFromAddress(p.from);

      console.log(`[SMTP-DEBUG] Enviando correo a ${p.to} usando variable_usuario=${rawUserVar} (${c.user}), pass_length=${c.pass.length}, pass_prefix="${c.pass.slice(0, 2)}***", pass_has_spaces_at_edges=${hasLeadingTrailingWhitespace}, from="${fromFormatted}"`);

      const sendResult=await transporter.sendMail({
        from:fromFormatted,
        replyTo:p.replyTo,
        to:p.to,
        subject:p.subject,
        html:p.html
      });
      status='ENVIADO';
      console.log(`[SMTP-DEBUG] Correo enviado exitosamente a ${p.to} (${logId}): ${sendResult.response||sendResult.messageId}`);
    }catch(e:any){
      status='FALLIDO';
      errorMsg=e?.message||'Error SMTP';
      console.error(`[SMTP-DEBUG-ERROR] Falló envío a ${p.to}: message="${e?.message}", code="${e?.code}", response="${e?.response}", responseCode="${e?.responseCode}"`);
    }
  }

  const log:EmailLog={
    id:logId,
    requestId:p.requestId,
    folio:p.folio,
    to:p.to,
    subject:p.subject,
    html:p.html,
    status,
    error:errorMsg,
    createdAt:timestamp
  };

  outboxLogs.unshift(log);
  if(outboxLogs.length>200)outboxLogs.pop();

  try{
    const isTest=p.subject.includes('[PRUEBA]');
    await recordAuditLog({
      requestId:p.requestId||null,
      userId:null,
      action:isTest?'PRUEBA_SMTP':'ENVIO_CORREO_SMTP',
      details:{
        logId,
        to:p.to,
        subject:p.subject,
        html:p.html,
        status,
        error:errorMsg||null,
        requestId:p.requestId||null,
        folio:p.folio||null,
        userEmail:p.to,
        userName:isTest?'Prueba Diagnóstico SMTP':'Sistema de Notificaciones',
        timestamp
      }
    });
  }catch(auditErr){
    console.error('[SMTP-OUTBOX-PERSISTENCE-WARNING] No se pudo registrar correo en audit_logs:',auditErr);
  }

  return {success:status==='ENVIADO'||status==='SIMULADO',logId,status,error:errorMsg};
}