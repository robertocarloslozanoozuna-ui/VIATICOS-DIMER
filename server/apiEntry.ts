import { createApp } from './app';
import { ensureDatabaseReady } from './db';

// Supabase must be hydrated before the synchronous business layer is exposed.
// This prevents Vercel cold starts from serving the app with the seed arrays
// before the persistent database has been loaded.
await ensureDatabaseReady();

const app = createApp();

export default app;
export { app };
