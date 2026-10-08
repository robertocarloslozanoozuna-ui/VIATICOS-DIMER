import { authFetch } from './apiHelper.js';
import type { ExpenseFileAttachment } from '../types.js';

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeMetadata(value: string): string {
  const bytes = new TextEncoder().encode(String(value || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function startTusUpload(
  endpoint: string,
  token: string,
  bucketName: string,
  objectName: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const metadata = [
    ['bucketName', bucketName],
    ['objectName', objectName],
    ['contentType', file.type || 'application/octet-stream'],
    ['cacheControl', '3600'],
  ].map(([key, value]) => `${key} ${encodeMetadata(value)}`).join(',');

  const init = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
      'x-signature': token,
    },
  });

  if (!init.ok) {
    const body = await init.text().catch(() => '');
    throw new Error(body || `No fue posible iniciar la carga (HTTP ${init.status}).`);
  }

  const location = init.headers.get('Location');
  if (!location) throw new Error('Storage no devolvió la ubicación de carga.');
  let uploadUrl: string;
  try {
    uploadUrl = new URL(location, endpoint).toString();
  } catch {
    uploadUrl = location;
  }

  const chunkSize = 6 * 1024 * 1024;
  let offset = Number(init.headers.get('Upload-Offset') || 0);

  const readOffset = async () => {
    const response = await fetch(uploadUrl, {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0', 'x-signature': token },
    });
    if (!response.ok) return offset;
    return Number(response.headers.get('Upload-Offset') || offset);
  };

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
    let uploaded = false;
    let lastError = '';

    for (let attempt = 1; attempt <= 4 && !uploaded; attempt += 1) {
      try {
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
            'x-signature': token,
          },
          body: chunk,
        });

        if (response.ok) {
          const nextOffset = Number(response.headers.get('Upload-Offset'));
          if (!Number.isFinite(nextOffset) || nextOffset < offset) {
            throw new Error('Storage devolvió un offset de carga inválido.');
          }
          offset = nextOffset;
          uploaded = true;
          onProgress?.(Math.round((offset / file.size) * 100));
          break;
        }

        lastError = await response.text().catch(() => '') || `HTTP ${response.status}`;
        const recovered = await readOffset();
        if (Number.isFinite(recovered) && recovered >= offset && recovered <= file.size) {
          offset = recovered;
          if (offset >= file.size) {
            uploaded = true;
            break;
          }
        }
      } catch (error: any) {
        lastError = error?.message || 'Error de red durante la carga.';
        const recovered = await readOffset();
        if (Number.isFinite(recovered) && recovered >= offset && recovered <= file.size) {
          offset = recovered;
          if (offset >= file.size) {
            uploaded = true;
            break;
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }

    if (!uploaded) throw new Error(lastError || 'No fue posible completar la carga del documento.');
  }

  onProgress?.(100);
}

export async function uploadExpenseDocument(input: {
  folio: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<ExpenseFileAttachment> {
  const sha256 = await computeSha256(input.file);
  const initResponse = await authFetch('/api/expenses/document-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folio: input.folio,
      name: input.file.name,
      size: input.file.size,
      type: input.file.type || 'application/octet-stream',
      sha256,
    }),
  });

  const initData = await initResponse.json().catch(() => ({}));
  if (!initResponse.ok || !initData.success) {
    throw new Error(typeof initData.error === 'string' ? initData.error : 'No fue posible iniciar la carga del documento.');
  }

  if (initData.duplicate && initData.file) {
    input.onProgress?.(100);
    return { ...initData.file, dataUrl: '' };
  }

  await startTusUpload(
    String(initData.uploadEndpoint || ''),
    String(initData.token || ''),
    'viaticos-comprobantes',
    String(initData.path || ''),
    new File([input.file], input.file.name, {
      type: String(initData.mimeType || input.file.type || 'application/octet-stream'),
      lastModified: input.file.lastModified,
    }),
    input.onProgress,
  );

  const complete = await authFetch('/api/expenses/document-upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folio: input.folio, documentId: initData.documentId }),
  });
  const completeData = await complete.json().catch(() => ({}));
  if (!complete.ok || !completeData.success || !completeData.file) {
    throw new Error(typeof completeData.error === 'string' ? completeData.error : 'El archivo subió, pero no pudo confirmarse en el expediente.');
  }

  return { ...completeData.file, dataUrl: '' };
}
