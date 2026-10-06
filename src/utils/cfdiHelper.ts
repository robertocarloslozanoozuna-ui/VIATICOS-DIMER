/**
 * Helper para análisis y validación de comprobantes fiscales digitales CFDI (XML)
 * DIMER VIÁTICOS.
 *
 * REGLA DE ORO:
 * El XML CFDI es estrictamente un COMPLEMENTO FISCAL del comprobante.
 * No representa una partida de gasto por sí mismo, no suma a los balances
 * financieros ni altera importes.
 */

export function extractCfdiUuid(xmlStringOrDataUrl: string): string | null {
  try {
    let xmlContent = xmlStringOrDataUrl;
    if (xmlStringOrDataUrl.startsWith('data:')) {
      const commaIdx = xmlStringOrDataUrl.indexOf(',');
      if (commaIdx >= 0) {
        const base64Data = xmlStringOrDataUrl.substring(commaIdx + 1);
        if (typeof Buffer !== 'undefined') {
          xmlContent = Buffer.from(base64Data, 'base64').toString('utf8');
        } else if (typeof atob !== 'undefined') {
          try {
            xmlContent = decodeURIComponent(escape(atob(base64Data)));
          } catch {
            xmlContent = atob(base64Data);
          }
        }
      }
    }

    // Match attribute UUID in cfdi:TimbreFiscalDigital or general XML
    const match = xmlContent.match(/UUID\s*=\s*["']([A-Fa-f0-9-]{36})["']/i);
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Valida si un texto es un archivo XML CFDI reconocible
 */
export function isCfdiXml(xmlStringOrDataUrl: string): boolean {
  try {
    let content = xmlStringOrDataUrl;
    if (xmlStringOrDataUrl.startsWith('data:')) {
      const commaIdx = xmlStringOrDataUrl.indexOf(',');
      if (commaIdx >= 0) {
        const base64Data = xmlStringOrDataUrl.substring(commaIdx + 1);
        if (typeof Buffer !== 'undefined') {
          content = Buffer.from(base64Data, 'base64').toString('utf8');
        } else if (typeof atob !== 'undefined') {
          try {
            content = decodeURIComponent(escape(atob(base64Data)));
          } catch {
            content = atob(base64Data);
          }
        }
      }
    }
    return content.includes('cfdi:Comprobante') || content.includes('<Comprobante') || content.includes('cfdi:');
  } catch {
    return false;
  }
}
