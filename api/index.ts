import type { Request, Response } from 'express';

let appPromise: Promise<((req: Request, res: Response) => unknown)> | null = null;

function getErrorDetails(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

async function loadApp() {
  if (!appPromise) {
    appPromise = import('../server/app')
      .then((module) => {
        if (typeof module.createApp !== 'function') {
          throw new Error('server/app.ts no exporta createApp()');
        }
        return module.createApp();
      })
      .catch((error) => {
        appPromise = null;
        throw error;
      });
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await loadApp();
    return app(req, res);
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('[DIMER VERCEL BOOT ERROR]', details);

    // Never expose environment values or credentials. The error message is
    // intentionally limited to module/runtime diagnostics so the deployment
    // can be diagnosed without leaking secrets.
    const safe = details
      .replace(/(SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|SMTP_PASS|SMTP_PASSWORD|GMAIL_APP_PASSWORD|EMAIL_PASSWORD)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
      .slice(0, 1200);

    return res.status(503).json({
      success: false,
      error: 'Backend initialization failed',
      database: 'supabase',
      runtime: 'vercel-serverless',
      diagnostic: safe,
    });
  }
}
