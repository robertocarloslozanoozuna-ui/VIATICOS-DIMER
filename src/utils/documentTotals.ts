import type { ExpenseFileAttachment, ExpenseItem } from '../types.js';

export interface DocumentTotalsSummary {
  totalDetected: number;
  primaryDocumentCount: number;
  analyzedDocumentCount: number;
  pendingDocumentCount: number;
  withoutTotalCount: number;
  errorCount: number;
  invoiceCount: number;
  ticketCount: number;
  unclassifiedCount: number;
}

function isXml(file: ExpenseFileAttachment): boolean {
  return /\.xml$/i.test(file.name) || file.role === 'COMPLEMENTO_FISCAL';
}

function baseSignature(filename: string): string {
  return String(filename || '')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s-]+/g, '')
    .trim();
}

function isPdf(file: ExpenseFileAttachment): boolean {
  return /\.pdf$/i.test(file.name);
}

function attachmentIdentity(file: ExpenseFileAttachment): string {
  const uuid = String(file.uuid || file.analysis?.detail?.uuid || '').trim().toLowerCase();
  if (uuid) return `uuid:${uuid}`;
  return `file:${String(file.name || '').trim().toLowerCase()}|${Number(file.size) || 0}`;
}

export function summarizeDocumentTotals(
  items: ExpenseItem[],
  supportFiles: ExpenseFileAttachment[] = [],
  pendingFiscalXmls: ExpenseFileAttachment[] = [],
): DocumentTotalsSummary {
  const files: ExpenseFileAttachment[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (file?: ExpenseFileAttachment) => {
    if (!file) return;
    const key = file.id || `${file.name}_${file.size}`;
    if (seenIds.has(key)) return;
    seenIds.add(key);
    files.push(file);
  };

  for (const item of items || []) {
    pushUnique(item.pdfFile);
    pushUnique(item.ticketFile);
    pushUnique(item.xmlFile);
  }
  for (const file of supportFiles || []) pushUnique(file);
  for (const file of pendingFiscalXmls || []) pushUnique(file);

  const xmlFiles = files.filter(isXml);
  const primaryFiles = files.filter((file) => !isXml(file));

  // Every valid CFDI XML contributes to Total detectado en comprobantes.
  // A matching PDF is NOT required for the XML to count.
  const uniqueXmls: ExpenseFileAttachment[] = [];
  const seenXmls = new Set<string>();
  for (const xml of xmlFiles) {
    const identity = attachmentIdentity(xml);
    if (seenXmls.has(identity)) continue;
    seenXmls.add(identity);
    uniqueXmls.push(xml);
  }

  const xmlByBase = new Map<string, ExpenseFileAttachment>();
  for (const xml of uniqueXmls) {
    const key = baseSignature(xml.name);
    if (
      key &&
      xml.analysis?.status === 'DETECTADO' &&
      Number.isFinite(Number(xml.analysis.amount)) &&
      Number(xml.analysis.amount) > 0 &&
      !xmlByBase.has(key)
    ) {
      xmlByBase.set(key, xml);
    }
  }

  let totalDetected = 0;
  let analyzedDocumentCount = 0;
  let pendingDocumentCount = 0;
  let withoutTotalCount = 0;
  let errorCount = 0;
  let invoiceCount = 0;
  let ticketCount = 0;
  let unclassifiedCount = 0;

  // XML is the authoritative automatic amount for fiscal invoices.
  for (const xml of uniqueXmls) {
    if (
      xml.analysis?.status === 'DETECTADO' &&
      Number.isFinite(Number(xml.analysis.amount)) &&
      Number(xml.analysis.amount) > 0
    ) {
      totalDetected += Number(xml.analysis.amount);
      analyzedDocumentCount += 1;
      invoiceCount += 1;
    } else if (xml.analysis?.status === 'ERROR') {
      errorCount += 1;
      invoiceCount += 1;
    } else if (xml.analysis?.status === 'SIN_TOTAL') {
      withoutTotalCount += 1;
      invoiceCount += 1;
    } else {
      pendingDocumentCount += 1;
      invoiceCount += 1;
    }
  }

  // PDF is only the visual invoice. When a matching XML exists, the PDF
  // contributes ZERO because its XML amount was already counted.
  // When there is no usable XML, the user can enter a manual amount.
  for (const file of primaryFiles) {
    if (isPdf(file)) {
      const pairedXml = xmlByBase.get(baseSignature(file.name));
      if (pairedXml) continue;

      const manualAmount = Number(file.manualAmount);
      if (Number.isFinite(manualAmount) && manualAmount > 0) {
        totalDetected += manualAmount;
        analyzedDocumentCount += 1;
        invoiceCount += 1;
      } else {
        invoiceCount += 1;
        pendingDocumentCount += 1;
      }
      continue;
    }

    // Ticket/image: never OCR/read automatically; only manual amount counts.
    const manualAmount = Number(file.manualAmount);
    if (Number.isFinite(manualAmount) && manualAmount > 0) {
      totalDetected += manualAmount;
      analyzedDocumentCount += 1;
      ticketCount += 1;
    } else {
      ticketCount += 1;
      pendingDocumentCount += 1;
    }
  }

  return {
    totalDetected: Number(totalDetected.toFixed(2)),
    primaryDocumentCount: primaryFiles.length + uniqueXmls.length,
    analyzedDocumentCount,
    pendingDocumentCount,
    withoutTotalCount,
    errorCount,
    invoiceCount,
    ticketCount,
    unclassifiedCount,
  };
}
