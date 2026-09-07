import type { Request } from 'express';

const INVALID_DOMAINS = [
  'viaticos.dimer.mx',
  'ai.studio',
  'aistudio.google.com',
  'localhost',
  '127.0.0.1'
];

function isInvalidDomain(urlOrHost: string): boolean {
  if (!urlOrHost) return true;
  const lower = urlOrHost.toLowerCase();
  return INVALID_DOMAINS.some(bad => lower.includes(bad));
}

/**
 * Resuelve la URL base canónica para enlaces de aprobación y notificaciones por correo.
 * Protegido contra dominios sin configuración DNS (como viaticos.dimer.mx) que causan
 * el error DNS_PROBE_FINISHED_NXDOMAIN, y URLs internas de AI Studio.
 */
export function resolveBaseUrl(req?: Request): string {
  // 1. Si la petición entrante tiene encabezado Origin o Referer funcional
  if (req) {
    const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
    if (origin && origin.startsWith('http') && !isInvalidDomain(origin)) {
      return origin;
    }

    const referer = String(req.headers.referer || '').trim();
    if (referer && referer.startsWith('http')) {
      try {
        const refUrl = new URL(referer);
        if (!isInvalidDomain(refUrl.hostname)) {
          return `${refUrl.protocol}//${refUrl.host}`;
        }
      } catch {}
    }

    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (rawHost && !isInvalidDomain(rawHost)) {
      const isHttps = Boolean(
        rawHost.includes('run.app') ||
        rawHost.includes('vercel.app') ||
        req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL
      );
      const proto = isHttps ? 'https' : (req.headers['x-forwarded-proto'] || 'http');
      return `${proto}://${rawHost}`;
    }

    // Si viene de Cloud Run (ej. ais-dev-*.run.app)
    if (rawHost && rawHost.includes('run.app')) {
      return `https://${rawHost}`;
    }
  }

  // 2. Variables de entorno explícitas
  const configured = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured && !isInvalidDomain(configured)) {
    return configured.startsWith('http') ? configured : `https://${configured}`;
  }

  // 3. Variables de entorno Cloud Run (ais-dev-*.run.app o ais-pre-*.run.app)
  const allowedHost = String(process.env.NG_ALLOWED_HOSTS || '').split(',')[0].trim();
  if (allowedHost && allowedHost.includes('run.app') && !isInvalidDomain(allowedHost)) {
    return `https://${allowedHost}`;
  }

  // 4. Variables de NextAuth / Vercel (filtrando dominios sin DNS como viaticos.dimer.mx)
  const nextAuthUrl = (process.env.NEXTAUTH_URL || '').trim().replace(/\/+$/, '');
  if (nextAuthUrl && !isInvalidDomain(nextAuthUrl)) {
    return nextAuthUrl.startsWith('http') ? nextAuthUrl : `https://${nextAuthUrl}`;
  }

  const vercelProd = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim().replace(/\/+$/, '');
  if (vercelProd && !isInvalidDomain(vercelProd)) {
    return `https://${vercelProd}`;
  }

  const vercelUrl = (process.env.VERCEL_URL || '').trim().replace(/\/+$/, '');
  if (vercelUrl && !isInvalidDomain(vercelUrl)) {
    return `https://${vercelUrl}`;
  }

  // 5. Fallback canónico para producción / Vercel (garantiza que el botón del correo NUNCA dé NXDOMAIN ni mande a AI Studio)
  return 'https://viaticos-dimer.vercel.app';
}

export const baseUrl = resolveBaseUrl;

