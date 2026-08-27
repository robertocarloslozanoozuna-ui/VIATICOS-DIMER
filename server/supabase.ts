import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase exclusivo del backend.
 *
 * IMPORTANTE PARA VERCEL:
 * No inicializamos ni validamos las variables de entorno durante el import
 * del módulo. Si una variable falta, lanzar una excepción aquí provoca
 * FUNCTION_INVOCATION_FAILED antes de que Express pueda responder un 503.
 * La inicialización es lazy: el error ocurre dentro de la petición y puede
 * manejarse de forma controlada.
 */
let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl) {
    throw new Error('Database unavailable: falta SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw new Error('Database unavailable: falta SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabaseUrl = rawUrl
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1\/?$/i, '');

  if (!/^https?:\/\/[^\s/]+(?:\.[^\s/]+)+$/i.test(supabaseUrl)) {
    throw new Error(
      'Database unavailable: SUPABASE_URL no es válida. Debe ser la URL del proyecto, por ejemplo https://xxxxxxxx.supabase.co',
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

/**
 * Proxy compatible con el uso existente: supabase.from(...), supabase.rpc(...), etc.
 * El cliente real sólo se crea cuando una ruta necesita acceder a PostgreSQL.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = (getSupabaseClient() as unknown as Record<PropertyKey, unknown>)[property];
    return typeof value === 'function' ? value.bind(getSupabaseClient()) : value;
  },
});

/** Permite comprobar la configuración sin exponer ningún secreto. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
