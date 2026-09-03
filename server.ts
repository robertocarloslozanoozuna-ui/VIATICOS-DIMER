import express from 'express';
import path from 'path';
import handler, { createApp } from './server/apiEntry.js';

export { createApp, handler };

export async function startServer() {
  const app = handler;
  const PORT = 3000;

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
  app.listen(PORT, '0.0.0.0', () => console.log(`[VIATICOS APP] Servidor activo en http://localhost:${PORT}`));
}

if (process.env.VERCEL !== '1') startServer().catch(err => console.error('[FATAL SERVER ERROR]', err));
