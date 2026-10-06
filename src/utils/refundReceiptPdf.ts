export interface RefundReceiptPdfData {
  folio: string;
  employeeName: string;
  department?: string;
  destination?: string;
  amount: number;
  refundDate: string;
  method: 'SPEI' | 'EFECTIVO';
  reference?: string;
}

const WIN_ANSI_MAP: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f,
};

const LATIN1_CHARS = 'áéíóúÁÉÍÓÚñÑüÜ¿¡ªº°';

function toWinAnsi(value: string): number[] {
  const bytes: number[] = [];
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
      continue;
    }
    if (code >= 0xa0 && code <= 0xff) {
      bytes.push(code);
      continue;
    }
    if (WIN_ANSI_MAP[ch] !== undefined) {
      bytes.push(WIN_ANSI_MAP[ch]);
      continue;
    }
    if (ch === '\\n') {
      bytes.push(0x20);
      continue;
    }
    // Sustituir caracteres que no soporta Helvetica/WinAnsi por espacio.
    bytes.push(0x20);
  }
  return bytes;
}

function pdfEscape(value: string): string {
  const bytes = toWinAnsi(value);
  let out = '';
  for (const byte of bytes) {
    const ch = String.fromCharCode(byte);
    if (ch === '\\' || ch === '(' || ch === ')') out += '\\';
    out += ch;
  }
  return out;
}

function textCommand(text: string, x: number, y: number, size: number, bold = false) {
  const font = bold ? '/F2' : '/F1';
  return `BT ${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(text)}) Tj ET`;
}

function lineCommand(x1: number, y1: number, x2: number, y2: number) {
  return `q ${x1} ${y1} m ${x2} ${y2} l S Q`;
}

function rectCommand(x: number, y: number, w: number, h: number) {
  return `q ${x} ${y} ${w} ${h} re S Q`;
}

function wrapText(text: string, maxChars: number): string[] {
  const normalized = String(text || '').trim();
  if (!normalized) return [];
  const words = normalized.split(/\\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function money(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildPdfBytes(data: RefundReceiptPdfData): Uint8Array {
  const pageW = 595;
  const pageH = 842;
  const content: string[] = [
    'q 0.85 G 1 w',
    rectCommand(36, 36, pageW - 72, pageH - 72),
    'Q',
    textCommand('DIMER', 54, 786, 22, true),
    textCommand('RECIBO DE REEMBOLSO DE VIÁTICOS', 54, 760, 12, true),
    lineCommand(54, 748, 541, 748),
    textCommand('Folio', 54, 716, 8),
    textCommand(data.folio, 54, 700, 11, true),
    textCommand('Fecha', 360, 716, 8),
    textCommand(data.refundDate || 'N/D', 360, 700, 11, true),
    textCommand('Empleado', 54, 668, 8),
    textCommand(data.employeeName || 'N/D', 54, 652, 11, true),
    textCommand('Departamento', 360, 668, 8),
    textCommand(data.department || 'N/D', 360, 652, 11, true),
    'q 0.92 g 1 G 50 585 495 48 re S Q',
    textCommand('MONTO RECIBIDO POR DIMER', 72, 615, 9, true),
    textCommand(money(data.amount), 72, 592, 22, true),
    textCommand('Por concepto de devolución de sobrante de viáticos.', 340, 594, 8),
    textCommand('Forma de entrega', 54, 552, 8),
    textCommand(data.method === 'SPEI' ? 'Transferencia SPEI' : 'Efectivo / Caja', 190, 550, 10, true),
    lineCommand(54, 540, 541, 540),
  ];

  const destinationLines = wrapText(data.destination || 'N/D', 55);
  content.push(textCommand('Destino / Comisión', 54, 518, 8));
  destinationLines.slice(0, 2).forEach((line, index) => {
    content.push(textCommand(line, 190, 516 - (index * 14), 10, true));
  });

  const refY = 470;
  content.push(lineCommand(54, refY + 22, 541, refY + 22));
  content.push(textCommand('Referencia / Clave de rastreo', 54, refY, 8));
  content.push(textCommand(data.reference || 'Pendiente de capturar', 220, refY - 2, 10, true));

  const declarationY = 414;
  content.push(
    `q 0.96 g 1 G 54 ${declarationY - 55} 487 72 re S Q`,
    textCommand('DECLARACIÓN', 70, declarationY, 9, true),
  );
  wrapText(
    'Declaro que entregué o reintegré a DIMER el importe señalado en este recibo correspondiente al sobrante del anticipo de viáticos del folio indicado.',
    78,
  ).slice(0, 3).forEach((line, index) => {
    content.push(textCommand(line, 70, declarationY - 18 - (index * 14), 9));
  });

  const sigY = 275;
  content.push(
    lineCommand(78, sigY, 270, sigY),
    lineCommand(325, sigY, 517, sigY),
    textCommand(data.employeeName || 'Empleado', 78, sigY - 18, 9, true),
    textCommand('Firma de quien entrega', 110, sigY - 33, 8),
    textCommand('Finanzas / Tesorería', 370, sigY - 18, 9, true),
    textCommand('Firma de quien recibe', 386, sigY - 33, 8),
    lineCommand(54, 180, 541, 180),
    textCommand('Documento interno DIMER', 54, 160, 8),
    textCommand(`Folio ${data.folio}`, 455, 160, 8),
  );

  const stream = content.join('\\n') + '\\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${toWinAnsi(stream).length} >>\\nstream\\n${stream}endstream`,
  ];

  const header = '%PDF-1.4\\n%\xE2\xE3\xCF\xD3\\n';
  let pdf = header;
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\\n${objects[i]}\\nendobj\\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\\n0 ${objects.length + 1}\\n`;
  pdf += '0000000000 65535 f \\n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \\n';
  }
  pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefOffset}\\n%%EOF`;

  return new Uint8Array(toWinAnsi(pdf));
}

export function downloadRefundReceiptPdf(data: RefundReceiptPdfData) {
  const bytes = buildPdfBytes(data);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Recibo_Reembolso_${String(data.folio || 'VIATICOS').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
