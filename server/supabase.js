import { createClient } from '@supabase/supabase-js';

let client = null;

function getSupabaseClient() {
  if (client) return client;
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl) throw new Error('Database unavailable: falta SUPABASE_URL');
  if (!serviceRoleKey) throw new Error('Database unavailable: falta SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '');
  if (!/^https?:\/\/[^\s/]+(?:\.[^\s/]+)+$/i.test(supabaseUrl)) {
    throw new Error('Database unavailable: SUPABASE_URL no es válida');
  }
  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return client;
}

export const supabase = new Proxy({}, {
  get(_target, property) {
    const instance = getSupabaseClient();
    const value = instance[property];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
