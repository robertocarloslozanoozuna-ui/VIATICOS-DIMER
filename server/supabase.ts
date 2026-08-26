import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Falta la variable de entorno SUPABASE_URL');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
}

/** Cliente exclusivo del backend. Nunca debe exponerse al navegador. */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Bootstrap automático en Vercel/Node. Idempotente: si roles ya tiene datos, no vuelve a sembrar.
import('./supabase-seed')
  .then(({ ensureSupabaseSeed }) => ensureSupabaseSeed())
  .catch((err) => console.error('[DIMER DB] Error inicializando Supabase:', err));
