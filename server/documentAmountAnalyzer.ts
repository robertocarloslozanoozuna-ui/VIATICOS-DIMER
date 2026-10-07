import { GoogleGenAI } from '@google/genai';
import { readPdfTotalFallback } from './pdfAmountFallback.js';

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

function markXmlAsFiscalSupport(): DocumentAmountAnalysis {
  return {
    status: 'NO_DISPONIBLE',
    documentType: 'FACTURA',
    source: 'NINGUNO',
    includedInTotal: false,
    analyzedAt: new Date().toISOString(),
    error: 'El XML CFDI se conserva como complemento fiscal y no se analiza ni se suma. El importe se obtiene del comprobante PDF.',
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

function isTransientModelError(error: any): boolean {
  const status = Number(error?.status || error?.code || error?.error?.code || 0);
  const message = String(error?.message || error || '').toUpperCase();
  return status === 429 || status === 500 || status === 502 || status === 503 ||
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
        },
      });
    } catch (error) {
      lastError = error;
      if (!isTransientModelError(error) || attempt === 2) throw error;
      // Los 503 de capacidad de Gemini suelen ser temporales; damos tiempo
      // suficiente antes de repetir para evitar golpear nuevamente al mismo backend.
      const delayMs = attempt === 1 ? 3000 : 7000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function analyzeVisualDocument(name: string, mimeType: string, dataUrl: string): Promise<DocumentAmountAnalysis> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const analyzedAt = new Date().toISOString();

  // PDF digital: intenta primero extracción determinista local.
  // Evita depender de Gemini cuando el comprobante ya contiene texto legible.
  if (mimeType === 'application/pdf') {
    const local = readPdfTotalFallback(dataUrl);
    if (local) {
      return {
        status: 'DETECTADO',
        amount: local.amount,
        documentType: local.documentType,
        confidence: local.confidence,
        source: 'PDF_LOCAL',
        includedInTotal: true,
        analyzedAt,
      };
    }
  }

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

    const contents = [
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
    ];

    const configuredModel = String(process.env.GEMINI_DOCUMENT_MODEL || 'gemini-3.8-flash').trim();
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
        console.log(`[EXPENSE-DOCUMENT-ANALYSIS] Intentando modelo ${model} para ${name}`);
        response = await generateDocumentResponse(ai, model, contents);
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(`[EXPENSE-DOCUMENT-ANALYSIS] Modelo ${model} no disponible para ${name}:`, error?.message || error);
        if (!isTransientModelError(error)) throw error;
      }
    }

    if (!response) {
      const message = String(lastError?.message || lastError || '').trim();
      throw new Error(
        message
          ? `El lector documental no estuvo disponible temporalmente. Detalle: ${message}`
          : 'No hubo un modelo disponible para analizar el documento.'
      );
    }

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
    return markXmlAsFiscalSupport();
  }

  return analyzeVisualDocument(input.fileName, mimeType, input.dataUrl);
}
