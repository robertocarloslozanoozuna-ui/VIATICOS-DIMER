import { inflateRawSync, inflateSync } from 'zlib';

export interface PdfAmountFallbackResult {
  amount: number;
  documentType: 'FACTURA' | 'TICKET' | 'OTRO';
  confidence: 'ALTA' | 'MEDIA';
}

function decodeLiteral(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== '\\') {
      result += input[i];
      continue;
    }

    i += 1;
    if (i >= input.length) break;
    const escaped = input[i];

    if (escaped === 'n') result += '\n';
    else if (escaped === 'r') result += '\r';
    else if (escaped === 't') result += '\t';
    else if (escaped === 'b') result += '\b';
    else if (escaped === 'f') result += '\f';
    else if (escaped === '(' || escaped === ')' || escaped === '\\') result += escaped;
    else if (/[0-7]/.test(escaped)) {
      let octal = escaped;
      for (let j = 0; j < 2 && i + 1 < input.length && /[0-7]/.test(input[i + 1]); j += 1) {
        i += 1;
        octal += input[i];
      }
      result += String.fromCharCode(parseInt(octal, 8));
    } else {
      result += escaped;
    }
  }
  return result;
}

function extractTextFromPdf(data: Buffer): string {
  const chunks: string[] = [];
  const streamToken = Buffer.from('stream');
  const endStreamToken = Buffer.from('endstream');
  const objectToken = Buffer.from('obj');
  let cursor = 0;

  while (cursor < data.length) {
    const streamStartMarker = data.indexOf(streamToken, cursor);
    if (streamStartMarker < 0) break;

    const streamEndMarker = data.indexOf(endStreamToken, streamStartMarker + streamToken.length);
    if (streamEndMarker < 0) break;

    const objectStart = Math.max(0, data.lastIndexOf(objectToken, streamStartMarker - 1));
    const dictionary = data.subarray(objectStart, streamStartMarker).toString('latin1');

    let streamDataStart = streamStartMarker + streamToken.length;
    if (data[streamDataStart] === 0x0d) streamDataStart += 1;
    if (data[streamDataStart] === 0x0a) streamDataStart += 1;

    const rawStream = data.subarray(streamDataStart, streamEndMarker);
    let streamData = rawStream;

    if (/\/FlateDecode\b/i.test(dictionary)) {
      try {
        streamData = inflateSync(rawStream);
      } catch {
        try {
          streamData = inflateRawSync(rawStream);
        } catch {
          streamData = Buffer.alloc(0);
        }
      }
    }

    if (streamData.length > 0) {
      const streamText = streamData.toString('latin1');

      const literalMatches = streamText.match(/\((?:\\.|[^\\)])*\)/g) || [];
      for (const literal of literalMatches) {
        const decoded = decodeLiteral(literal.slice(1, -1)).trim();
        if (decoded) chunks.push(decoded);
      }

      const hexMatches = streamText.match(/<([0-9a-fA-F\s]+)>/g) || [];
      for (const hex of hexMatches) {
        const compact = hex.slice(1, -1).replace(/\s+/g, '');
        if (!compact || compact.length % 2 !== 0) continue;
        try {
          const decoded = Buffer.from(compact, 'hex').toString('latin1').trim();
          if (decoded && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(decoded)) chunks.push(decoded);
        } catch {
          // Ignorar cadenas hexadecimales inválidas.
        }
      }
    }

    cursor = streamEndMarker + endStreamToken.length;
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function parseMoney(value: string): number | undefined {
  const cleaned = String(value || '').replace(/[^\d,.\s-]/g, '').replace(/\s+/g, '');
  if (!cleaned) return undefined;

  let normalized = cleaned;
  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/,/g, '');
  } else if ((normalized.match(/,/g) || []).length > 0 && !normalized.includes('.')) {
    const pieces = normalized.split(',');
    const last = pieces[pieces.length - 1];
    normalized = last.length === 2
      ? pieces.slice(0, -1).join('') + '.' + last
      : pieces.join('');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Number(amount.toFixed(2));
}

function detectDocumentType(text: string): 'FACTURA' | 'TICKET' | 'OTRO' {
  const upper = text.toUpperCase();
  if (/\b(?:CFDI|UUID|FOLIO\s+FISCAL|FACTURA|RFC)\b/.test(upper)) return 'FACTURA';
  if (/\b(?:TICKET|RECIBO|CONSUMO|CAJA|VISA|MASTERCARD)\b/.test(upper)) return 'TICKET';
  return 'OTRO';
}

function findAmountNearTotal(text: string): number | undefined {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  const labelled = [
    /(?:TOTAL\s*A\s*PAGAR|TOTAL\s*PAGAR|IMPORTE\s*TOTAL|MONTO\s*TOTAL|TOTAL)\s*[:=\-]?\s*(?:MXN|M\.?N\.?|USD)?\s*\$?\s*([0-9]{1,3}(?:[,\s][0-9]{3})*\.[0-9]{2}|[0-9]+\.[0-9]{2})/gi,
    /\$?\s*([0-9]{1,3}(?:[,\s][0-9]{3})*\.[0-9]{2})\s*(?:MXN|M\.?N\.?)?\s*(?:TOTAL\s*A\s*PAGAR|TOTAL|IMPORTE\s*TOTAL)/gi,
  ];

  const candidates: Array<{ index: number; amount: number }> = [];

  for (const pattern of labelled) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
      const amount = parseMoney(match[1]);
      if (!amount) continue;

      const before = normalized.slice(Math.max(0, match.index - 50), match.index).toUpperCase();
      if (/\b(?:SUBTOTAL|IVA|IEPS|PROPINA|CAMBIO|SALDO|AUTORIZACI[ÓO]N)\b/.test(before)) continue;
      candidates.push({ index: match.index, amount });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.index - b.index);
    return candidates[candidates.length - 1].amount;
  }

  const totalMatches: number[] = [];
  const totalRegex = /\b(?:TOTAL\s*A\s*PAGAR|TOTAL\s*PAGAR|IMPORTE\s*TOTAL|TOTAL)\b/gi;
  let totalMatch: RegExpExecArray | null;
  while ((totalMatch = totalRegex.exec(normalized)) !== null) totalMatches.push(totalMatch.index);

  if (totalMatches.length > 0) {
    const start = totalMatches[totalMatches.length - 1];
    const window = normalized.slice(start, start + 160);
    const moneyMatches = window.match(/\$?\s*[0-9]{1,3}(?:[,\s][0-9]{3})*\.[0-9]{2}/g) || [];
    const amounts = moneyMatches
      .map(parseMoney)
      .filter((amount): amount is number => Number.isFinite(amount) && amount > 0);
    if (amounts.length > 0) return amounts[amounts.length - 1];
  }

  return undefined;
}

export function extractPdfTextFromDataUrl(dataUrl: string): string {
  if (!/^data:application\/pdf;base64,/i.test(String(dataUrl || ''))) return '';

  try {
    const base64 = String(dataUrl).replace(/^data:application\/pdf;base64,/i, '');
    const pdfBuffer = Buffer.from(base64, 'base64');
    if (!pdfBuffer.length) return '';
    return extractTextFromPdf(pdfBuffer);
  } catch {
    return '';
  }
}

export function readPdfTotalFallback(dataUrl: string): PdfAmountFallbackResult | null {
  const text = extractPdfTextFromDataUrl(dataUrl);
  if (!text) return null;

  const amount = findAmountNearTotal(text);
  if (amount === undefined) return null;

  return {
    amount,
    documentType: detectDocumentType(text),
    confidence: 'ALTA',
  };
}
