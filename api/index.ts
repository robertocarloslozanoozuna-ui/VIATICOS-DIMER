import type { Request, Response } from 'express';

let handlerPromise: Promise<(req: Request, res: Response) => unknown> | null = null;

function getBootErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../server/app')
      .then(({ createApp }) => createApp())
      .catch((error) => {
        handlerPromise = null;
        throw error;
      });
  }
  return handlerPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getHandler();
    return app(req, res);
  } catch (error) {
    console.error('[DIMER VERCEL BOOT ERROR]', getBootErrorMessage(error));
    return res.status(503).json({
      success: false,
      error: 'Backend initialization failed',
      database: 'supabase',
      runtime: 'vercel-serverless',
      diagnostic: 'Backend import/createApp failed. Revisa Runtime Logs de Vercel: [DIMER VERCEL BOOT ERROR].',
    });
  }
}
