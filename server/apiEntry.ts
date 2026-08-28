import { createApp } from './app';
import { getSmtpEnvironmentFingerprint } from './smtpDiagnostic';

const app = createApp();

export default function handler(req: any, res: any) {
  const path = String(req?.url || '').split('?')[0];
  if (path === '/api/smtp/environment-diagnostic' || path === '/smtp/environment-diagnostic') {
    return res.status(200).json(getSmtpEnvironmentFingerprint());
  }
  return app(req, res);
}

export { app };
