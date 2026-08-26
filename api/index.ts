import { createApp } from '../server/app';

const app = createApp();

export default function handler(req: any, res: any) {
  try {
    // Set permissive CORS headers for Vercel Serverless Invocation
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-user-email, x-user-id'
    );

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return app(req, res);
  } catch (err: any) {
    console.error('[VERCEL API CRASH SHIELD]', err);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor en invocación de API.',
      detail: err?.message || String(err),
    });
  }
}

export { app };
