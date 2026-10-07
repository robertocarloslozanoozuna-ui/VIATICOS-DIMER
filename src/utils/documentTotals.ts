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
  const lower = file.name.toLowerCase();
  return lower.endsWith('.xml') || file.role === 'COMPLEMENTO_FISCAL';
}

function baseSignature(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .trim();
}

function isPdf(file: ExpenseFileAttachment): boolean {
  return /\.pdf$/i.test(file.name);
}

export function summarizeDocumentTotals(
  items: ExpenseItem[],
  supportFiles: ExpenseFileAttachment[] = [],
  pendingFiscalXmls: ExpenseFileAttachment[] = [],
): DocumentTotalsSummary {
  const files: ExpenseFileAttachment[] = [];
  const seen = new Set<string>();

  const pushUnique = (file?: ExpenseFileAttachment) => {
    if (!file) return;
    const key = file.id || file.name + '_' + file.size;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  for (const item of items || []) {
    pushUnique(item.pdfFile);
    pushUnique(item.ticketFile);
    pushUnique(item.xmlFile);
  }
  for (const file of supportFiles || []) pushUnique(file);
  for (const file of pendingFiscalXmls || []) pushUnique(file);

  const xmlByBase = new Map<string, ExpenseFileAttachment>();
  files.filter(isXml).forEach((xml) => {
    const key = baseSignature(xml.name);
    if (key) xmlByBase.set(key, xml);
  });

  const primaryFiles = files.filter((file) => !isXml(file));
  let totalDetected = 0;
  let analyzedDocumentCount = 0;
  let pendingDocumentCount = 0;
  let withoutTotalCount = 0;
  let errorCount = 0;
  let invoiceCount = 0;
  let ticketCount = 0;
  let unclassifiedCount = 0;

  for (const file of primaryFiles) {
    const pairedXml = isPdf(file) ? xmlByBase.get(baseSignature(file.name)) : undefined;
    const xmlAnalysis = pairedXml?.analysis;
    const hasXmlTotal =
      Boolean(pairedXml) &&
      xmlAnalysis?.status === 'DETECTADO' &&
      Number.isFinite(Number(xmlAnalysis.amount)) &&
      Number(xmlAnalysis.amount) > 0;

    if (hasXmlTotal) {
      totalDetected += Number(xmlAnalysis!.amount);
      analyzedDocumentCount += 1;
      invoiceCount += 1;
      continue;
    }

    // PDFs without a usable XML and all images/tickets are manual.
    const manualAmount = Number(file.manualAmount);
    if (Number.isFinite(manualAmount) && manualAmount > 0) {
      totalDetected += manualAmount;
      analyzedDocumentCount += 1;
      if (isPdf(file)) invoiceCount += 1;
      else if (file.analysis?.documentType === 'TICKET' || file.type.startsWith('image/')) ticketCount += 1;
      else unclassifiedCount += 1;
      continue;
    }

    if (isPdf(file)) {
      invoiceCount += 1;
      pendingDocumentCount += 1;
    } else {
      ticketCount += 1;
      pendingDocumentCount += 1;
    }
  }

  for (const xml of files.filter(isXml)) {
    const pairedPdf = primaryFiles.find((file) => isPdf(file) && baseSignature(file.name) === baseSignature(xml.name));
    if (!pairedPdf) {
      // XML alone is fiscal support but is not counted until its PDF is related.
      unclassifiedCount += 1;
      continue;
    }
    if (xml.analysis?.status !== 'DETECTADO') {
      errorCount += xml.analysis?.status === 'ERROR' ? 1 : 0;
    }
  }

  return {
    totalDetected: Number(totalDetected.toFixed(2)),
    primaryDocumentCount: primaryFiles.length,
    analyzedDocumentCount,
    pendingDocumentCount,
    withoutTotalCount,
    errorCount,
    invoiceCount,
    ticketCount,
    unclassifiedCount,
  };
}
