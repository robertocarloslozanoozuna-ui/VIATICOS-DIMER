/**
 * API Fetch Helper with Safe Error & JSON Response Handling.
 * Mantiene /api/requests como ruta canónica de creación y, después de
 * persistir la solicitud, dispara la notificación inicial mediante el
 * endpoint administrativo ya existente. No cambia el flujo SMTP.
 */

export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('dimer_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem('dimer_token', token);
    else localStorage.removeItem('dimer_token');
  } catch (e) {
    console.warn('No se pudo guardar el token en localStorage:', e);
  }
}

export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const method = String(options?.method || 'GET').toUpperCase();
  const fetchOptions: RequestInit = { ...options, credentials: 'include', headers };

  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch (netErr: any) {
    throw new Error(`Error de conexión con el servidor (${netErr.message || 'Sin conexión'}). Por favor verifica tu red.`);
  }

  const rawText = await res.text();
  let parsedData: any = null;
  try {
    parsedData = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Ruta API no encontrada: ${url}`);
      if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(`Error del servidor (${res.status}): el servicio no está respondiendo temporalmente.`);
      throw new Error(`Error del servidor (${res.status}): ${rawText.slice(0, 300)}`);
    }
    throw new Error('La respuesta del servidor no tiene un formato JSON válido.');
  }

  if (!res.ok) {
    const errorMsg = parsedData?.error || parsedData?.message || `Error en la solicitud (${res.status})`;
    throw new Error(errorMsg);
  }

  // El POST histórico /api/requests persiste primero la solicitud. Después
  // completamos token + correo mediante /notify. Si el correo falla, NO
  // convertimos una solicitud ya guardada en un falso error de creación.
  if (url === '/api/requests' && method === 'POST') {
    const createdRequest = parsedData?.request ?? (parsedData?.id && parsedData?.folio ? parsedData : null);
    const createdRequestId = createdRequest?.id;

    if (createdRequestId) {
      try {
        const notifyHeaders = new Headers();
        if (token) notifyHeaders.set('Authorization', `Bearer ${token}`);
        notifyHeaders.set('Content-Type', 'application/json');

        const notifyRes = await fetch(`/api/requests/${encodeURIComponent(String(createdRequestId))}/notify`, {
          method: 'POST',
          credentials: 'include',
          headers: notifyHeaders,
        });

        const notifyText = await notifyRes.text();
        let notifyData: any = {};
        try {
          notifyData = notifyText ? JSON.parse(notifyText) : {};
        } catch {
          notifyData = { error: notifyText.slice(0, 500) };
        }

        parsedData.__notification = {
          httpStatus: notifyRes.status,
          success: notifyRes.ok && notifyData?.success !== false,
          ...notifyData?.notifications,
          error: notifyData?.error,
        };

        console.info('[REQUEST-NOTIFICATION]', parsedData.__notification);
      } catch (notifyError: any) {
        parsedData.__notification = {
          httpStatus: 0,
          success: false,
          error: notifyError?.message || 'No fue posible contactar el servicio de notificaciones.',
        };
        console.error('[REQUEST-NOTIFICATION]', notifyError);
      }
    }
  }

  return parsedData as T;
}
