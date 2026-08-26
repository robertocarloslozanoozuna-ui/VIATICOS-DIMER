import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Falta la variable de entorno SUPABASE_URL');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Cliente exclusivo del backend.
 *
 * IMPORTANTE:
 * SUPABASE_SERVICE_ROLE_KEY NUNCA debe exponerse al navegador.
 * Este archivo solamente debe utilizarse desde el servidor/API.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
