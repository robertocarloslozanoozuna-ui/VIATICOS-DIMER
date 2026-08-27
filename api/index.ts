import type { Request, Response } from 'express';

/**
 * Vercel Serverless entrypoint.
 * The application is loaded lazily so a module/configuration error can be
 * returned as a controlled response instead of crashing the invocation.
 */
let appPromise: Promise<((req: Request, res: Response) => unknown)> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = import('../server/app').then(({ createApp }) => createApp());
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('[DIMER VERCEL BOOT ERROR]', error);
    if (!res.headersSent) {
      return res.status(503).json({
        success: false,
        error: 'Backend initialization failed',
        database: 'supabase',
        runtime: 'vercel-serverless',
      });
    }
    return undefined;
  }
}
