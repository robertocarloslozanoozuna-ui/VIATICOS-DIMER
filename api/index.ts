import type { Request, Response } from 'express';
import { createApp } from '../server/app';

let app: ReturnType<typeof createApp> | null = null;
let bootError: unknown = null;

function getBootErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getApp() {
  if (app) return app;
  if (bootError) throw bootError;
  try {
    app = createApp();
    return app;
  } catch (error) {
    bootError = error;
    throw error;
  }
}

export default function handler(req: Request, res: Response) {
  try {
    return getApp()(req, res);
  } catch (error) {
    console.error('[DIMER VERCEL BOOT ERROR]', error);
    const message = getBootErrorMessage(error);
    return res.status(503).json({
      success: false,
      error: 'Backend initialization failed',
      database: 'supabase',
      runtime: 'vercel-serverless',
      diagnostic: process.env.NODE_ENV === 'production'
        ? 'Revisa Runtime Logs de Vercel para DIMER VERCEL BOOT ERROR.'
        : message,
    });
  }
}
