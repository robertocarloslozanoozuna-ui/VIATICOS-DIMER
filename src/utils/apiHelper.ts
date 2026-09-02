/**
 * API Fetch Helper with Safe Error & JSON Response Handling
 * Prevents malformed server responses from crashing the UI.
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
  const isRequestCreation = url === '/api/requests' && method === 'POST';
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
      if (res.status === 404) throw new Error(`Error 404 (Ruta no encontrada): El backend en ${url} no está disponible en este despliegue.`);
      if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(`Error del servidor (${res.status}): El servicio no está respondiendo temporalmente. Intenta nuevamente en unos momentos.`);
      throw new Error(`Error del servidor (${res.status}): ${rawText.slice(0, 300)}`);
    }
    throw new Error('La respuesta del servidor no tiene un formato JSON válido.');
  }

  if (!res.ok) {
    const errorMsg = parsedData?.error || parsedData?.message || `Error en la solicitud (${res.status})`;
    throw new Error(errorMsg);
  }

  // The creation endpoint historically returns the created request directly.
  // Once it is persisted, dispatch the initial approver/requester emails through
  // the registered backend notification route. Notification failure is logged
  // but does not make the successfully saved request look like a failed request.
  const createdRequestId = isRequestCreation ? (parsedData?.request?.id || parsedData?.id) : null;
  if (createdRequestId) {
    try {
      const notifyHeaders = new Headers();
      if (token) notifyHeaders.set('Authorization', `Bearer ${token}`);
      const notifyResponse = await fetch(`/api/requests/${encodeURIComponent(String(createdRequestId))}/notify`, {
        method: 'POST',
        credentials: 'include',
        headers: notifyHeaders,
      });
      const notifyText = await notifyResponse.text();
      let notifyData: any = {};
      try { notifyData = notifyText ? JSON.parse(notifyText) : {}; } catch { notifyData = {}; }
      if (!notifyResponse.ok || notifyData?.success === false) {
        console.error('[REQUEST-NOTIFICATION]', notifyData?.error || notifyText);
      } else {
        console.info('[REQUEST-NOTIFICATION]', notifyData?.notifications || {});
      }
    } catch (notifyError) {
      console.error('[REQUEST-NOTIFICATION]', notifyError);
    }
  }

  return parsedData as T;
}
