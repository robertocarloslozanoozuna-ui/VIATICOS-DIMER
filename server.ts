import express from 'express';
import path from 'path';
import { createApp } from './server/app';
import { ensureDatabaseReady } from './server/db';

export { createApp };

export async function startServer() {
  await ensureDatabaseReady();
  const app = createApp();
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`[VIATICOS APP] Servidor activo en http://localhost:${PORT}`));
}

if (process.env.VERCEL !== '1') {
  startServer().catch(err => console.error('[FATAL SERVER ERROR] Error al iniciar el servidor:', err));
}
