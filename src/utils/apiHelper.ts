/**
 * API Fetch Helper with Safe Error & JSON Response Handling
 * Prevents "Unexpected token 'T', 'The page c'... is not valid JSON" errors
 * when serverless endpoints return 404/500 HTML pages.
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
    if (token) {
      localStorage.setItem('dimer_token', token);
    } else {
      localStorage.removeItem('dimer_token');
    }
  } catch (e) {
    console.warn('No se pudo guardar el token en localStorage:', e);
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch (netErr: any) {
    throw new Error(
      `Error de conexión con el servidor (${netErr.message || 'Sin conexión'}). Por favor verifica tu red.`
    );
  }

  const rawText = await res.text();
  let parsedData: any = null;

  try {
    parsedData = rawText ? JSON.parse(rawText) : {};
  } catch (jsonErr) {
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          `Error 404 (Ruta no encontrada): El backend en ${url} no está disponible en este despliegue. Si estás en Vercel, verifica que el archivo vercel.json y las funciones API estén habilitadas.`
        );
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error(
          `Error del servidor (${res.status}): El servicio no está respondiendo temporalmente. Intenta nuevamente en unos momentos.`
        );
      }
      throw new Error(
        `Error del servidor (${res.status}): ${rawText.slice(0, 150)}`
      );
    }
    throw new Error(
      'La respuesta del servidor no tiene un formato JSON válido.'
    );
  }

  if (!res.ok) {
    const errorMsg =
      parsedData?.error ||
      parsedData?.message ||
      `Error en la solicitud (${res.status})`;
    throw new Error(errorMsg);
  }

  // El backend actual registra la solicitud primero y la notificación inicial
  // se despacha en un segundo paso. Mantenerlo aquí evita tocar el flujo SMTP
  // y el endpoint histórico de creación de solicitudes.
  const method = String(options?.method || 'GET').toUpperCase();
  const isRequestCreation = url === '/api/requests' && method === 'POST';
  const createdRequestId = parsedData?.request?.id || parsedData?.id;
  if (isRequestCreation && createdRequestId) {
    try {
      const notifyHeaders = new Headers();
      if (token) notifyHeaders.set('Authorization', `Bearer ${token}`);
      const notifyResponse = await fetch(
        `/api/requests/${encodeURIComponent(String(createdRequestId))}/notify`,
        {
          method: 'POST',
          credentials: 'include',
          headers: notifyHeaders,
        }
      );
      const notifyText = await notifyResponse.text();
      let notifyData: any = {};
      try {
        notifyData = notifyText ? JSON.parse(notifyText) : {};
      } catch {
        notifyData = {};
      }
      if (!notifyResponse.ok || notifyData?.success === false) {
        console.error('[REQUEST-NOTIFICATION] No se pudieron enviar todas las notificaciones:', notifyData?.error || notifyText);
      } else {
        console.log('[REQUEST-NOTIFICATION] Notificaciones iniciales enviadas:', notifyData?.notifications || {});
      }
    } catch (notifyError) {
      console.error('[REQUEST-NOTIFICATION] Error al despachar notificaciones:', notifyError);
    }
  }

  return parsedData as T;
}
