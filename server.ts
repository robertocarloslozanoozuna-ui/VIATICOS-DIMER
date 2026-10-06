import express from 'express';
import path from 'path';
import handler, { createApp } from './server/apiEntry.js';

export { createApp, handler };

export async function startServer() {
  const app = handler;

  const portArgIdx = process.argv.indexOf('--port');
  const portFromArg = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : undefined;
  const hostArgIdx = process.argv.indexOf('--host');
  const hostFromArg = hostArgIdx !== -1 && process.argv[hostArgIdx + 1] ? process.argv[hostArgIdx + 1] : undefined;

  const PORT = portFromArg || Number(process.env.PORT) || 3000;
  const HOST = hostFromArg || process.env.HOST || '0.0.0.0';

  // Unhandled /api/* routes MUST return JSON 404 and never fall through to Vite SPA HTML fallback
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Ruta API no encontrada' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, HOST, () => console.log(`[VIATICOS APP] Servidor activo en http://${HOST}:${PORT}`));
}

if (process.env.VERCEL !== '1') startServer().catch(err => console.error('[FATAL SERVER ERROR]', err));
