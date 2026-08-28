import { createApp } from './app';
import { getSmtpEnvironmentFingerprint } from './smtpDiagnostic';

// AI Studio workaround: use a fresh secret name so a stale SMTP_PASSWORD
// value in the AI Studio secret store cannot override the current app password.
// Vercel is unaffected unless DIMER_SMTP_APP_PASSWORD is explicitly defined there.
const freshSmtpPassword = process.env.DIMER_SMTP_APP_PASSWORD?.trim();
if (freshSmtpPassword) {
  process.env.SMTP_PASSWORD = freshSmtpPassword;
}

const app = createApp();

export default function handler(req: any, res: any) {
  const path = String(req?.url || '').split('?')[0];
  if (path === '/api/smtp/environment-diagnostic' || path === '/smtp/environment-diagnostic') {
    return res.status(200).json(getSmtpEnvironmentFingerprint());
  }
  return app(req, res);
}

export { app };
