import type { Request } from 'express';

type ErrorContext = {
  source?: string;
  statusCode?: number;
  requestId?: string;
  folio?: string;
  userId?: string;
  extra?: Record<string, unknown>;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'UnknownError', message: String(error), stack: undefined };
}

function sanitizeHeaders(req: Request) {
  const headers = { ...req.headers } as Record<string, unknown>;
  delete headers.authorization;
  delete headers.cookie;
  delete headers['x-api-key'];
  return headers;
}

export function logSystemError(error: unknown, req?: Request, context: ErrorContext = {}) {
  const serialized = serializeError(error);
  const user = req ? (req as any).dimerUser : undefined;
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    source: context.source || 'server',
    message: serialized.message,
    errorName: serialized.name,
    stack: serialized.stack,
    statusCode: context.statusCode,
    requestId: context.requestId,
    folio: context.folio,
    userId: context.userId || user?.id,
    userEmail: user?.email,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    ip: req?.ip,
    userAgent: req?.get('user-agent'),
    headers: req ? sanitizeHeaders(req) : undefined,
    extra: context.extra,
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node',
    vercelRequestId: req?.get('x-vercel-id'),
  };

  // Structured JSON is visible in Vercel Runtime Logs and is also easy to
  // search/filter locally. Never throw from the logger itself.
  try {
    console.error('[DIMER-SYSTEM-ERROR]', JSON.stringify(entry));
  } catch {
    console.error('[DIMER-SYSTEM-ERROR]', serialized.message);
  }
}

export function registerProcessErrorLogging() {
  process.on('uncaughtException', (error) => {
    logSystemError(error, undefined, { source: 'uncaughtException' });
  });

  process.on('unhandledRejection', (reason) => {
    logSystemError(reason, undefined, { source: 'unhandledRejection' });
  });
}
