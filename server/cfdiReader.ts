export interface CfdiReadingResult {
  status: 'READ' | 'SIN_TOTAL' | 'ERROR';
  amount: number | null;
  currency: string | null;
  date: string | null;
  uuid: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  subtotal: number | null;
  error?: string;
}

function decodeXmlEntities(value: string): string {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function decodeXmlBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString('utf16le');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function attr(tag: string, key: string): string | null {
  const match = String(tag || '').match(new RegExp(`(?:^|\\s)${key}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeXmlEntities(match[1]).trim() || null : null;
}

function amount(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const normalized = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(normalized) && normalized >= 0 ? Number(normalized.toFixed(2)) : null;
}

export function readCfdiXml(buffer: Buffer): CfdiReadingResult {
  try {
    const xml = decodeXmlBuffer(buffer);
    const comprobante = xml.match(/<(?:cfdi:)?Comprobante\b[^>]*>/i)?.[0] || '';
    if (!comprobante) {
      return {
        status: 'ERROR',
        amount: null,
        currency: null,
        date: null,
        uuid: null,
        rfcEmisor: null,
        nombreEmisor: null,
        subtotal: null,
        error: 'El XML no contiene un nodo cfdi:Comprobante válido.',
      };
    }

    const total = amount(attr(comprobante, 'Total'));
    const subtotal = amount(attr(comprobante, 'SubTotal'));
    const currency = attr(comprobante, 'Moneda');
    const date = attr(comprobante, 'Fecha');

    const emisorTag = xml.match(/<(?:cfdi:)?Emisor\b[^>]*>/i)?.[0] || '';
    const rfcEmisor = attr(emisorTag, 'Rfc');
    const nombreEmisor = attr(emisorTag, 'Nombre');

    const timbreTag = xml.match(/<(?:tfd:)?TimbreFiscalDigital\b[^>]*>/i)?.[0] || '';
    const uuid = attr(timbreTag, 'UUID');

    if (total === null) {
      return {
        status: 'SIN_TOTAL',
        amount: null,
        currency,
        date,
        uuid,
        rfcEmisor,
        nombreEmisor,
        subtotal,
        error: 'El XML CFDI no contiene un atributo Total válido.',
      };
    }

    return {
      status: 'READ',
      amount: total,
      currency,
      date,
      uuid,
      rfcEmisor,
      nombreEmisor,
      subtotal,
    };
  } catch (error: any) {
    return {
      status: 'ERROR',
      amount: null,
      currency: null,
      date: null,
      uuid: null,
      rfcEmisor: null,
      nombreEmisor: null,
      subtotal: null,
      error: error?.message || 'No fue posible leer el XML CFDI.',
    };
  }
}
