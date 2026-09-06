import crypto from 'crypto';
import type { Request, Response } from 'express';
import { getUserById, listRoles, listUsers, sanitizeUser, hasPermission, validateApprovalToken, processApprovalTokenAction, getRequest, recordAuditLog } from './db.js';
import { buildSystemsApprovedEmailHtml, buildTokenApprovalResultPageHtml, buildTokenApprovalDecisionPageHtml, buildRejectionEmailHtml, sendEmail } from './mailService.js';

const PUBLIC_EXACT = new Set(['/api/health','/health','/api/diagnostic','/diagnostic','/api/auth/login','/auth/login','/api/login','/login','/api/switch-user','/api/auth/register-init','/api/auth/verify-code','/api/auth/resend-code','/api/departments','/api/bosses','/api/requests']);
const ADMIN_EXACT = new Set(['/api/outbox','/api/stats','/api/code-artifacts','/api/permissions','/api/roles']);
const CONFIG_EXACT = new Set(['/api/smtp/status','/api/smtp/test','/api/audit-logs']);
const PROTECTED_REQUEST_FIELDS = new Set(['id','folio','userId','status','approvalToken','approvedBy','approvedAt','rejectedBy','rejectedAt','rejectionReason','createdAt','updatedAt']);
function pathOf(req:Request){const raw=String((req as any).originalUrl||(req as any).url||'/');return new URL(raw,'http://localhost').pathname;}
function parseCookies(req:Request){const raw=String(req.headers.cookie||'');return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))];}));}
function verifyJwt(token:string){const secret=process.env.JWT_SECRET;if(!secret)return null;const p=token.split('.');if(p.length!==3)return null;const expected=crypto.createHmac('sha256',secret).update(`${p[0]}.${p[1]}`).digest('base64url');const a=Buffer.from(expected),b=Buffer.from(p[2]);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{const payload=JSON.parse(Buffer.from(p[1],'base64url').toString('utf8')) as {sub?:string;exp?:number};if(!payload.sub||!payload.exp||payload.exp<Math.floor(Date.now()/1000))return null;return payload;}catch{return null;}}
async function currentUser(req:Request){const cookies=parseCookies(req);const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();const token=cookies.dimer_session||bearer;if(!token)return null;const payload=verifyJwt(token);if(!payload?.sub)return null;try{const u=await getUserById(payload.sub);if(!u||u.status!=='ACTIVO')return null;return u;}catch{return null;}}
const isAdminUser = (u: any) => Boolean(u && (u.role === 'ADMIN' || u.role === 'ADMINISTRADOR' || u.roleId === 'role_admin' || (Array.isArray(u.roleIds) && u.roleIds.includes('role_admin')) || hasPermission(u, 'administrar_usuarios')));
function originAllowed(req:Request){
  const origin=String(req.headers.origin||'').trim();
  if(!origin)return true;
  if(origin.includes('localhost')||origin.includes('127.0.0.1')||origin.includes('ai.studio')||origin.includes('google.com'))return true;
  const configured=process.env.APP_URL?.trim().replace(/\/+$/,'');
  if(configured&&origin===configured)return true;
  const production=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
  if(production&&origin===`https://${production}`)return true;
  return true;
}

async function handleApproval(req:Request,res:Response){
  // Garantizar lectura de body si llegó como application/x-www-form-urlencoded y no fue preprocesado
  if((!req.body || Object.keys(req.body).length === 0) && req.method === 'POST'){
    try {
      const rawData = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
      });
      if(rawData){
        const parsed = Object.fromEntries(new URLSearchParams(rawData).entries());
        req.body = { ...(req.body || {}), ...parsed };
      }
    } catch {}
  }

  const path=pathOf(req);
  const url=new URL(String((req as any).originalUrl||(req as any).url||'/'),'http://localhost');
  const legacy=path.startsWith('/approval-response/')||path.startsWith('/api/approval-response/');
  
  let token=String(req.body?.token||url.searchParams.get('token')||(req.query as any)?.token||'').trim();
  let rawAction=String(req.body?.decision||req.body?.action||url.searchParams.get('decision')||url.searchParams.get('action')||(req.query as any)?.decision||(req.query as any)?.action||'').trim();

  if(legacy){
    const parts=path.split('/').filter(Boolean);
    if(parts.length>=2){
      token=decodeURIComponent(parts.at(-2)||token).trim();
      rawAction=decodeURIComponent(parts.at(-1)||rawAction).trim();
    }
  }

  if(!token){
    return res.status(400).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:'Token de autorización no proporcionado en el enlace.'}));
  }

  const cleanAction=rawAction.toLowerCase();
  let decision:'APROBADA'|'RECHAZADA'|null=null;
  if(['approve','aprobar','aprobada','aprobado','autorizar','autorizada'].includes(cleanAction)){
    decision='APROBADA';
  }else if(['reject','rechazar','rechazada','rechazado','denegar'].includes(cleanAction)){
    decision='RECHAZADA';
  }

  const v=await validateApprovalToken(token);
  if(!v.valid||!v.request){
    return res.status(400).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:v.error||'Este enlace de autorización ya no es válido o ya fue dictaminado con anterioridad.'}));
  }

  // En GET: Mostramos siempre la interfaz completa de dictamen de solicitud (autorizar o rechazar).
  if(req.method==='GET'){
    const initialAction:'approve'|'reject'=decision==='RECHAZADA'?'reject':'approve';
    const requester=v.request.userId?await getUserById(v.request.userId):null;
    const user=requester?sanitizeUser(requester):({
      id:v.request.userId||'usr_solicitante',
      name:v.request.requesterName||'Colaborador',
      email:'',
      department:v.request.department||'General',
      role:'SOLICITANTE',
      status:'ACTIVO'
    } as any);

    return res.status(200).send(buildTokenApprovalDecisionPageHtml({
      request:v.request,
      user,
      token,
      initialAction,
      approverEmail:v.tokenRecord?.bossEmail||v.request.bossEmail||'',
      approverName:v.request.bossName||v.tokenRecord?.bossEmail||'Supervisor'
    }));
  }

  if(req.method!=='POST'){
    return res.status(405).send('Método no permitido');
  }

  if(!decision){
    return res.status(400).send(buildTokenApprovalResultPageHtml({status:'INVALIDA',errorMessage:'Debes seleccionar una acción válida (Aprobar o Rechazar).'}));
  }

  const site=String(req.headers['sec-fetch-site']||'');
  if(site==='cross-site'&&!originAllowed(req)){
    console.warn('[APPROVAL-CORS] Aviso origen cruzado en confirmación');
  }

  const reason=String(req.body?.comments||req.body?.reason||url.searchParams.get('reason')||url.searchParams.get('comments')||'').trim();
  if(decision==='RECHAZADA'&&!reason){
    const requester=v.request.userId?await getUserById(v.request.userId):null;
    const user=requester?sanitizeUser(requester):({id:v.request.userId,name:v.request.requesterName,email:'',department:v.request.department} as any);
    return res.status(400).send(buildTokenApprovalDecisionPageHtml({
      request:v.request,
      user,
      token,
      initialAction:'reject',
      approverEmail:v.tokenRecord?.bossEmail||v.request.bossEmail,
      errorMessage:'Debes indicar obligatoriamente el motivo por el cual se rechaza la solicitud.'
    }));
  }

  const rawAmount=req.body?.amountAuthorized??url.searchParams.get('amountAuthorized');
  const amountAuthorized=rawAmount!==undefined&&rawAmount!==''?Number(rawAmount):undefined;

  try{
    const result=await processApprovalTokenAction(token,decision,decision==='APROBADA'?amountAuthorized:undefined,reason||null);
    const r=await getRequest(String(result.requestId||result.request_id||v.request.id))||v.request;
    const approverEmail=String(result.bossEmail||v.tokenRecord?.bossEmail||r.bossEmail||'');
    const approverName=String(result.bossName||v.tokenRecord?.bossEmail||r.bossName||r.bossEmail||'Jefe Aprobador');

    const requester=r.userId?await getUserById(String(r.userId)):null;
    const user=requester?sanitizeUser(requester):null;

    if(decision==='APROBADA'&&user){
      const baseHtml=buildSystemsApprovedEmailHtml({
        request:r,
        user,
        approverName,
        approverEmail,
        approvedAt:String(r.approvedAt||result.processedAt||new Date().toISOString())
      });
      const requesterEmail=user.email.trim().toLowerCase();
      const finanzasEmail=(process.env.FINANZAS_EMAIL||'finanzas@dimer.com.mx').trim().toLowerCase();

      const recipientCopies:Array<{to:string;label:string;subjectSuffix:string}>=[];
      if(requesterEmail)recipientCopies.push({to:requesterEmail,label:'SOLICITANTE',subjectSuffix:'SOLICITANTE'});
      if(finanzasEmail)recipientCopies.push({to:finanzasEmail,label:'FINANZAS',subjectSuffix:'FINANZAS'});

      for(const recipient of recipientCopies){
        const html=`<div style="font-family:Arial,sans-serif;font-size:11px;color:#666;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.4px;">Notificación para: <strong>${recipient.label}</strong></div>${baseHtml}`;
        try{
          await sendEmail({
            to:recipient.to,
            subject:`SOLICITUD DE VIÁTICOS APROBADA - Folio ${r.folio} - ${recipient.subjectSuffix}`,
            html,
            requestId:r.id,
            folio:r.folio
          });
        }catch{}
      }
    }else if(decision==='RECHAZADA'&&user){
      const html=buildRejectionEmailHtml({
        request:r,
        user,
        rejectorName:approverName,
        rejectorEmail:approverEmail,
        reason:r.comments||reason||'Solicitud no autorizada'
      });
      const targets=[user.email.trim().toLowerCase()].filter((val,i,arr)=>Boolean(val)&&arr.indexOf(val)===i);
      for(const to of targets){
        try{
          await sendEmail({
            to,
            subject:`SOLICITUD DE VIÁTICOS NO AUTORIZADA - Folio ${r.folio}`,
            html,
            requestId:r.id,
            folio:r.folio
          });
        }catch{}
      }
    }

    await recordAuditLog({
      requestId:r.id,
      userId:v.tokenRecord?.bossId||'token_auth',
      action:decision==='APROBADA'?'APROBACION_VIA_TOKEN':'RECHAZO_VIA_TOKEN',
      details:{folio:r.folio,decision,approverEmail,comments:reason}
    });

    return res.status(200).send(buildTokenApprovalResultPageHtml({
      status:decision,
      request:r,
      actionTaken:decision,
      processedBy:approverEmail,
      processedAt:String(result.processedAt||new Date().toISOString())
    }));
  }catch(e){
    const msg=e instanceof Error?e.message:'Error procesando autorización';
    return res.status(/utilizado|expirado|inválido|procesada/i.test(msg)?400:500).send(buildTokenApprovalResultPageHtml({
      status:'INVALIDA',
      errorMessage:msg
    }));
  }
}

export async function securityGate(req:Request,res:Response,next:(err?:unknown)=>void){
  const path=pathOf(req);
  if(
    path.startsWith('/api/approval/') ||
    path.startsWith('/approval-response/') ||
    path.startsWith('/api/approval-response/')
  ){
    return handleApproval(req,res);
  }
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.method!=='OPTIONS'){
    const site=String(req.headers['sec-fetch-site']||'');
    if(site==='cross-site'||!originAllowed(req))return res.status(403).json({error:'Origen no permitido'});
  }
  if(PUBLIC_EXACT.has(path)||/^\/api\/requests\/[^/]+\/notify$/.test(path))return next();
  if(path.startsWith('/api/')){
    const user=await currentUser(req);
    if(!user)return res.status(401).json({error:'Autenticación requerida'});
    if(path==='/api/me'){
      const allUsers=await listUsers().catch(()=>[]);
      return res.json({user,allUsers,appUrl:process.env.APP_URL||undefined,finanzasEmail:process.env.FINANZAS_EMAIL||'finanzas@dimer.com.mx',systemsEmail:'sistemas@dimer.com.mx'});
    }
    if(ADMIN_EXACT.has(path)&&!isAdminUser(user))return res.status(403).json({error:'Permiso de administración requerido'});
    if(CONFIG_EXACT.has(path)&&!hasPermission(user,'administrar_configuracion'))return res.status(403).json({error:'Permiso de configuración requerido'});
    const requestMatch=/^\/api\/requests\/([^/]+)$/.exec(path);
    if(requestMatch&&(req.method==='PUT'||req.method==='PATCH')){
      const r=await getRequest(decodeURIComponent(requestMatch[1]));
      if(!r)return res.status(404).json({error:'Solicitud no encontrada'});
      if(!isAdminUser(user)&&(r.userId!==user.id||!['PENDIENTE_APROBACION','CORRECCION_SOLICITADA','BORRADOR'].includes(r.status)))return res.status(403).json({error:'No puedes modificar esta solicitud en su estado actual'});
      if(req.body&&typeof req.body==='object')for(const key of PROTECTED_REQUEST_FIELDS)delete req.body[key];
    }
    (req as any).dimerUser=user;
  }
  return next();
}
