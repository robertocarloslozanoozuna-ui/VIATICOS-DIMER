import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'crypto';
import { createApp } from '../server/app.js';
import { getUserById, listBosses } from '../server/db.js';
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

async function isAuthenticated(req: Request) {
  const token = parseSessionCookie(req);
  if (!token) return false;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
    const user = await getUserById(payload.sub);
    return Boolean(user && user.status === 'ACTIVO');
  } catch {
    return false;
  }
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

// IMPORTANT: createApp() contains the application's final fallback/404 handler.
// Any routes that are registered after createApp() may never be reached.
// Keep externally registered routes on this outer app, before app.use(mainApp).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// When the request form is submitted without applying the Budget Calculator,
// the frontend's calculator fields can still contain their UI defaults.
// The existing "Desglose estimado:" marker is written only by the calculator's
// Apply action, so it is the safest backwards-compatible indicator that the
// user actually used the calculator. Normalize those default values before
// the request reaches the persistence layer. This keeps the existing schema,
// approval flow and email templates unchanged.
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

// A requester only needs read access to the active approver list in order to
// create a travel request. Administrative create/update/delete operations
// remain protected by the existing administrar_jefes permission inside createApp().
app.get('/api/bosses', async (req: Request, res: Response) => {
  try {
    if (!(await isAuthenticated(req))) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }
    return res.json((await listBosses()).filter(boss => boss.active));
  } catch (error) {
    logSystemError(error, req, { source: 'bosses-read', statusCode: 503 });
    return res.status(503).json({ error: 'Base de datos no disponible' });
  }
});

// Initial request notification endpoint.
app.post('/api/requests/:id/notify', requestNotificationHandler);

// Approval links are opened directly from email, so they must also be
// registered before createApp()'s fallback. This covers both GET decision
// pages and POST decision submissions.
registerApprovalRoutes(app);

// Multi-role user endpoints intentionally live on the outer app so they
// take precedence over the legacy single-role handlers inside createApp().
// The legacy handlers remain untouched for rollback safety.
registerMultiRoleUserRoutes(app);

const mainApp = createApp();
registerAdminRequestRoutes(mainApp);
registerRequestCreationRoutes(mainApp);

app.use(mainApp);

// Last-resort Express error handler for errors that reach the outer app.
// Existing route behavior remains unchanged because normal responses are not
// intercepted here.
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  logSystemError(error, req, { source: 'express-error', statusCode: 500 });
  if (res.headersSent) return next(error);
  return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
});

export default app;
