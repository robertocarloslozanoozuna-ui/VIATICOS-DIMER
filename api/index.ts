import type { Express, Request, Response } from 'express';

/** Vercel Serverless entrypoint with lazy application loading. */
let appPromise: Promise<Express> | null = null;

async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = import('../server/app').then(({ createApp }) => createApp());
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response): Promise<unknown> {
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
