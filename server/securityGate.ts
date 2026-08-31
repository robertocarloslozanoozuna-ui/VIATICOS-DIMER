import crypto from 'crypto';
import type { Request, Response } from 'express';
import { getUserById, listRoles, sanitizeUser, hasPermission, validateApprovalToken, processApprovalTokenAction, getRequest } from './db.js';
import { buildSystemsApprovedEmailHtml, buildTokenApprovalResultPageHtml, sendEmail } from './mailService.js';

const PUBLIC_EXACT = new Set([
  '/api/health','/health','/api/diagnostic','/diagnostic',
  '/api/auth/login','/auth/login','/api/login','/login',
  '/api/auth/register-init','/api/auth/verify-code','/api/auth/resend-code',
  '/api/departments',
]);
const ADMIN_EXACT = new Set(['/api/outbox','/api/stats','/api/code-artifacts','/api/permissions','/api/roles']);
const CONFIG_EXACT = new Set(['/api/smtp/status','/api/smtp/test','/api/audit-logs']);

function pathOf(req:Request){
  const raw=String((req as any).originalUrl||(req as any).url||'/');
  return new URL(raw,'http://localhost').pathname;
}
function parseCookies(req:Request){
  const raw=String(req.headers.cookie||'');
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))];}));
}
function verifyJwt(token:string){
  const secret=process.env.JWT_SECRET;
  if(!secret)return null;
  const p=token.split('.');
  if(p.length!==3)return null;
  const expected=crypto.createHmac('sha256',secret).update(`${p[0]}.${p[1]}`).digest('base64url');
  const a=Buffer.from(expected),b=Buffer.from(p[2]);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{const payload=JSON.parse(Buffer.from(p[1],'base64url').toString('utf8')) as {sub?:string;exp?:number};if(!payload.sub||!payload.exp||payload.exp<Math.floor(Date.now()/1000))return null;return payload;}catch{return null;}
}
async function currentUser(req:Request){
  const cookies=parseCookies(req);const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();const token=cookies.dimer_session||bearer;if(!token)return null;
  const payload=verifyJwt(token);if(!payload?.sub)return null;
  try{const u=await getUserById(payload.sub);if(!u||u.status!=='ACTIVO')return null;const roles=await listRoles();return sanitizeUser(u,roles.find(r=>r.id===u.roleId));}catch{return null;}
}
function originAllowed(req:Request){
  const origin=String(req.headers.origin||'').trim();if(!origin)return true;
  const configured=process.env.APP_URL?.trim().replace(/\/+$/,'');if(configured)return origin===configured;
  const production=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;if(production)return origin===`https://${production}`;
  return true;
}
function escapeHtml(v:unknown){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]!));}
function approvalPage(token:string,action:'approve'|'reject',request:any){
  const title=action==='approve'?'Autorizar solicitud':'Rechazar solicitud';const color=action==='approve'?'#059669':'#dc2626';
  const reason=action==='reject'?'<textarea id="reason" placeholder="Motivo del rechazo" style="width:100%;min-height:100px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin:12px 0;box-sizing:border-box"></textarea>':'';
  const js=`async function go(){const reasonEl=document.getElementById('reason');const reason=reasonEl?reasonEl.value.trim():'';if('${action}'==='reject'&&!reason){alert('El motivo del rechazo es obligatorio.');return;}const q=new URLSearchParams({token:${JSON.stringify(token)},action:${JSON.stringify(action)}});if(reason)q.set('reason',reason);const r=await fetch('/api/approval/token-action/confirm?'+q.toString(),{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'}});document.open();document.write(await r.text());document.close();}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"><div style="background:#0f172a;color:#fff;padding:24px"><h2 style="margin:0">${escapeHtml(title)}</h2><p style="margin-bottom:0">Viáticos Dimer • Folio ${escapeHtml(request.folio)}</p></div><div style="padding:28px"><p><strong>Solicitante:</strong> ${escapeHtml(request.requesterName)}</p><p><strong>Departamento:</strong> ${escapeHtml(request.department)}</p><p><strong>Destino:</strong> ${escapeHtml(request.destination)}</p><p><strong>Monto:</strong> $${Number(request.amountRequested||0).toLocaleString('es-MX',{minimumFractionDigits:2})} MXN</p>${reason}<button onclick="go()" style="background:${color};color:#fff;border:0;border-radius:8px;padding:13px 22px;font-weight:700;cursor:pointer">Confirmar</button></div><div style="padding:16px;background:#f8fafc;color:#64748b;font-size:11px;text-align:center">La acción sólo se ejecuta después de una confirmación humana.</div></div><script>${js}</script></body></html>`;
}
async function handleApproval(req:Request,res:Response){
  const path=pathOf(req);const isConfirm=path==='/api/approval/token-action/confirm';const legacy=path.startsWith('/approval-response/')||path.startsWith('/api/approval-response/');
  const url=new URL(String((req as any).originalUrl||(req as any).url||'/'),'http://localhost');let token=url.searchParams.get('token')||'';let action=url.searchParams.get('action')||'';
  if(legacy){const parts=path.split('/');token=decodeURIComponent(parts.at(-2)||'');action=decodeURIComponent(parts.at(-1)||'');}
  const decision=action==='reject'||action==='rechazar'?'RECHAZADA':action==='approve'||action==='aprobar'?'APROBADA':null;
  if(!token||!decision)return res.status(400).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:'Token o acción inválidos.'}));
  if(req.method==='GET'){
    const v=await validateApprovalToken(token);if(!v.valid)return res.status(400).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:v.error}));
    return res.status(200).send(approvalPage(token,decision==='APROBADA'?'approve':'reject',v.request));
  }
  if(req.method!=='POST'||!isConfirm)return res.status(405).send('Método no permitido');
  const site=String(req.headers['sec-fetch-site']||'');if(site==='cross-site'||!originAllowed(req))return res.status(403).send('Origen no permitido');
  const reason=String(url.searchParams.get('reason')||'').trim();if(decision==='RECHAZADA'&&!reason)return res.status(400).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:'El motivo del rechazo es obligatorio.'}));
  try{
    const result=await processApprovalTokenAction(token,decision,undefined,reason||null);const r=await getRequest(String(result.requestId));if(!r)throw new Error('La solicitud procesada no fue encontrada');
    const requester=result.userId?await getUserById(String(result.userId)):null;const user=requester?sanitizeUser(requester):null;
    if(decision==='APROBADA'&&user){
      const html=buildSystemsApprovedEmailHtml({request:r,user,approverName:String(result.bossEmail||'Jefe Aprobador'),approverEmail:String(result.bossEmail||''),approvedAt:String(r.approvedAt||result.processedAt||new Date().toISOString())});
      await sendEmail({to:user.email,subject:`SOLICITUD DE VIÁTICOS APROBADA - ${r.folio}`,html,requestId:r.id,folio:r.folio});await sendEmail({to:'sistemas@dimer.com.mx',subject:`SOLICITUD DE VIÁTICOS APROBADA - ${r.folio}`,html,requestId:r.id,folio:r.folio});
      const fin=process.env.FINANZAS_EMAIL||'finanzas@dimer.com.mx';if(fin.toLowerCase()!=='sistemas@dimer.com.mx')await sendEmail({to:fin,subject:`SOLICITUD DE VIÁTICOS APROBADA - ${r.folio}`,html,requestId:r.id,folio:r.folio});
    }else if(decision==='RECHAZADA'&&user){await sendEmail({to:user.email,subject:`SOLICITUD DE VIÁTICOS RECHAZADA - ${r.folio}`,html:`<p>Su solicitud <strong>${escapeHtml(r.folio)}</strong> fue rechazada.</p><p>${escapeHtml(r.comments||reason)}</p>`,requestId:r.id,folio:r.folio});}
    return res.status(200).send(buildTokenApprovalResultPageHtml({status:decision,request:r,actionTaken:decision,processedBy:String(result.bossEmail||''),processedAt:String(result.processedAt||new Date().toISOString())}));
  }catch(e){const msg=e instanceof Error?e.message:'Error procesando autorización';return res.status(/utilizado|expirado|inválido|procesada/i.test(msg)?400:500).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:msg}));}
}
export async function securityGate(req:Request,res:Response,next:(err?:unknown)=>void){
  const path=pathOf(req);
  if(path==='/api/approval/token-action'||path==='/api/approval/token-action/confirm'||path.startsWith('/approval-response/')||path.startsWith('/api/approval-response/'))return handleApproval(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.method!=='OPTIONS'){const site=String(req.headers['sec-fetch-site']||'');if(site==='cross-site'||!originAllowed(req))return res.status(403).json({error:'Origen no permitido'});}
  if(PUBLIC_EXACT.has(path))return next();
  if(path.startsWith('/api/')){const user=await currentUser(req);if(!user)return res.status(401).json({error:'Autenticación requerida'});if(ADMIN_EXACT.has(path)&&user.role!=='ADMIN')return res.status(403).json({error:'Permiso de administración requerido'});if(CONFIG_EXACT.has(path)&&!hasPermission(user,'administrar_configuracion'))return res.status(403).json({error:'Permiso de configuración requerido'});(req as any).dimerUser=user;}
  return next();
}
