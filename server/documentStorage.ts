import { supabase } from './supabase.js';

export const DOCUMENTS_BUCKET = 'viaticos-comprobantes';
export const DOCUMENT_MAX_SIZE = 20 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set(Object.keys(MIME_BY_EXT));
export const ALLOWED_DOCUMENT_MIME_TYPES = Object.values(MIME_BY_EXT);

export function extensionOf(name: string): string {
  return String(name || '').toLowerCase().split('.').pop() || '';
}

export function mimeForExtension(extension: string): string {
  return MIME_BY_EXT[extension] || 'application/octet-stream';
}

export function sanitizeStorageName(name: string): string {
  const base = String(name || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180)
    .trim();
  return base || 'documento';
}

export function buildDocumentStoragePath(folio: string, documentId: string, originalName: string): string {
  const cleanFolio = String(folio || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const cleanId = String(documentId || '').replace(/[^A-Za-z0-9_-]/g, '_');
  return `${cleanFolio}/${cleanId}/${sanitizeStorageName(originalName)}`;
}

export async function createSignedUpload(path: string) {
  const { data, error } = await supabase
    .storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data?.token) {
    throw new Error(error?.message || 'No fue posible generar la autorización de carga del documento.');
  }

  return {
    token: data.token,
    path,
    signedUrl: data.signedUrl,
  };
}

export async function objectExists(path: string): Promise<boolean> {
  const parts = path.split('/');
  const name = parts.pop() || '';
  const prefix = parts.join('/');
  const { data, error } = await supabase
    .storage
    .from(DOCUMENTS_BUCKET)
    .list(prefix, { limit: 100, search: name });

  if (error) throw new Error(error.message || 'No fue posible comprobar el archivo almacenado.');
  return Array.isArray(data) && data.some((item) => item.name === name);
}

export async function downloadObject(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message || 'No fue posible leer el documento almacenado.');
  return Buffer.from(await data.arrayBuffer());
}

export async function createSignedDownloadUrl(path: string, expiresIn = 300, download = false): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn, download ? { download: true } : undefined);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'No fue posible generar la URL segura del documento.');
  }

  return data.signedUrl;
}

export async function removeObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) throw new Error(error.message || 'No fue posible eliminar el documento almacenado.');
}
