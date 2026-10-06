import type { ExpenseFileAttachment, ExpenseItem } from '../types.js';

export interface DocumentTotalsSummary {
  totalDetected: number;
  fiscalXmlTotal: number;
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

  const primaryFiles = files.filter((file) => !isXml(file));
  const xmlFiles = files.filter((file) => isXml(file));

  let totalDetected = 0;
  let fiscalXmlTotal = 0;
  let analyzedDocumentCount = 0;
  let pendingDocumentCount = 0;
  let withoutTotalCount = 0;
  let errorCount = 0;
  let invoiceCount = 0;
  let ticketCount = 0;
  let unclassifiedCount = 0;

  for (const file of primaryFiles) {
    const analysis = file.analysis;
    if (!analysis) {
      pendingDocumentCount += 1;
      unclassifiedCount += 1;
      continue;
    }

    if (analysis.status === 'ERROR' || analysis.status === 'NO_DISPONIBLE') {
      errorCount += 1;
    } else {
      analyzedDocumentCount += 1;
    }

    if (analysis.status === 'SIN_TOTAL') {
      withoutTotalCount += 1;
    }

    if (analysis.documentType === 'FACTURA') invoiceCount += 1;
    else if (analysis.documentType === 'TICKET') ticketCount += 1;
    else unclassifiedCount += 1;

    if (analysis.includedInTotal && Number.isFinite(Number(analysis.amount)) && Number(analysis.amount) > 0) {
      totalDetected += Number(analysis.amount);
    }
  }

  for (const file of xmlFiles) {
    const amount = Number(file.analysis?.amount || 0);
    if (file.analysis?.status === 'DETECTADO' && amount > 0) fiscalXmlTotal += amount;
  }

  return {
    totalDetected: Number(totalDetected.toFixed(2)),
    fiscalXmlTotal: Number(fiscalXmlTotal.toFixed(2)),
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
