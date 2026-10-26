/**
 * Resolve multiple addresses for approved-request notifications.
 *
 * FINANZAS_EMAILS supports comma-, semicolon-, or newline-separated addresses.
 * The legacy FINANZAS_EMAIL / FINANZAS_URL settings remain supported when the
 * plural variable is unset or contains no valid addresses.
 */
function parseEmails(value: string | undefined): string[] {
  return Array.from(new Set(
    String(value || '')
      .split(/[,;\r\n]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email))
  ));
}

export function getFinanceNotificationRecipients(): string[] {
  const pluralRecipients = parseEmails(process.env.FINANZAS_EMAILS);
  if (pluralRecipients.length > 0) return pluralRecipients;

  return parseEmails(process.env.FINANZAS_EMAIL || process.env.FINANZAS_URL);
}
