import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'crypto';
import { createApp } from '../server/app.js';
import { getUserById, getRequest, updateRequest, recordAuditLog, listBosses } from '../server/db.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';
import { registerRequestCreationRoutes } from '../server/requestCreationRoutes.js';
import { requestNotificationHandler } from '../server/requestNotificationRoute.js';
import { registerMultiRoleUserRoutes } from '../server/multiRoleUserRoutes.js';
import { logSystemError, registerProcessErrorLogging } from '../server/errorLogger.js';

const app = express();

function parseSessionCookie(req: Request) {
  const raw = String(req.headers.cookie || '');
  const cookies = Object.fromEntries(raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || String(cookies.dimer_session || '');
}

async function getAuthenticatedUser(req: Request) {
  const token = parseSessionCookie(req);
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    const actual = Buffer.from(parts[2]);
    const expectedBuffer = Buffer.from(expected);
    if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const user = await getUserById(payload.sub);
    return user && user.status === 'ACTIVO' ? user : null;
  } catch {
    return null;
  }
}

async function isAuthenticated(req: Request) {
  return Boolean(await getAuthenticatedUser(req));
}

// Global error telemetry. It does not alter successful requests and never
// exposes credentials, cookies or authorization headers in the log.
registerProcessErrorLogging();

app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      logSystemError(new Error(`HTTP ${res.statusCode}`), req, {
        source: 'http-response',
        statusCode: res.statusCode,
      });
    }
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cuando no se usa la calculadora, los costos auxiliares no deben conservar
// los valores por defecto de la interfaz.
app.use('/api/requests', (req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    const comments = String(req.body.comments || '');
    const calculatorUsed = /Desglose estimado:/i.test(comments);
    if (!calculatorUsed) {
      req.body.transportCost = 0;
      req.body.hotelCost = 0;
      req.body.foodCost = 0;
      req.body.miscCost = 0;
    }
  }
  next();
});

// Lectura de supervisores/aprobadores para cualquier usuario autenticado.
// Las operaciones administrativas del catálogo siguen protegidas dentro de createApp().
app.get('/api/bosses', async (req: Request, res: Response) => {
  try {
    if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Autenticación requerida' });
    return res.json((await listBosses()).filter(boss => boss.active));
  } catch (error) {
    logSystemError(error, req, { source: 'bosses-read', statusCode: 503 });
    return res.status(503).json({ error: 'Base de datos no disponible' });
  }
});

// El solicitante puede cancelar su propia solicitud únicamente mientras siga
// pendiente de autorización. ADMIN conserva la posibilidad de intervenir sin
// reutilizar el endpoint administrativo que cancela solicitudes ya aprobadas.
app.post('/api/requests/:id/cancel', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
    const requestId = String(req.params.id || '').trim();
    const request = await getRequest(requestId);
    if (!request) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    const isOwner = request.userId === user.id;
    const isAdmin = String(user.role || '').toUpperCase() === 'ADMIN' || Boolean(user.roles?.some(r => String(r.name || '').toUpperCase() === 'ADMIN'));
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: 'Solo el solicitante puede cancelar esta solicitud.' });
    if (request.status !== 'PENDIENTE_APROBACION' && request.status !== 'PENDIENTE') {
      return res.status(400).json({ success: false, error: `Solo se puede cancelar antes de la aprobación. Estado actual: ${request.status}.` });
    }
    const reason = String(req.body?.reason || 'Cancelada por el solicitante').trim() || 'Cancelada por el solicitante';
    const updated = await updateRequest(request.id, {
      status: 'CANCELADA',
      comments: `${request.comments ? `${request.comments}\n` : ''}Cancelada: ${reason}`,
      updatedAt: new Date().toISOString(),
    });
    await recordAuditLog({
      requestId: request.id,
      userId: user.id,
      action: isAdmin ? 'CANCELACION_ADMIN_SOLICITUD_PENDIENTE' : 'CANCELACION_SOLICITUD_PENDIENTE',
      details: { folio: request.folio, reason, previousStatus: request.status },
    });
    return res.json({ success: true, request: updated });
  } catch (error) {
    logSystemError(error, req, { source: 'request-cancel', statusCode: 500 });
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error al cancelar la solicitud.' });
  }
});

app.post('/api/requests/:id/notify', requestNotificationHandler);
registerApprovalRoutes(app);
registerMultiRoleUserRoutes(app);

const mainApp = createApp();
registerAdminRequestRoutes(mainApp);
registerRequestCreationRoutes(mainApp);
app.use(mainApp);

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  logSystemError(error, req, { source: 'express-error', statusCode: 500 });
  if (res.headersSent) return next(error);
  return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
});

export default app;
