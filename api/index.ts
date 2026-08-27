import type { Request, Response } from 'express';
import { createApp } from '../server/app';

let appPromise: Promise<ReturnType<typeof createApp>> | null = null;

function getErrorDetails(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

function getSafeDiagnostic(error: unknown): string {
  return getErrorDetails(error)
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|SMTP_PASS|SMTP_PASSWORD|GMAIL_APP_PASSWORD|EMAIL_PASSWORD)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 1200);
}

function getApp(): ReturnType<typeof createApp> {
  if (!appPromise) {
    appPromise = Promise.resolve().then(() => createApp());
  }
  return appPromise as unknown as ReturnType<typeof createApp>;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    const diagnostic = getSafeDiagnostic(error);
    console.error('[DIMER VERCEL BOOT ERROR]', diagnostic);
    return res.status(503).json({
      success: false,
      error: 'Backend initialization failed',
      database: 'supabase',
      runtime: 'vercel-serverless',
      diagnostic,
    });
  }
}
