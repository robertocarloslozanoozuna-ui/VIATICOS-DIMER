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
    // If response was not valid JSON (e.g. Vercel 404 HTML page or gateway timeout)
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

  return parsedData as T;
}
