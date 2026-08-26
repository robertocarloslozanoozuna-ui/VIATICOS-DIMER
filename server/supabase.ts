import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!rawSupabaseUrl) {
  throw new Error('Falta la variable de entorno SUPABASE_URL');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * SUPABASE_URL debe ser la URL del proyecto, por ejemplo:
 * https://xxxxxxxx.supabase.co
 *
 * Si por error se configuró con /rest/v1, lo normalizamos porque
 * supabase-js agrega /rest/v1 automáticamente. Sin esta normalización
 * Supabase termina recibiendo /rest/v1/rest/v1/... y responde PGRST125.
 */
const supabaseUrl = rawSupabaseUrl
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1\/?$/i, '');

if (!/^https?:\/\/[^\s/]+(?:\.[^\s/]+)+$/i.test(supabaseUrl)) {
  throw new Error(
    'SUPABASE_URL no es válida. Debe ser la URL del proyecto, por ejemplo https://xxxxxxxx.supabase.co'
  );
}

/** Cliente exclusivo del backend. Nunca debe exponerse al navegador. */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
