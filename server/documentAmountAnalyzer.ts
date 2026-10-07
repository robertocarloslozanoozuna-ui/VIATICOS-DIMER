import { GoogleGenAI } from '@google/genai';
import { extractPdfTextFromDataUrl, readPdfTotalFallback } from './pdfAmountFallback.js';

export type DocumentAnalysisStatus = 'DETECTADO' | 'SIN_TOTAL' | 'NO_DISPONIBLE' | 'ERROR';
export type DocumentDetectedType = 'FACTURA' | 'TICKET' | 'OTRO';

export interface DocumentAmountAnalysis {
  status: DocumentAnalysisStatus;
  amount?: number;
  documentType?: DocumentDetectedType;
  confidence?: 'ALTA' | 'MEDIA' | 'BAJA';
  source: 'XML' | 'GEMINI' | 'PDF_LOCAL' | 'NINGUNO';
  includedInTotal: boolean;
  requiresReview?: boolean;
  candidates?: Array<{
    method: 'xml' | 'qr' | 'texto_pdf' | 'llm' | 'ocr' | 'pdf_local';
    total: number | null;
  }>;
  detail?: {
    subtotal?: number | null;
    iva?: number | null;
    propina?: number | null;
    moneda?: string | null;
    fecha?: string | null;
    emisor?: string | null;
    uuid?: string | null;
  };
  analyzedAt: string;
  error?: string;
}

function extensionOf(name: string): string {
  return String(name || '').toLowerCase().split('.').pop() || '';
}

function mimeOf(name: string, declaredType?: string): string {
  const declared = String(declaredType || '').trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream') return declared;

  switch (extensionOf(name)) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'xml': return 'application/xml';
    default: return declared || 'application/octet-stream';
  }
}

function base64Payload(dataUrl: string): string {
  const match = String(dataUrl || '').match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error('Contenido de archivo inválido para análisis.');
  return match[1];
}

function normalizeAmount(value: unknown): number | undefined {
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[$,\s]/g, ''));

  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Number(numeric.toFixed(2));
}

function normalizeNonNegativeAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[$,\s]/g, ''));

  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Number(numeric.toFixed(2));
}

function cleanOptionalText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function decodeXmlEntities(value: string): string {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function xmlAttribute(tag: string, attribute: string): string | null {
  const match = String(tag || '').match(
    new RegExp(attribute + '=["\\\']([^"\\\']*)["\\\']', 'i')
  );
  return match ? decodeXmlEntities(match[1]).trim() || null : null;
}

function readXmlFiscalDetails(dataUrl: string) {
  try {
    const xml = Buffer.from(base64Payload(dataUrl), 'base64').toString('utf8');
    const comprobante = xml.match(/<(?:cfdi:)?Comprobante\b[^>]*>/i)?.[0] || '';
    const emisor = xml.match(/<(?:cfdi:)?Emisor\b[^>]*>/i)?.[0] || '';
    const timbre = xml.match(/<(?:tfd:)?TimbreFiscalDigital\b[^>]*>/i)?.[0] || '';

    return {
      moneda: xmlAttribute(comprobante, 'Moneda'),
      fecha: xmlAttribute(comprobante, 'Fecha'),
      emisor: xmlAttribute(emisor, 'Nombre') || xmlAttribute(emisor, 'Rfc'),
      uuid: xmlAttribute(timbre, 'UUID'),
    };
  } catch {
    return {
      moneda: null,
      fecha: null,
      emisor: null,
      uuid: null,
    };
  }
}

function markXmlAsFiscalSupport(dataUrl: string): DocumentAmountAnalysis {
  return {
    status: 'DETECTADO',
    documentType: 'FACTURA',
    source: 'XML',
    confidence: 'ALTA',
    includedInTotal: false,
    requiresReview: false,
    candidates: [],
    detail: readXmlFiscalDetails(dataUrl),
    analyzedAt: new Date().toISOString(),
    error: 'XML CFDI conservado como complemento fiscal. Su importe no se suma; el gasto se obtiene del comprobante principal.',
  };
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    documentType: {
      type: 'string',
      enum: ['FACTURA', 'TICKET', 'OTRO'],
      description: 'Tipo del comprobante visible en el documento.',
    },
    total: {
      type: ['number', 'null'],
      description: 'Importe FINAL pagado o TOTAL A PAGAR. Nunca devolver subtotal, IVA, propina, efectivo recibido, cambio, saldo, autorización bancaria u otro importe parcial.',
    },
    subtotal: {
      type: ['number', 'null'],
      description: 'Subtotal visible, si existe.',
    },
    iva: {
      type: ['number', 'null'],
      description: 'IVA trasladado visible, si existe. No inventar.',
    },
    propina: {
      type: ['number', 'null'],
      description: 'Propina visible por separado, si existe.',
    },
    moneda: {
      type: ['string', 'null'],
      description: 'Moneda visible del comprobante, por ejemplo MXN.',
    },
    fecha: {
      type: ['string', 'null'],
      description: 'Fecha del comprobante, si es legible.',
    },
    emisor: {
      type: ['string', 'null'],
      description: 'Razón social o nombre comercial del emisor, si es legible.',
    },
    uuid: {
      type: ['string', 'null'],
      description: 'UUID del CFDI, cuando esté visible.',
    },
    confidence: {
      type: 'string',
      enum: ['ALTA', 'MEDIA', 'BAJA'],
      description: 'Confianza considerando legibilidad y evidencia visible.',
    },
  },
  required: [
    'documentType',
    'total',
    'subtotal',
    'iva',
    'propina',
    'moneda',
    'fecha',
    'emisor',
    'uuid',
    'confidence',
  ],
};

function isTransientModelError(error: any): boolean {
  const status = Number(error?.status || error?.code || error?.error?.code || 0);
  const message = String(error?.message || error || '').toUpperCase();

  return status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    message.includes('TIMEOUT') ||
    message.includes('UNAVAILABLE') ||
    message.includes('HIGH DEMAND') ||
    message.includes('RESOURCE EXHAUSTED') ||
    message.includes('RATE LIMIT');
}

async function generateDocumentResponse(
  ai: GoogleGenAI,
  model: string,
  contents: any[],
) {
  let lastError: any;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
    } catch (error) {
      lastError = error;
      if (!isTransientModelError(error) || attempt === 2) throw error;

      const delayMs = attempt === 1 ? 3000 : 7000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function analyzeVisualDocument(
  name: string,
  mimeType: string,
  dataUrl: string,
): Promise<DocumentAmountAnalysis> {
  const analyzedAt = new Date().toISOString();

  // PDF digital: primero intenta una extracción determinista local.
  if (mimeType === 'application/pdf') {
    const local = readPdfTotalFallback(dataUrl);

    if (local) {
      console.log(
        '[EXPENSE-DOCUMENT-ANALYSIS] PDF local detectado ' +
        name +
        ' total=' +
        local.amount
      );

      const localRequiresReview = local.documentType === 'OTRO';
      return {
        status: 'DETECTADO',
        amount: local.amount,
        documentType: local.documentType,
        confidence: localRequiresReview ? 'BAJA' : local.confidence,
        source: 'PDF_LOCAL',
        includedInTotal: !localRequiresReview,
        requiresReview: localRequiresReview,
        candidates: [{ method: 'texto_pdf', total: local.amount }],
        analyzedAt,
      };
    }
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return {
      status: 'NO_DISPONIBLE',
      source: 'NINGUNO',
      includedInTotal: false,
      requiresReview: true,
      analyzedAt,
      error: 'GEMINI_API_KEY no está configurada y no fue posible obtener el importe por una capa local.',
    };
  }

  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return {
      status: 'NO_DISPONIBLE',
      source: 'NINGUNO',
      includedInTotal: false,
      requiresReview: true,
      analyzedAt,
      error: 'El tipo de archivo no admite lectura automática de importe.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const data = base64Payload(dataUrl);
    const pdfText = mimeType === 'application/pdf'
      ? extractPdfTextFromDataUrl(dataUrl)
      : '';

    const textContext = pdfText
      ? [
          'Texto nativo extraído automáticamente del PDF.',
          'Puede estar incompleto o fuera de orden; úsalo solamente como evidencia adicional.',
          pdfText.slice(0, 20000),
        ].join('\n')
      : 'No existe texto nativo confiable disponible. Utiliza la evidencia visual del documento.';

    const contents = [
      {
        text: [
          'Actúa como lector documental de VIÁTICOS DIMER.',
          'Identifica si el comprobante es FACTURA, TICKET u OTRO.',
          'Encuentra exclusivamente el importe FINAL pagado o TOTAL A PAGAR.',
          'NO confundas el total con subtotal, IVA, propina, efectivo recibido, cambio, saldo, autorización de tarjeta, folio o cualquier importe parcial.',
          'Si existe propina, regístrala solamente en propina.',
          'Si el total no se puede leer con certeza, devuelve total=null. Nunca adivines.',
          'Devuelve únicamente el JSON solicitado por el esquema.',
          textContext,
          'Nombre de archivo: ' + name,
        ].join('\n'),
      },
      {
        inlineData: {
          mimeType,
          data,
        },
      },
    ];

    const configuredModel = String(
      process.env.GEMINI_DOCUMENT_MODEL || 'gemini-3.8-flash'
    ).trim();

    const modelsToTry = Array.from(new Set([
      configuredModel,
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
    ]));

    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(
          '[EXPENSE-DOCUMENT-ANALYSIS] Intentando modelo ' +
          model +
          ' para ' +
          name
        );

        response = await generateDocumentResponse(ai, model, contents);
        break;
      } catch (error: any) {
        lastError = error;

        console.warn(
          '[EXPENSE-DOCUMENT-ANALYSIS] Modelo ' +
          model +
          ' no disponible para ' +
          name +
          ': ' +
          (error?.message || error)
        );

        if (!isTransientModelError(error)) throw error;
      }
    }

    if (!response) {
      throw lastError || new Error('No hubo un modelo disponible para analizar el documento.');
    }

    const rawText = String(response.text || '').trim();
    const parsed = JSON.parse(rawText) as {
      documentType?: string;
      total?: number | null;
      subtotal?: number | null;
      iva?: number | null;
      propina?: number | null;
      moneda?: string | null;
      fecha?: string | null;
      emisor?: string | null;
      uuid?: string | null;
      confidence?: string;
    };

    const documentType: DocumentDetectedType =
      parsed.documentType === 'FACTURA' || parsed.documentType === 'TICKET'
        ? parsed.documentType
        : 'OTRO';

    const modelConfidence =
      parsed.confidence === 'ALTA' ||
      parsed.confidence === 'MEDIA' ||
      parsed.confidence === 'BAJA'
        ? parsed.confidence
        : 'BAJA';

    const amount = normalizeAmount(parsed.total);
    const requiresReview =
      amount === undefined ||
      modelConfidence === 'BAJA' ||
      documentType === 'OTRO';

    const detail = {
      subtotal: normalizeNonNegativeAmount(parsed.subtotal),
      iva: normalizeNonNegativeAmount(parsed.iva),
      propina: normalizeNonNegativeAmount(parsed.propina),
      moneda: cleanOptionalText(parsed.moneda),
      fecha: cleanOptionalText(parsed.fecha),
      emisor: cleanOptionalText(parsed.emisor),
      uuid: cleanOptionalText(parsed.uuid),
    };

    const candidates = [{
      method: 'llm' as const,
      total: amount ?? null,
    }];

    if (amount === undefined) {
      return {
        status: 'SIN_TOTAL',
        documentType,
        confidence: 'BAJA',
        source: 'GEMINI',
        includedInTotal: false,
        requiresReview: true,
        candidates,
        detail,
        analyzedAt,
        error: 'No se detectó un importe final confiable.',
      };
    }

    const finalConfidence =
      requiresReview ? 'BAJA' : (modelConfidence === 'BAJA' ? 'BAJA' : 'MEDIA');

    return {
      status: 'DETECTADO',
      amount,
      documentType,
      confidence: finalConfidence,
      source: 'GEMINI',
      includedInTotal: documentType === 'FACTURA' || documentType === 'TICKET',
      requiresReview,
      candidates,
      detail,
      analyzedAt,
    };
  } catch (error: any) {
    console.error('[EXPENSE-DOCUMENT-ANALYSIS-ERROR]', error);

    return {
      status: 'ERROR',
      source: 'GEMINI',
      includedInTotal: false,
      requiresReview: true,
      analyzedAt,
      error: error?.message || 'No fue posible analizar el documento.',
    };
  }
}

export async function analyzeDocumentAmount(input: {
  fileName: string;
  fileType?: string;
  dataUrl: string;
}): Promise<DocumentAmountAnalysis> {
  const ext = extensionOf(input.fileName);
  const mimeType = mimeOf(input.fileName, input.fileType);

  if (ext === 'xml' || mimeType === 'application/xml' || mimeType === 'text/xml') {
    return markXmlAsFiscalSupport(input.dataUrl);
  }

  return analyzeVisualDocument(
    input.fileName,
    mimeType,
    input.dataUrl
  );
}
