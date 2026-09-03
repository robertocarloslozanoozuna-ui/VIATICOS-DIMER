/**
 * API Fetch Helper with Safe Error & JSON Response Handling.
 * Provides resilient fetch, cookie/token authentication, and safe JSON parsing.
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

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  return fetch(url, { ...options, credentials: 'include', headers });
}

export async function safeParseResponseJson<T = any>(res: Response, fallback: T | null = null): Promise<T | null> {
  try {
    const rawText = await res.text();
    if (!rawText || rawText.trim().startsWith('<')) {
      return fallback;
    }
    return JSON.parse(rawText) as T;
  } catch {
    return fallback;
  }
}

export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

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

  if (rawText && !rawText.trim().startsWith('<')) {
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = null;
    }
  }

  if (parsedData === null) {
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Ruta API no encontrada: ${url}`);
      if (res.status === 401 || res.status === 403) throw new Error(`Sesión no autorizada o expirada (${res.status}).`);
      if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(`El servidor está iniciando o no responde temporalmente (${res.status}).`);
      throw new Error(`Error del servidor (${res.status}).`);
    }
    // If 200 OK but returned HTML, fallback to empty object / array depending on expected type
    return {} as T;
  }

  if (!res.ok) {
    const rawError = parsedData?.error ?? parsedData?.message;
    const errorMsg = typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object'
        ? String(rawError.message || rawError.error_description || rawError.error || rawError.details || rawError.hint || `Error en la solicitud (${res.status})`)
        : `Error en la solicitud (${res.status})`;
    throw new Error(errorMsg);
  }

  return parsedData as T;
}
