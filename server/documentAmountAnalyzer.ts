import type { ExpenseDocumentAnalysis } from '../src/types.js';

function base64Payload(dataUrl: string): string {
  const match = String(dataUrl || '').match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error('Contenido de archivo inválido para análisis.');
  return match[1];
}

function extensionOf(name: string): string {
  return String(name || '').toLowerCase().split('.').pop() || '';
}

function decodeXmlEntities(value: string): string {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function decodeXmlBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  let zeroEven = 0;
  let zeroOdd = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) {
      if (i % 2 === 0) zeroEven += 1;
      else zeroOdd += 1;
    }
  }
  if (zeroOdd > 10 && zeroOdd > zeroEven * 2) return buffer.toString('utf16le');
  if (zeroEven > 10 && zeroEven > zeroOdd * 2) {
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i + 1 < buffer.length; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }

  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function xmlAttribute(tag: string, attribute: string): string | null {
  const match = String(tag || '').match(
    new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, 'i')
  );
  return match ? decodeXmlEntities(match[1]).trim() || null : null;
}

function normalizeAmount(value: unknown): number | undefined {
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[$,\s]/g, ''));

  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Number(numeric.toFixed(2));
}

/**
 * Lectura determinista del CFDI.
 * No usa Gemini, OCR ni extracción de PDF: el único documento que se lee
 * automáticamente en este módulo es el XML fiscal.
 */
function analyzeXml(dataUrl: string): ExpenseDocumentAnalysis {
  const analyzedAt = new Date().toISOString();

  try {
    const xml = decodeXmlBuffer(Buffer.from(base64Payload(dataUrl), 'base64'));
    const comprobante = xml.match(/<(?:cfdi:)?Comprobante\b[^>]*>/i)?.[0] || '';

    if (!comprobante) {
      return {
        status: 'ERROR',
        source: 'XML',
        includedInTotal: false,
        requiresReview: true,
        analyzedAt,
        error: 'El XML no contiene un nodo cfdi:Comprobante válido.',
      };
    }

    const total = normalizeAmount(xmlAttribute(comprobante, 'Total'));
    const emisorTag = xml.match(/<(?:cfdi:)?Emisor\b[^>]*>/i)?.[0] || '';
    const timbreTag = xml.match(/<(?:tfd:)?TimbreFiscalDigital\b[^>]*>/i)?.[0] || '';

    const detail = {
      moneda: xmlAttribute(comprobante, 'Moneda'),
      fecha: xmlAttribute(comprobante, 'Fecha'),
      emisor: xmlAttribute(emisorTag, 'Nombre') || xmlAttribute(emisorTag, 'Rfc'),
      uuid: xmlAttribute(timbreTag, 'UUID'),
    };

    if (total === undefined) {
      return {
        status: 'SIN_TOTAL',
        documentType: 'FACTURA',
        confidence: 'BAJA',
        source: 'XML',
        includedInTotal: false,
        requiresReview: true,
        candidates: [{ method: 'xml', total: null }],
        detail,
        analyzedAt,
        error: 'El XML CFDI no contiene un atributo Total válido.',
      };
    }

    return {
      status: 'DETECTADO',
      amount: total,
      documentType: 'FACTURA',
      confidence: 'ALTA',
      source: 'XML',
      // Se usa para el Total detectado de comprobantes, nunca para crear
      // ni modificar una partida de gasto.
      includedInTotal: true,
      requiresReview: false,
      candidates: [{ method: 'xml', total }],
      detail,
      analyzedAt,
    };
  } catch (error: any) {
    return {
      status: 'ERROR',
      source: 'XML',
      includedInTotal: false,
      requiresReview: true,
      analyzedAt,
      error: error?.message || 'No fue posible leer el XML CFDI.',
    };
  }
}

export async function analyzeDocumentAmount(input: {
  fileName: string;
  fileType?: string;
  dataUrl: string;
}): Promise<ExpenseDocumentAnalysis> {
  const ext = extensionOf(input.fileName);

  if (ext !== 'xml') {
    return {
      status: 'NO_DISPONIBLE',
      source: 'NINGUNO',
      includedInTotal: false,
      requiresReview: false,
      analyzedAt: new Date().toISOString(),
      error: 'La lectura automática está deshabilitada para PDF e imágenes. Capture el total manualmente.',
    };
  }

  return analyzeXml(input.dataUrl);
}
