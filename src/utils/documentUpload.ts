import { authFetch } from './apiHelper.js';
import type { ExpenseFileAttachment } from '../types.js';

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function uploadWithSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('Cache-Control', 'max-age=3600');
    xhr.setRequestHeader('x-upsert', 'true');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      const body = xhr.responseText || ('HTTP ' + xhr.status);
      if (xhr.status === 403 && /Invalid Compact JWS|ERR_JWS_INVALID|invalid_compact_jws/i.test(body)) {
        reject(new Error('Supabase rechazó la URL firmada de carga. La firma generada por Storage no pudo validarse.'));
        return;
      }

      reject(new Error(body || ('No fue posible cargar el documento (HTTP ' + xhr.status + ').')));
    };

    xhr.onerror = () => reject(new Error('Error de red durante la carga directa del documento.'));
    xhr.onabort = () => reject(new Error('La carga del documento fue cancelada.'));
    xhr.send(file);
  });
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
    throw new Error(
      typeof initData.error === 'string'
        ? initData.error
        : 'No fue posible iniciar la carga del documento.',
    );
  }

  if (initData.duplicate && initData.attachment) {
    input.onProgress?.(100);
    return { ...initData.attachment, dataUrl: '' };
  }

  if (!initData.signedUrl) {
    throw new Error('Storage no devolvió una URL firmada válida para cargar el documento.');
  }

  const preparedFile = new File([input.file], input.file.name, {
    type: String(initData.mimeType || input.file.type || 'application/octet-stream'),
    lastModified: input.file.lastModified,
  });

  await uploadWithSignedUrl(
    String(initData.signedUrl),
    preparedFile,
    input.onProgress,
  );

  const complete = await authFetch('/api/expenses/document-upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folio: input.folio,
      documentId: initData.documentId,
    }),
  });

  const completeData = await complete.json().catch(() => ({}));
  if (!complete.ok || !completeData.success || !completeData.file) {
    throw new Error(
      typeof completeData.error === 'string'
        ? completeData.error
        : 'El archivo subió, pero no pudo confirmarse en el expediente.',
    );
  }

  return { ...completeData.file, dataUrl: '' };
}
