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
  if(rawFrom.includes('<') && rawFrom.includes('>')){
    const match=rawFrom.match(/^(.*?)\s*<.*?>$/);
    if(match && match[1]?.trim()){
      displayName=match[1].trim().replace(/^["']|["']$/g,'');
    }
  } else if(!rawFrom.includes('@')){
    displayName=rawFrom.replace(/^["']|["']$/g,'');
  }
  const authEmail=c.user||'sistemas@dimer.com.mx';
  return `"${displayName}" <${authEmail}>`;
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
  const urgency=(request.urgency||'media').toLowerCase();
  const urgencyBadgeStyle=urgency==='alta'?'background:#fef2f2;color:#dc2626;border:1px solid #f87171;':urgency==='baja'?'background:#f0fdf4;color:#16a34a;border:1px solid #86efac;':'background:#fffbeb;color:#d97706;border:1px solid #fcd34d;';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.btn{display:inline-block;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px;font-size:14px;margin:4px}.approve{background:#059669}.reject{background:#dc2626}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD POR AUTORIZAR - ${esc(requestType)}</div><h1>Revisión y Dictamen de Jefatura</h1><p>Folio Oficial: <strong>${esc(request.folio)}</strong></p></div><div class="content"><p>Estimado/a Líder, <strong>${esc(requesterName)}</strong> (${esc(user.email)}) ha generado una solicitud para su autorización formal.</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr><tr><td class="label">Urgencia</td><td class="value"><span style="${urgencyBadgeStyle}">${esc(urgency.toUpperCase())}</span></td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination?`<tr><td class="label">Destino</td><td class="value"><strong>${esc(request.destination)}</strong></td></tr>`:''}${request.startDate&&request.endDate?`<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString('es-MX')} al ${new Date(request.endDate).toLocaleDateString('es-MX')}</td></tr>`:''}${request.comments?`<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>`:''}</table><div class="amount"><div>Monto Total Solicitado</div><strong style="font-size:24px;color:#047857">${formatCurrency(request.amountRequested)} MXN</strong></div><div style="text-align:center"><a href="${approveUrl}" class="btn approve">✓ APROBAR SOLICITUD</a><a href="${rejectUrl}" class="btn reject">✕ RECHAZAR SOLICITUD</a></div><p style="font-size:11px;color:#64748b">Token de un solo uso: ${esc(token)}</p></div><div class="footer">Solicitud de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildSystemsApprovedEmailHtml(params:{request:TravelRequest;user:User;approverName:string;approverEmail:string;approvedAt:string}){
  const {request,user,approverName,approverEmail,approvedAt}=params;
  const requesterName=request.requesterName||user.name;
  const department=request.department||user.department||'Operaciones';
  const requestType=request.requestType||'Viáticos y Gastos de Viaje';
  const detail=request.detail||request.reason;
  const requestDate=request.requestDate||(request.createdAt?new Date(request.createdAt).toLocaleDateString('es-MX'):new Date().toLocaleDateString('es-MX'));
  const urgency=(request.urgency||'media').toLowerCase();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#064e3b;color:#fff;padding:24px 32px;border-bottom:3px solid #10b981}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.authorized{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;text-align:center;margin:20px 0}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD APROBADA - ${esc(requestType)}</div><h1>SOLICITUD APROBADA - ${esc(request.folio)}</h1><p>Notificación oficial a Sistemas, Finanzas y Solicitante</p></div><div class="content"><p>Se ha registrado la autorización formal de la siguiente solicitud:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr><tr><td class="label">Urgencia</td><td class="value">${esc(urgency.toUpperCase())}</td></tr><tr><td class="label">Jefe que Aprobó</td><td class="value"><strong>${esc(approverName)}</strong> (${esc(approverEmail)})</td></tr><tr><td class="label">Fecha/Hora Aprobación</td><td class="value">${esc(new Date(approvedAt).toLocaleString('es-MX'))}</td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination?`<tr><td class="label">Destino</td><td class="value">${esc(request.destination)}</td></tr>`:''}<tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr>${request.comments?`<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>`:''}</table><div class="authorized"><div>Monto Total Autorizado</div><strong style="font-size:26px;color:#047857">${formatCurrency(request.amountAuthorized||request.amountRequested)} MXN</strong></div></div><div class="footer">Sistema de Gestión de Solicitudes © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildVerificationEmailHtml(p:{name:string;email:string;code:string;expiresMinutes?:number}){
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Código de Verificación - Viáticos Dimer</title><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:28px 24px;text-align:center}.body{padding:32px 28px;text-align:center}.code-box{background:#f8fafc;border:2px dashed #6366f1;border-radius:12px;padding:24px;margin:24px 0}.code-digits{font-family:monospace;font-size:36px;font-weight:900;letter-spacing:.25em;color:#0f172a}.footer{background:#f8fafc;padding:18px 24px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Viáticos Dimer</h1><p>Verificación de Seguridad de Cuenta</p></div><div class="body"><p>Hola <strong>${esc(p.name)}</strong>,</p><p>Has solicitado registrar tu cuenta con el correo <strong>${esc(p.email)}</strong>.</p><div class="code-box"><div>Tu Código de Verificación</div><div class="code-digits">${esc(p.code)}</div><div>Válido por <strong>${p.expiresMinutes||15} minutos</strong></div></div><p style="font-size:12px;color:#64748b">Si tú no solicitaste este código, ignora este mensaje.</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildNewAccountAdminEmailHtml(p:{user:{name:string;email:string;department:string;role:string};registeredAt:string}){
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:24px;text-align:center}.body{padding:28px}.footer{background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Nueva cuenta registrada</h1></div><div class="body"><p><strong>${esc(p.user.name)}</strong> registró ${esc(p.user.email)}.</p><p>Departamento: ${esc(p.user.department)}<br>Rol inicial: ${esc(p.user.role)}<br>Fecha: ${esc(p.registeredAt)}</p></div><div class="footer">Sistema de Gestión de Viáticos © 2026 • Dimer Corporativo</div></div></body></html>`;
}

export function buildTokenApprovalResultPageHtml(p:{status:string;request?:TravelRequest;actionTaken?:string;errorMessage?:string;processedBy?:string;processedAt?:string}){
  const r=p.request;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}.card{max-width:650px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.head{background:#0f172a;color:#fff;padding:24px}.body{padding:28px}.foot{padding:16px;background:#f8fafc;color:#64748b;font-size:11px;text-align:center}</style></head><body><div class="card"><div class="head"><h2>${esc(p.status==='APROBADA'?'Solicitud aprobada':p.status==='RECHAZADA'?'Solicitud rechazada':'Resultado del dictamen')}</h2></div><div class="body"><p>${esc(p.errorMessage||`Estado: ${p.status}`)}</p>${r?`<p><strong>Folio:</strong> ${esc(r.folio)}<br><strong>Solicitante:</strong> ${esc(r.requesterName)}<br><strong>Procesado por:</strong> ${esc(p.processedBy||r.approvedBy||r.rejectedBy||r.bossEmail)}<br><strong>Fecha:</strong> ${esc(p.processedAt||new Date().toISOString())}</p>`:''}</div><div class="foot">Sistema de Viáticos Dimer © 2026</div></div></body></html>`;
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