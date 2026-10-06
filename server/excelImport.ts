import XLSX from 'xlsx';
import crypto from 'crypto';
import type { ExcelParsedExpense, ExpenseCategoryType, PaymentMethodType } from '../src/types.js';

const CONFIG_SHEET = 'DIMER_CONFIG';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_FILE_SIZE = 15 * 1024 * 1024;

type DimerConfig = Map<string, string>;

function norm(v: unknown) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function num(v: unknown) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function dateOf(v: unknown) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function columnIndex(column: string): number {
  const value = String(column || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(value)) throw new Error(`Columna de Excel inválida en DIMER_CONFIG: "${column}".`);
  let result = 0;
  for (const char of value) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

function parseColumnRange(value: string): number[] {
  const parts = String(value || '').trim().toUpperCase().split(':').map(x => x.trim());
  if (parts.length === 1) return [columnIndex(parts[0])];
  if (parts.length !== 2) throw new Error(`Rango de columnas inválido en DIMER_CONFIG: "${value}".`);
  const start = columnIndex(parts[0]), end = columnIndex(parts[1]);
  if (end < start) throw new Error(`Rango de columnas invertido en DIMER_CONFIG: "${value}".`);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function parseRowRange(value: string): number[] {
  const result: number[] = [];
  for (const token of String(value || '').split(',').map(x => x.trim()).filter(Boolean)) {
    const parts = token.split(':').map(x => x.trim());
    const start = Number(parts[0]), end = parts.length === 1 ? start : Number(parts[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      throw new Error(`Rango de filas inválido en DIMER_CONFIG: "${value}".`);
    }
    for (let row = start; row <= end; row++) result.push(row);
  }
  return Array.from(new Set(result));
}

function parseCellRef(value: string): { row: number; col: number } {
  const match = String(value || '').trim().toUpperCase().match(/^([A-Z]+)([1-9][0-9]*)$/);
  if (!match) throw new Error(`Celda inválida en DIMER_CONFIG: "${value}".`);
  return { row: Number(match[2]), col: columnIndex(match[1]) };
}

function boolConfig(value: unknown, key: string): boolean {
  const normalized = norm(value);
  if (normalized === 'TRUE' || normalized === 'VERDADERO' || normalized === 'SI' || normalized === '1') return true;
  if (normalized === 'FALSE' || normalized === 'FALSO' || normalized === 'NO' || normalized === '0') return false;
  throw new Error(`El parámetro ${key} de DIMER_CONFIG debe ser TRUE/FALSE.`);
}

function readConfig(ws: XLSX.WorkSheet): DimerConfig {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  const config: DimerConfig = new Map();
  for (const row of rows) {
    const key = String(row?.[0] ?? '').trim();
    if (!key || key === 'PARÁMETRO' || key === 'PARAMETRO') continue;
    const value = row?.[1];
    if (value !== null && value !== undefined && String(value).trim() !== '') config.set(key, String(value).trim());
  }
  return config;
}

function requiredConfig(config: DimerConfig, key: string): string {
  const value = config.get(key);
  if (value === undefined || value === '') throw new Error(`Falta el parámetro obligatorio "${key}" en DIMER_CONFIG.`);
  return value;
}

function cellValue(ws: XLSX.WorkSheet, ref: string): unknown {
  return ws[ref]?.v;
}

function configCatalog(ws: XLSX.WorkSheet): Map<string, ExpenseCategoryType> {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  const map = new Map<string, ExpenseCategoryType>();
  let inCatalog = false;
  for (const row of rows) {
    const first = norm(row?.[0]);
    const second = norm(row?.[1]);
    if (first === 'ROW' && second === 'CONCEPTO') {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    const rowNumber = Number(row?.[0]);
    const concept = String(row?.[1] ?? '').trim();
    const section = norm(row?.[2]);
    if (!Number.isInteger(rowNumber) || !concept) {
      if (first.startsWith('DIMER_CONFIG')) break;
      continue;
    }
    // Map the official report sections to the application's normalized categories.
    const category: ExpenseCategoryType =
      section === 'VIAJES' ? (
        /GASOLINA/i.test(concept) ? 'GASOLINA' :
        /CASETA/i.test(concept) ? 'CASETAS' :
        /ESTACIONAMIENTO/i.test(concept) ? 'ESTACIONAMIENTO' :
        /HOSPEDAJE|ESTANCIA/i.test(concept) ? 'HOSPEDAJE' :
        /BOLETO|RENTA|TAXI|UBER|TRANSPORTE/i.test(concept) ? 'TRANSPORTE_FORANEO' :
        'GASTOS_MENORES'
      ) :
      section === 'COMIDAS' ? 'ALIMENTOS' :
      section === 'GASTOS DE OFICINA' ? 'GASTOS_MENORES' :
      'GASTOS_MENORES';
    map.set(norm(concept), category);
  }
  return map;
}

export function parseDimerExpenseExcel(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
  dataUrl: string;
  uploadedBy?: string;
}) {
  const mt = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!mt) throw new Error('No fue posible leer el contenido binario del archivo Excel.');
  const buffer = Buffer.from(mt[2], 'base64');
  if (!buffer.length) throw new Error('El archivo Excel está vacío.');
  if (buffer.length > MAX_FILE_SIZE) throw new Error('El archivo Excel supera el límite de 15 MB.');

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    throw new Error('El archivo no es un Excel .xlsx válido o está dañado.');
  }

  if (!wb.SheetNames.includes(CONFIG_SHEET)) {
    throw new Error('La plantilla oficial está incompleta: falta la hoja DIMER_CONFIG.');
  }

  const cfgSheet = wb.Sheets[CONFIG_SHEET];
  const cfg = readConfig(cfgSheet);
  const mainSheetName = requiredConfig(cfg, 'HOJA_PRINCIPAL');
  if (!wb.SheetNames.includes(mainSheetName)) {
    throw new Error(`La plantilla no es compatible: falta la hoja "${mainSheetName}".`);
  }

  const contractKeys: Array<[string, string]> = [
    ['PLANTILLA_ID', 'DIMER_REPORTE_GASTOS'],
    ['HOJA_PRINCIPAL', mainSheetName],
    ['FECHA_LABEL_CELL', requiredConfig(cfg, 'FECHA_LABEL_CELL')],
    ['FECHA_COLUMNS', requiredConfig(cfg, 'FECHA_COLUMNS')],
    ['IMPORTE_COLUMNS', requiredConfig(cfg, 'IMPORTE_COLUMNS')],
    ['ROW_TOTAL_COLUMN', requiredConfig(cfg, 'ROW_TOTAL_COLUMN')],
    ['TOTAL_GASTOS_LABEL_CELL', requiredConfig(cfg, 'TOTAL_GASTOS_LABEL_CELL')],
    ['TOTAL_GASTOS_CONTROL_CELL', requiredConfig(cfg, 'TOTAL_GASTOS_CONTROL_CELL')],
    ['ORIGINAL_FILE_REQUIRED', requiredConfig(cfg, 'ORIGINAL_FILE_REQUIRED')],
    ['STRICT_TEMPLATE_CHECK', requiredConfig(cfg, 'STRICT_TEMPLATE_CHECK')],
  ];
  const bad = contractKeys.filter(([key, expected]) => cfg.get(key) !== expected);
  if (bad.length) {
    throw new Error(`La plantilla DIMER_CONFIG no coincide con la estructura oficial: ${bad.map(([key, expected]) => `${key} esperaba ${expected}`).join('; ')}.`);
  }

  if (!boolConfig(requiredConfig(cfg, 'STRICT_TEMPLATE_CHECK'), 'STRICT_TEMPLATE_CHECK')) {
    throw new Error('DIMER_CONFIG exige STRICT_TEMPLATE_CHECK=TRUE para esta plantilla.');
  }
  if (!boolConfig(requiredConfig(cfg, 'ORIGINAL_FILE_REQUIRED'), 'ORIGINAL_FILE_REQUIRED')) {
    throw new Error('DIMER_CONFIG exige ORIGINAL_FILE_REQUIRED=TRUE para esta plantilla.');
  }

  const main = wb.Sheets[mainSheetName];
  const dateHeaderRow = Number(requiredConfig(cfg, 'FECHA_HEADER_ROW'));
  if (!Number.isInteger(dateHeaderRow) || dateHeaderRow < 1) throw new Error('FECHA_HEADER_ROW no es válido en DIMER_CONFIG.');

  const dateLabelCell = requiredConfig(cfg, 'FECHA_LABEL_CELL');
  if (norm(cellValue(main, dateLabelCell)) !== 'FECHA') {
    throw new Error(`La celda ${dateLabelCell} debe contener FECHA.`);
  }

  const fechaColumns = parseColumnRange(requiredConfig(cfg, 'FECHA_COLUMNS'));
  const importeColumns = parseColumnRange(requiredConfig(cfg, 'IMPORTE_COLUMNS'));
  if (fechaColumns.length !== importeColumns.length || fechaColumns.some((col, i) => col !== importeColumns[i])) {
    throw new Error('FECHA_COLUMNS e IMPORTE_COLUMNS deben corresponder a las mismas columnas diarias.');
  }

  const conceptColumn = columnIndex(requiredConfig(cfg, 'CONCEPTO_COLUMN'));
  // Parsed for contract validation: J is a control column and is never an item source.
  columnIndex(requiredConfig(cfg, 'ROW_TOTAL_COLUMN'));

  const dateValues = fechaColumns.map(col =>
    dateOf(cellValue(main, XLSX.utils.encode_cell({ r: dateHeaderRow - 1, c: col })))
  );
  if (dateValues.some(x => !x)) {
    throw new Error(`La plantilla no contiene fechas válidas en ${requiredConfig(cfg, 'FECHA_COLUMNS')}${dateHeaderRow}.`);
  }

  const totalLabelCell = requiredConfig(cfg, 'TOTAL_GASTOS_LABEL_CELL');
  if (norm(cellValue(main, totalLabelCell)) !== 'TOTAL DE GASTOS') {
    throw new Error(`La celda ${totalLabelCell} debe contener TOTAL DE GASTOS.`);
  }

  const dataRows = parseRowRange(requiredConfig(cfg, 'EXPENSE_DATA_ROWS'));
  const controlRows = parseRowRange(requiredConfig(cfg, 'CONTROL_ROWS'));
  const overlap = dataRows.filter(row => controlRows.includes(row));
  if (overlap.length) {
    throw new Error(`DIMER_CONFIG es inconsistente: estas filas son datos y controles a la vez: ${overlap.join(', ')}.`);
  }


  if (!boolConfig(requiredConfig(cfg, 'IGNORE_ZERO_OR_BLANK'), 'IGNORE_ZERO_OR_BLANK') ||
      !boolConfig(requiredConfig(cfg, 'CREATE_ITEM_PER_NONZERO_CELL'), 'CREATE_ITEM_PER_NONZERO_CELL')) {
    throw new Error('La configuración actual exige IGNORE_ZERO_OR_BLANK=TRUE y CREATE_ITEM_PER_NONZERO_CELL=TRUE.');
  }

  if (norm(requiredConfig(cfg, 'TOTAL_CALCULATION')) !== 'SUM(EXPENSEITEM.AMOUNT)') {
    throw new Error('TOTAL_CALCULATION de DIMER_CONFIG no coincide con el contrato oficial.');
  }

  const tolerance = num(requiredConfig(cfg, 'CONCILIATION_TOLERANCE_MXN'));
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('CONCILIATION_TOLERANCE_MXN no es válido.');

  const totalControlCell = requiredConfig(cfg, 'TOTAL_GASTOS_CONTROL_CELL');
  parseCellRef(totalControlCell);

  const catalog = configCatalog(cfgSheet);
  const items: ExcelParsedExpense[] = [];
  const warnings: string[] = [];

  const readRows = (rows: number[], paymentMethod: PaymentMethodType | undefined, sectionTitle: string) => {
    for (const row of rows) {
      const concept = String(main[XLSX.utils.encode_cell({ r: row - 1, c: conceptColumn })]?.v ?? '').trim();
      if (!concept) continue;

      for (let i = 0; i < importeColumns.length; i++) {
        const col = importeColumns[i];
        const amount = Number(num(cellValue(main, XLSX.utils.encode_cell({ r: row - 1, c: col }))).toFixed(2));
        if (amount <= 0) continue;

        items.push({
          id: `excel_${row}_${col + 1}_${crypto.randomUUID()}`,
          concept,
          sourceCategory: concept,
          amount,
          expenseDate: dateValues[i],
          category: catalog.get(norm(concept)),
          paymentMethod,
          sectionTitle,
          excelCellRef: XLSX.utils.encode_cell({ r: row - 1, c: col }),
        });
      }
    }
  };

  // Esta plantilla ya no maneja tarjeta corporativa/empresarial.
  // Todos los gastos quedan pendientes de clasificación del método de pago.
  readRows(dataRows, undefined, 'GASTOS DIMER');

  const totalImported = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const totalExcel = Number(num(cellValue(main, totalControlCell)).toFixed(2));
  const difference = Number(Math.abs(totalExcel - totalImported).toFixed(2));

  if (difference > tolerance) {
    warnings.push(`Diferencia de conciliación: Excel ${totalExcel.toFixed(2)} vs partidas ${totalImported.toFixed(2)}.`);
  }
  if (items.length > 0) {
    warnings.push('La plantilla oficial DIMER no maneja tarjeta corporativa/empresarial. El método de pago de cada partida debe clasificarse durante la comprobación.');
  }

  const uploadedAt = new Date().toISOString();
  const digest = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  return {
    items,
    originalExcelFile: {
      id: `excel_${digest}`,
      name: input.fileName,
      size: input.fileSize || buffer.length,
      type: input.fileType || XLSX_MIME,
      dataUrl: input.dataUrl,
      uploadedAt,
      role: 'DOCUMENTO_ORIGINAL_EXCEL' as const,
    },
    excelAuditSummary: {
      filename: input.fileName,
      sizeBytes: input.fileSize || buffer.length,
      uploadedAt,
      uploadedBy: input.uploadedBy,
      sheetName: mainSheetName,
      totalExcel,
      totalImported,
      difference,
      itemsCount: items.length,
      reconciliationStatus: difference <= tolerance ? 'CONCILIACION_CORRECTA' as const : 'DIFERENCIA_DETECTADA' as const,
    },
    warnings,
    totalExcel,
  };
}
