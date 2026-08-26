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
const baseSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Persistencia serializada.
 *
 * db.supabase.fixed.ts persiste una operación completa en este orden:
 * departments -> roles -> bosses -> users -> travel_requests ->
 * approval_tokens -> audit_logs.
 *
 * Las funciones de negocio pueden disparar varios saveToDisk() sin await.
 * Antes, dos guardados podían intercalarse y el guardado viejo de
 * audit_logs podía sobrescribir al nuevo. Este bloqueo hace que cada ciclo
 * completo de persistencia termine en audit_logs antes de que comience otro.
 */
let persistenceTail: Promise<void> = Promise.resolve();
let releaseActiveCycle: (() => void) | null = null;
let activeCycle = false;

async function beginPersistenceCycle(): Promise<void> {
  const previous = persistenceTail;

  let release!: () => void;
  persistenceTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  activeCycle = true;
  releaseActiveCycle = release;
}

function endPersistenceCycle(): void {
  if (!activeCycle) return;
  activeCycle = false;
  const release = releaseActiveCycle;
  releaseActiveCycle = null;
  release?.();
}

function wrapQueryBuilder(table: string): any {
  const builder = baseSupabase.from(table) as any;

  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === 'upsert') {
        return (...args: any[]) => {
          const run = async () => {
            const startsCycle = table === 'departments';

            if (startsCycle) {
              await beginPersistenceCycle();
            }

            try {
              return await target.upsert(...args);
            } catch (error) {
              // If a persistence cycle fails before audit_logs, never leave
              // the queue permanently locked.
              if (startsCycle || activeCycle) {
                endPersistenceCycle();
              }
              throw error;
            } finally {
              // audit_logs is the final table in saveToDisk(). Releasing here
              // guarantees the next save starts only after the complete
              // previous save has reached its final persistence step.
              if (table === 'audit_logs') {
                endPersistenceCycle();
              }
            }
          };

          return run();
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Backend-only Supabase client with serialized persistence writes.
 * Reads and auth behavior remain unchanged; only .upsert() calls are wrapped.
 */
export const supabase = new Proxy(baseSupabase as any, {
  get(target, property, receiver) {
    if (property === 'from') {
      return (table: string) => wrapQueryBuilder(table);
    }

    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as typeof baseSupabase;
