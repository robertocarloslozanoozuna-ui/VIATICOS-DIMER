import { supabase } from './supabase.js';

export type EmailReservation = {
  key: string;
  requestId?: string;
  folio?: string;
  recipient: string;
  subject: string;
};

/**
 * Durable email idempotency for Vercel/serverless.
 * A process-local Map is not sufficient because concurrent invocations may
 * run in different instances. Supabase's PRIMARY KEY provides the atomic gate.
 */
export async function reserveEmailDelivery(p: EmailReservation): Promise<boolean> {
  const key = p.key.trim();
  if (!key) return true;

  const { error } = await supabase.from('email_delivery_keys').insert({
    id: key,
    request_id: p.requestId || null,
    folio: p.folio || null,
    recipient: p.recipient.trim().toLowerCase(),
    subject: p.subject,
    status: 'sending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!error) return true;

  // PostgreSQL unique_violation: another invocation already reserved it.
  if (error.code === '23505') return false;

  // Fail open only for infrastructure/schema errors so an unavailable
  // idempotency table does not silently suppress legitimate notifications.
  console.error('[EMAIL-IDEMPOTENCY] No se pudo reservar la entrega:', error);
  return true;
}

export async function markEmailDeliverySent(key: string): Promise<void> {
  const { error } = await supabase
    .from('email_delivery_keys')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', key);
  if (error) console.error('[EMAIL-IDEMPOTENCY] No se pudo marcar como enviado:', error);
}

export async function releaseEmailDelivery(key: string): Promise<void> {
  const { error } = await supabase.from('email_delivery_keys').delete().eq('id', key);
  if (error) console.error('[EMAIL-IDEMPOTENCY] No se pudo liberar la reserva:', error);
}

export function buildEmailDeliveryKey(requestId: string | undefined, recipient: string, subject: string): string {
  const raw = `${requestId || 'no-request'}|${recipient.trim().toLowerCase()}|${subject.trim()}`;
  // Keep the DB primary key short and deterministic without requiring crypto.
  let h1 = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h1 ^= raw.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  return `mail_${(h1 >>> 0).toString(16)}_${raw.length}`;
}
