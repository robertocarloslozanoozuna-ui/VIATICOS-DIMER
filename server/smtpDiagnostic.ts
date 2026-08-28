import crypto from 'node:crypto';

/**
 * TEMPORARY diagnostic helper.
 * Never returns or logs secret values. Remove after SMTP environment comparison.
 */
export function getSmtpEnvironmentFingerprint() {
  const read = (name: string) => process.env[name] ?? '';
  const fingerprint = (value: string) =>
    value ? crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16) : null;

  const passwordCandidates = [
    'SMTP_PASS',
    'SMTP_PASSWORD',
    'EMAIL_PASS',
    'EMAIL_PASSWORD',
    'GMAIL_APP_PASSWORD',
    'GMAIL_PASSWORD',
  ];

  const present = (name: string) => Boolean(read(name));
  const selectedPassword = passwordCandidates.find(present) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    smtpUser: read('SMTP_USER') || null,
    smtpUserFingerprint: fingerprint(read('SMTP_USER')),
    smtpHost: read('SMTP_HOST') || read('EMAIL_HOST') || null,
    smtpPort: read('SMTP_PORT') || read('EMAIL_PORT') || null,
    passwordResolution: {
      selectedVariable: selectedPassword,
      candidates: Object.fromEntries(passwordCandidates.map((name) => [name, present(name)])),
      selectedPasswordFingerprint: selectedPassword ? fingerprint(read(selectedPassword)) : null,
    },
    smtpFrom: read('SMTP_FROM') || read('EMAIL_FROM') || read('MAIL_FROM') || null,
  };
}
