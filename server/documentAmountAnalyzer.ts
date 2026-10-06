import { GoogleGenAI } from '@google/genai';

export type DocumentAnalysisStatus = 'DETECTADO' | 'SIN_TOTAL' | 'NO_DISPONIBLE' | 'ERROR';
export type DocumentDetectedType = 'FACTURA' | 'TICKET' | 'OTRO';

export interface DocumentAmountAnalysis {
  status: DocumentAnalysisStatus;
  amount?: number;
  documentType?: DocumentDetectedType;
  confidence?: 'ALTA' | 'MEDIA' | 'BAJA';
  source: 'XML' | 'GEMINI' | 'NINGUNO';
  includedInTotal: boolean;
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

function analyzeXml(dataUrl: string): DocumentAmountAnalysis {
  const payload = base64Payload(dataUrl);
  const xml = Buffer.from(payload, 'base64').toString('utf8').replace(/^\uFEFF/, '');
  const rootMatch =
    xml.match(/<[^>]*Comprobante\b[^>]*\bTotal\s*=\s*["']([^"']+)["']/i) ||
    xml.match(/<[^>]*Comprobante\b[^>]*\btotal\s*=\s*["']([^"']+)["']/i);

  const amount = normalizeAmount(rootMatch?.[1]);
  const analyzedAt = new Date().toISOString();

  if (amount === undefined) {
    return {
      status: 'SIN_TOTAL',
      documentType: 'FACTURA',
      confidence: 'ALTA',
      source: 'XML',
      includedInTotal: false,
      analyzedAt,
      error: 'No se encontró un atributo Total válido en el CFDI.',
    };
  }

  return {
    status: 'DETECTADO',
    amount,
    documentType: 'FACTURA',
    confidence: 'ALTA',
    source: 'XML',
    includedInTotal: false,
    analyzedAt,
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
      description: 'Importe final pagado o total a pagar. No usar subtotal, IVA, propina ni autorizaciones parciales.',
    },
    confidence: {
      type: 'string',
      enum: ['ALTA', 'MEDIA', 'BAJA'],
      description: 'Confianza en la identificación del total.',
    },
  },
  required: ['documentType', 'total', 'confidence'],
};

async function analyzeVisualDocument(name: string, mimeType: string, dataUrl: string): Promise<DocumentAmountAnalysis> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const analyzedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      status: 'NO_DISPONIBLE',
      source: 'NINGUNO',
      includedInTotal: false,
      analyzedAt,
      error: 'GEMINI_API_KEY no está configurada.',
    };
  }

  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return {
      status: 'NO_DISPONIBLE',
      source: 'NINGUNO',
      includedInTotal: false,
      analyzedAt,
      error: 'El tipo de archivo no admite lectura automática de importe.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const data = base64Payload(dataUrl);

    const response = await ai.models.generateContent({
      model: String(process.env.GEMINI_DOCUMENT_MODEL || 'gemini-3.8-flash').trim(),
      contents: [
        {
          text: [
            'Analiza este comprobante de gastos de DIMER.',
            'Identifica si el documento es FACTURA, TICKET u OTRO.',
            'Encuentra exclusivamente el importe FINAL que la persona pagó o el TOTAL A PAGAR.',
            'No uses subtotal, IVA, propina, cambio, saldo, autorización de tarjeta, folios ni otros importes parciales.',
            'Si hay varios totales, elige el que represente el total final de la operación.',
            'Si no existe un total claramente legible, devuelve total=null.',
            'No inventes números.',
            'Nombre de archivo: ' + name,
          ].join('\n'),
        },
        {
          inlineData: {
            mimeType,
            data,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const rawText = String(response.text || '').trim();
    const parsed = JSON.parse(rawText) as {
      documentType?: string;
      total?: number | null;
      confidence?: string;
    };

    const documentType: DocumentDetectedType =
      parsed.documentType === 'FACTURA' || parsed.documentType === 'TICKET'
        ? parsed.documentType
        : 'OTRO';

    const confidence =
      parsed.confidence === 'ALTA' || parsed.confidence === 'MEDIA' || parsed.confidence === 'BAJA'
        ? parsed.confidence
        : 'BAJA';

    const amount = normalizeAmount(parsed.total);

    if (amount === undefined) {
      return {
        status: 'SIN_TOTAL',
        documentType,
        confidence,
        source: 'GEMINI',
        includedInTotal: false,
        analyzedAt,
        error: 'No se detectó un importe final confiable.',
      };
    }

    return {
      status: 'DETECTADO',
      amount,
      documentType,
      confidence,
      source: 'GEMINI',
      includedInTotal: documentType === 'FACTURA' || documentType === 'TICKET',
      analyzedAt,
    };
  } catch (error: any) {
    console.error('[EXPENSE-DOCUMENT-ANALYSIS-ERROR]', error);
    return {
      status: 'ERROR',
      source: 'GEMINI',
      includedInTotal: false,
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
    try {
      return analyzeXml(input.dataUrl);
    } catch (error: any) {
      return {
        status: 'ERROR',
        source: 'XML',
        includedInTotal: false,
        analyzedAt: new Date().toISOString(),
        error: error?.message || 'No fue posible leer el XML CFDI.',
      };
    }
  }

  return analyzeVisualDocument(input.fileName, mimeType, input.dataUrl);
}
