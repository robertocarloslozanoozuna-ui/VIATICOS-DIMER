import { supabase } from './supabase';

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .limit(5);

  if (error) {
    console.error('[SUPABASE TEST] Error:', error);
    throw error;
  }

  console.log('[SUPABASE TEST] Conexión correcta');
  console.log('[SUPABASE TEST] Departamentos:', data);

  return data;
}
