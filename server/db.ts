// Supabase is now the authoritative persistent database layer.
// Keep this compatibility facade so the existing API routes continue using
// the same imports without changing business logic in app.ts.
export * from './db.supabase';
