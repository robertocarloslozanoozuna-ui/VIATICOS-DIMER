import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'crypto';
import { createApp } from '../server/app.js';
import { getUserById, getRequest, updateRequest, recordAuditLog, listBosses } from '../server/db.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';
import { registerRequestCreationRoutes } from '../server/requestCreationRoutes.js';
import { registerMultiRoleUserRoutes } from '../server/multiRoleUserRoutes.js';
import { logSystemError, registerProcessErrorLogging } from '../server/errorLogger.js';

// El dominio personalizado viaticos.dimer.mx actualmente no resuelve por DNS.
// Los enlaces de aprobación deben usar el dominio operativo de Vercel.
const CANONICAL_APP_URL = 'https://viaticos-dimer.vercel.app';
if (process.env.VERCEL) {
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'viaticos-dimer.vercel.app';
  process.env.PUBLIC_APP_URL = CANONICAL_APP_URL;
  process.env.APP_URL = CANONICAL_APP_URL;
}

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

registerProcessErrorLogging();

app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      logSystemError(new Error(`HTTP ${res.statusCode}`), req, { source: 'http-response', statusCode: res.statusCode });
    }
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

