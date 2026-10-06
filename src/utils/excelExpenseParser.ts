import * as XLSX from 'xlsx';
import type { ExpenseCategoryType, PaymentMethodType, ExcelParsedExpense } from '../types.js';

export interface DimerConfig {
  versionConfig: string;
  plantillaId: string;
  hojaPrincipal: string;

  // Fechas
  fechaHeaderRow?: number; // e.g. 8 o 12
  celdaFechaInicio: string; // e.g. "C8" o "C12"
  celdaFechaFin: string; // e.g. "I8" o "I12"
  columnasFecha: string; // e.g. "C:I"

  // Columnas
  columnaConcepto: string; // e.g. "B"
  columnaTotalControl: string; // e.g. "J"

  // Anticipo
  celdaAnticipoOtorgado?: string; // e.g. "D4"

  // Filas / Rangos de datos
  gastosAnticipoRows?: number[];
  filasGastosAnticipoInicio?: number;
  filasGastosAnticipoFin?: number;

  tcEmpresaRows: number[]; // e.g. [13..20, 22..27, 29..33, 35..36]
  filasTcEmpresaInicio: number;
  filasTcEmpresaFin: number;
  filaSubtotalTcEmpresa?: number;
  subtotalTcEmpresaCell?: string; // e.g. "J37"

  personalRows: number[]; // e.g. [40..45]
  filasEfectivoPersonalInicio: number;
  filasEfectivoPersonalFin: number;

  filaReembolso?: number;
  reembolsoControlRange?: string; // e.g. "C46:I46"
  reembolsoLabelCell?: string; // e.g. "B46"

  filaTotalGastos: number;
  totalGastosControlCell?: string; // e.g. "J47"
  totalGastosLabelCell?: string; // e.g. "B47"

  controlRows: Set<number>; // e.g. Set([37, 46, 47])

  isAutoDetected?: boolean;
  conceptCatalog?: Record<string, { category?: ExpenseCategoryType; defaultPaymentMethod?: PaymentMethodType }>;
}

export interface ExcelParseResult {
  success: boolean;
  sheetName: string;
  items: ExcelParsedExpense[];
  totalExcel: number;
  totalImported: number;
  difference: number;
  reconciliationStatus: 'CONCILIACION_CORRECTA' | 'DIFERENCIA_DETECTADA';
  warnings: string[];
  dateColumnsCount: number;
  detectedCategories: string[];
  error?: string;
  config?: DimerConfig;
}

const MONTH_MAP_ES: Record<string, string> = {
  ene: '01', enero: '01', jan: '01', january: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03', march: '03',
  abr: '04', abril: '04', apr: '04', april: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06', june: '06',
  jul: '07', julio: '07', july: '07',
  ago: '08', agosto: '08', aug: '08', august: '08',
  sep: '09', sept: '09', septiembre: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12', dec: '12', december: '12',
};

/**
 * Normaliza y convierte un valor de celda a fecha en formato ISO YYYY-MM-DD
 */
export function parseExcelDateCell(cellVal: any, referenceYear?: number): string | null {
  if (cellVal === null || cellVal === undefined || cellVal === '') return null;

  // 1. Si ya es una instancia de Date
  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    return cellVal.toISOString().split('T')[0];
  }

  // 2. Si es un número serial de Excel (ej. 45556)
  if (typeof cellVal === 'number' && cellVal > 30000 && cellVal < 60000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(cellVal);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = String(parsed.y).padStart(4, '0');
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // continuar
    }
  }

  const str = String(cellVal).trim();
  if (!str) return null;

  // 3. Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 4. Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    let y = dmyMatch[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // 5. Formato DD-Mon (ej. "21-Sep", "21/Sep", "21-sep-26")
  const textDateMatch = str.match(/^(\d{1,2})[-/\s]+([a-zA-ZáéíóúÁÉÍÓÚ]+)(?:[-/\s]+(\d{2,4}))?$/);
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0');
    const monthRaw = textDateMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTH_MAP_ES[monthRaw] || MONTH_MAP_ES[monthRaw.substring(0, 3)];
    if (month) {
      let year = textDateMatch[3];
      if (!year) {
        year = referenceYear ? String(referenceYear) : String(new Date().getFullYear());
      } else if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Mapeo oficial de conceptos del Excel DIMER a Categorías de Sistema
 */
export function mapConceptToCategory(rawConcept: string): ExpenseCategoryType | undefined {
  const c = rawConcept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (c.includes('hotel') || c.includes('hospedaje') || c.includes('alojamiento') || c.includes('estancia')) {
    return 'HOSPEDAJE';
  }
  if (c.includes('gasolina') || c.includes('combustible') || c.includes('diesel')) {
    return 'GASOLINA';
  }
  if (c.includes('caseta') || c.includes('peaje')) {
    return 'CASETAS';
  }
  if (c.includes('avion') || c.includes('vuelo') || c.includes('autobus') || c.includes('boleto') || c.includes('foraneo') || c.includes('viaje')) {
    return 'TRANSPORTE_FORANEO';
  }
  if (c.includes('taxi') || c.includes('uber') || c.includes('didi') || c.includes('renta de auto') || c.includes('rentas de autos') || c.includes('traslado')) {
    return 'TRANSPORTE_LOCAL';
  }
  if (
    c.includes('alimento') ||
    c.includes('desayuno') ||
    c.includes('comida') ||
    c.includes('cena') ||
    c.includes('restaurante') ||
    c.includes('snack') ||
    c.includes('cafe') ||
    c.includes('consumo') ||
    c.includes('bebida')
  ) {
    return 'ALIMENTOS';
  }
  if (c.includes('estacionamiento') || c.includes('parking')) {
    return 'ESTACIONAMIENTO';
  }
  if (
    c.includes('propina') ||
    c.includes('trago') ||
    c.includes('papeleria') ||
    c.includes('oficina') ||
    c.includes('suministro') ||
    c.includes('telefono') ||
    c.includes('mantenimiento') ||
    c.includes('postal') ||
    c.includes('envio') ||
    c.includes('imprevisto') ||
    c.includes('menor') ||
    c.includes('regalo') ||
    c.includes('cliente') ||
    c.includes('otro') ||
    c.includes('etc') ||
    c.includes('vario') ||
    c.includes('ropa')
  ) {
    return 'GASTOS_MENORES';
  }

  return undefined;
}

/**
 * Convierte expresiones de rangos como "13:20,22:27,29:33,35:36" en lista de filas ordenadas
 */
function parseRangeList(str: string): number[] {
  if (!str) return [];
  const rows: number[] = [];
  const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes(':')) {
      const [startStr, endStr] = part.split(':');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let r = Math.min(start, end); r <= Math.max(start, end); r++) {
          rows.push(r);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) rows.push(n);
    }
  }
  return [...new Set(rows)].sort((a, b) => a - b);
}

/**
 * Lee y valida la hoja DIMER_CONFIG del libro de Excel.
 * Soporta todas las variantes de parámetros del contrato oficial DIMER.
 */
export function parseDimerConfigFromWorkbook(workbook: XLSX.WorkBook): {
  valid: boolean;
  config?: DimerConfig;
  error?: string;
} {
  // 1. Buscar la hoja DIMER_CONFIG
  const configSheetName = workbook.SheetNames.find((name) => {
    const u = name.toUpperCase().trim().replace(/[\s-_]/g, '');
    return u === 'DIMERCONFIG' || u === 'CONFIGDIMER' || u === 'CONFIGURACIONDIMER';
  });

  const rawParams: Record<string, string> = {};
  const conceptCatalog: Record<string, { category?: ExpenseCategoryType; defaultPaymentMethod?: PaymentMethodType }> = {};

  if (configSheetName && workbook.Sheets[configSheetName]) {
    const ws = workbook.Sheets[configSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: '' });

    let isReadingCatalog = false;

    for (const row of rows) {
      if (!Array.isArray(row) || row.length === 0) continue;

      let col0 = '';
      let col1 = '';
      let col2 = '';

      for (let i = 0; i < row.length; i++) {
        const v = String(row[i] || '').trim();
        if (v) {
          if (!col0) col0 = v;
          else if (!col1) col1 = v;
          else if (!col2) { col2 = v; break; }
        }
      }

      if (!col0 && !col1) continue;

      if (col0.toUpperCase().includes('CATALOGO') || col0.toUpperCase().includes('CONCEPTO_EXCEL') || col0.toUpperCase().includes('CATÁLOGO')) {
        isReadingCatalog = true;
        continue;
      }

      if (isReadingCatalog) {
        if (col0 && !col0.toUpperCase().includes('CATEGORÍAS') && !col0.toUpperCase().includes('REGLAS')) {
          conceptCatalog[col0.toLowerCase()] = {
            category: mapConceptToCategory(col1 || col0) || (col1 as ExpenseCategoryType) || undefined,
            defaultPaymentMethod: (col2 as PaymentMethodType) || undefined,
          };
        }
        continue;
      }

      const key = col0
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]/g, '_');

      if (key && col1 !== '') {
        rawParams[key] = col1;
      }
    }
  }

  // Identificar hoja principal
  let hojaPrincipal = rawParams['HOJA_PRINCIPAL'] || rawParams['HOJA'] || 'REPORTE DE GASTOS MENSUAL';
  let realSheet = workbook.SheetNames.find(
    (s) => s.toUpperCase().trim() === hojaPrincipal.toUpperCase().trim()
  );

  if (!realSheet) {
    realSheet = workbook.SheetNames.find((s) => s.toUpperCase().includes('REPORTE') || s.toUpperCase().includes('GASTO')) || workbook.SheetNames[0];
    hojaPrincipal = realSheet;
  }

  if (!realSheet || !workbook.Sheets[realSheet]) {
    return {
      valid: false,
      error: 'La plantilla DIMER no contiene una hoja de reporte compatible.',
    };
  }

  const sheet = workbook.Sheets[realSheet];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });

  // 2. Extraer configuración de fechas
  let fechaHeaderRow = parseInt(rawParams['FECHA_HEADER_ROW'] || '', 10);
  let columnasFecha = (rawParams['FECHA_COLUMNS'] || rawParams['COLUMNAS_FECHA'] || rawParams['IMPORTE_COLUMNS'] || 'C:I').toUpperCase();

  // Si no está definida la fila de fechas en config, buscar fila que contenga fechas
  if (isNaN(fechaHeaderRow) || fechaHeaderRow <= 0) {
    for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
      const row = rawRows[r] || [];
      let dateMatches = 0;
      for (let c = 0; c < row.length; c++) {
        if (parseExcelDateCell(row[c])) dateMatches++;
      }
      if (dateMatches >= 2) {
        fechaHeaderRow = r + 1; // 1-indexed
        break;
      }
    }
    if (isNaN(fechaHeaderRow) || fechaHeaderRow <= 0) {
      fechaHeaderRow = 8; // Default oficial
    }
  }

  let [colStart, colEnd] = columnasFecha.split(':');
  if (!colStart || !colEnd) {
    colStart = 'C';
    colEnd = 'I';
    columnasFecha = 'C:I';
  }

  const celdaFechaInicio = rawParams['CELDA_FECHA_INICIO'] || `${colStart}${fechaHeaderRow}`;
  const celdaFechaFin = rawParams['CELDA_FECHA_FIN'] || `${colEnd}${fechaHeaderRow}`;

  const columnaConcepto = (rawParams['CONCEPTO_COLUMN'] || rawParams['COLUMNA_CONCEPTO'] || 'B').toUpperCase();
  const columnaTotalControl = (rawParams['ROW_TOTAL_COLUMN'] || rawParams['COLUMNA_TOTAL_CONTROL'] || 'J').toUpperCase();

  // 3. Extraer rangos de datos de Gastos con Anticipo / Tarjeta Personal
  let gastosAnticipoRows: number[] = [];
  if (rawParams['GASTOS_ANTICIPO_DATA_ROWS']) {
    gastosAnticipoRows = parseRangeList(rawParams['GASTOS_ANTICIPO_DATA_ROWS']);
  } else if (rawParams['FILAS_GASTOS_ANTICIPO_INICIO'] && rawParams['FILAS_GASTOS_ANTICIPO_FIN']) {
    const s = parseInt(rawParams['FILAS_GASTOS_ANTICIPO_INICIO'], 10);
    const e = parseInt(rawParams['FILAS_GASTOS_ANTICIPO_FIN'], 10);
    if (s > 0 && e >= s) gastosAnticipoRows = parseRangeList(`${s}:${e}`);
  }

  // Compatibilidad con contratos existentes que usen TC_EMPRESA_DATA_ROWS
  let tcEmpresaRows: number[] = [];
  if (rawParams['TC_EMPRESA_DATA_ROWS']) {
    tcEmpresaRows = parseRangeList(rawParams['TC_EMPRESA_DATA_ROWS']);
  } else if (rawParams['FILAS_TC_EMPRESA_INICIO'] && rawParams['FILAS_TC_EMPRESA_FIN']) {
    const s = parseInt(rawParams['FILAS_TC_EMPRESA_INICIO'], 10);
    const e = parseInt(rawParams['FILAS_TC_EMPRESA_FIN'], 10);
    if (s > 0 && e >= s) tcEmpresaRows = parseRangeList(`${s}:${e}`);
  }

  // 4. Extraer rangos de datos de Efectivo / Personal
  let personalRows: number[] = [];
  if (rawParams['PERSONAL_DATA_ROWS']) {
    personalRows = parseRangeList(rawParams['PERSONAL_DATA_ROWS']);
  } else if (rawParams['FILAS_EFECTIVO_PERSONAL_INICIO'] && rawParams['FILAS_EFECTIVO_PERSONAL_FIN']) {
    const s = parseInt(rawParams['FILAS_EFECTIVO_PERSONAL_INICIO'], 10);
    const e = parseInt(rawParams['FILAS_EFECTIVO_PERSONAL_FIN'], 10);
    if (s > 0 && e >= s) personalRows = parseRangeList(`${s}:${e}`);
  }

  // 5. Filas de control
  const controlRowsList = rawParams['CONTROL_ROWS'] ? parseRangeList(rawParams['CONTROL_ROWS']) : [];
  const controlRows = new Set<number>(controlRowsList);

  const subtotalTcEmpresaCell = rawParams['SUBTOTAL_TC_EMPRESA_CELL'] || (rawParams['FILA_SUBTOTAL_TC_EMPRESA'] ? `${columnaTotalControl}${rawParams['FILA_SUBTOTAL_TC_EMPRESA']}` : undefined);
  if (subtotalTcEmpresaCell) {
    const row = parseInt(subtotalTcEmpresaCell.replace(/\D/g, ''), 10);
    if (!isNaN(row)) controlRows.add(row);
  }

  const reembolsoLabelCell = rawParams['REEMBOLSO_LABEL_CELL'];
  let filaReembolso = rawParams['FILA_REEMBOLSO'] ? parseInt(rawParams['FILA_REEMBOLSO'], 10) : undefined;
  if (reembolsoLabelCell) {
    filaReembolso = parseInt(reembolsoLabelCell.replace(/\D/g, ''), 10);
  }
  if (filaReembolso) controlRows.add(filaReembolso);

  // Buscar dinámicamente la fila del TOTAL DE GASTOS
  let filaTotalGastos = rawParams['FILA_TOTAL_GASTOS'] ? parseInt(rawParams['FILA_TOTAL_GASTOS'], 10) : 0;
  let totalGastosControlCell = rawParams['TOTAL_GASTOS_CONTROL_CELL'];

  if (!filaTotalGastos || isNaN(filaTotalGastos)) {
    // 1. Buscar explícitamente "TOTAL DE GASTOS", "TOTAL GASTOS", etc. desde abajo hacia arriba
    for (let r = rawRows.length - 1; r >= 8; r--) {
      const row = rawRows[r] || [];
      for (let c = 0; c < Math.min(row.length, 6); c++) {
        const val = String(row[c] || '').toUpperCase().trim();
        if (
          val === 'TOTAL DE GASTOS' ||
          val === 'TOTAL GASTOS' ||
          val === 'TOTAL DE COMPROBACIÓN' ||
          val === 'TOTAL COMPROBADO' ||
          val === 'TOTAL GENERAL'
        ) {
          filaTotalGastos = r + 1; // 1-indexed
          break;
        }
      }
      if (filaTotalGastos) break;
    }

    // 2. Si no se encontró exacto, buscar cualquier celda que contenga TOTAL sin ser TOTAL SEMANAL ni SUBTOTAL
    if (!filaTotalGastos) {
      for (let r = rawRows.length - 1; r >= 8; r--) {
        const row = rawRows[r] || [];
        for (let c = 0; c < Math.min(row.length, 6); c++) {
          const val = String(row[c] || '').toUpperCase().trim();
          if (val.includes('TOTAL') && !val.includes('SEMANAL') && !val.includes('SUBTOTAL')) {
            filaTotalGastos = r + 1;
            break;
          }
        }
        if (filaTotalGastos) break;
      }
    }
  }

  if (!filaTotalGastos || isNaN(filaTotalGastos)) {
    filaTotalGastos = rawRows.length >= 35 ? 43 : 26;
  }

  if (!totalGastosControlCell) {
    totalGastosControlCell = `${columnaTotalControl}${filaTotalGastos}`;
  }
  controlRows.add(filaTotalGastos);

  const celdaAnticipoOtorgado = rawParams['CELDA_ANTICIPO_OTORGADO'] || 'D4';

  // Fallback si no había rangos de filas explícitos en config:
  // Incluir todas las filas desde la fila 12 hasta antes del total
  if (gastosAnticipoRows.length === 0 && tcEmpresaRows.length === 0) {
    const startRow = fechaHeaderRow ? Math.max(fechaHeaderRow + 1, 12) : 12;
    const endRow = filaTotalGastos ? filaTotalGastos - 1 : (rawRows.length >= 35 ? 42 : 23);
    const rows: number[] = [];
    for (let r = startRow; r <= endRow; r++) {
      if (!controlRows.has(r)) {
        rows.push(r);
      }
    }
    gastosAnticipoRows = rows;
  }

  return {
    valid: true,
    config: {
      versionConfig: rawParams['VERSION_CONFIG'] || '2.0',
      plantillaId: rawParams['PLANTILLA_ID'] || 'DIMER_VIATICOS_MENSUAL',
      hojaPrincipal: realSheet,
      fechaHeaderRow,
      celdaFechaInicio,
      celdaFechaFin,
      columnasFecha,
      columnaConcepto,
      columnaTotalControl,
      celdaAnticipoOtorgado,
      gastosAnticipoRows,
      filasGastosAnticipoInicio: gastosAnticipoRows[0] || 13,
      filasGastosAnticipoFin: gastosAnticipoRows[gastosAnticipoRows.length - 1] || 23,
      tcEmpresaRows,
      filasTcEmpresaInicio: tcEmpresaRows[0] || (gastosAnticipoRows[0] || 13),
      filasTcEmpresaFin: tcEmpresaRows[tcEmpresaRows.length - 1] || (gastosAnticipoRows[gastosAnticipoRows.length - 1] || 23),
      subtotalTcEmpresaCell,
      personalRows,
      filasEfectivoPersonalInicio: personalRows[0] || 0,
      filasEfectivoPersonalFin: personalRows[personalRows.length - 1] || 0,
      filaReembolso,
      filaTotalGastos,
      totalGastosControlCell,
      controlRows,
      isAutoDetected: !configSheetName,
      conceptCatalog,
    },
  };
}

/**
 * Parser principal de Reporte de Gastos DIMER.
 * Lee partidas tanto por desglose diario (columnas de fecha) como por captura
 * directa en total de concepto (columna J), garantizando que jamás se pierda
 * ningún importe capturado por el colaborador.
 */
export function parseExcelExpenseReport(
  fileBufferOrBase64: Buffer | ArrayBuffer | string,
  tripStartDate?: string,
  tripEndDate?: string
): ExcelParseResult {
  try {
    let workbook: XLSX.WorkBook;

    if (typeof fileBufferOrBase64 === 'string') {
      const commaIdx = fileBufferOrBase64.indexOf(',');
      const b64 = commaIdx >= 0 ? fileBufferOrBase64.substring(commaIdx + 1) : fileBufferOrBase64;
      workbook = XLSX.read(b64, { type: 'base64', cellDates: true });
    } else {
      workbook = XLSX.read(fileBufferOrBase64, { type: 'buffer', cellDates: true });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        sheetName: '',
        items: [],
        totalExcel: 0,
        totalImported: 0,
        difference: 0,
        reconciliationStatus: 'DIFERENCIA_DETECTADA',
        warnings: [],
        dateColumnsCount: 0,
        detectedCategories: [],
        error: 'El archivo Excel no contiene hojas de cálculo legibles.',
      };
    }

    // PASO 1: LEER CONTRATO DIMER_CONFIG
    const configResult = parseDimerConfigFromWorkbook(workbook);
    if (!configResult.valid || !configResult.config) {
      return {
        success: false,
        sheetName: '',
        items: [],
        totalExcel: 0,
        totalImported: 0,
        difference: 0,
        reconciliationStatus: 'DIFERENCIA_DETECTADA',
        warnings: [],
        dateColumnsCount: 0,
        detectedCategories: [],
        error: configResult.error || 'La plantilla DIMER no contiene una configuración compatible con esta versión.',
      };
    }

    const config = configResult.config;
    const warnings: string[] = [];

    const sheet = workbook.Sheets[config.hojaPrincipal];
    if (!sheet) {
      return {
        success: false,
        sheetName: config.hojaPrincipal,
        items: [],
        totalExcel: 0,
        totalImported: 0,
        difference: 0,
        reconciliationStatus: 'DIFERENCIA_DETECTADA',
        warnings,
        dateColumnsCount: 0,
        detectedCategories: [],
        error: `No se pudo leer la hoja "${config.hojaPrincipal}".`,
      };
    }

    // Año de referencia
    let refYear = new Date().getFullYear();
    if (tripStartDate) {
      const parsedYear = new Date(tripStartDate).getFullYear();
      if (!isNaN(parsedYear) && parsedYear > 2000) refYear = parsedYear;
    }

    // PASO 2: EXTRAER COLUMNAS DE FECHAS
    const [startColStr, endColStr] = config.columnasFecha.split(':');
    const startColIdx = XLSX.utils.decode_col(startColStr || 'C');
    const endColIdx = XLSX.utils.decode_col(endColStr || 'I');
    const dateRow = config.fechaHeaderRow || 8;

    interface ConfigDateCol {
      colIndex: number;
      colLetter: string;
      dateIso: string;
      headerLabel: string;
    }

    const dateColumns: ConfigDateCol[] = [];

    for (let c = Math.min(startColIdx, endColIdx); c <= Math.max(startColIdx, endColIdx); c++) {
      const colLetter = XLSX.utils.encode_col(c);
      const cellRef = `${colLetter}${dateRow}`;
      const cellObj = sheet[cellRef];
      const cellVal = cellObj ? cellObj.v : null;

      const dateIso = parseExcelDateCell(cellVal, refYear);
      if (dateIso) {
        dateColumns.push({
          colIndex: c,
          colLetter,
          dateIso,
          headerLabel: String(cellVal || '').trim(),
        });
      }
    }

    // Fallback de fecha por defecto si ninguna celda de encabezado contenía fecha válida
    const defaultExpenseDate = dateColumns.length > 0
      ? dateColumns[0].dateIso
      : (tripStartDate || new Date().toISOString().split('T')[0]);

    // PASO 3: LECTURA DE PARTIDAS DE GASTO
    const items: ExcelParsedExpense[] = [];
    const detectedCategoriesSet = new Set<string>();

    const resolveCategory = (concept: string): ExpenseCategoryType | undefined => {
      const cLower = concept.toLowerCase().trim();
      if (config.conceptCatalog && config.conceptCatalog[cLower]?.category) {
        return config.conceptCatalog[cLower].category;
      }
      return mapConceptToCategory(concept);
    };

    // Función que procesa una fila específica
    const processRow = (
      r: number,
      paymentMethod: PaymentMethodType,
      sectionTitle: string
    ) => {
      if (config.controlRows.has(r)) {
        return; // Excluir filas de control como subtotales, reembolso y total general
      }

      const conceptCellRef = `${config.columnaConcepto}${r}`;
      const conceptObj = sheet[conceptCellRef];
      let rawConcept = conceptObj ? String(conceptObj.v || '').trim() : '';

      // Si la columna B estaba vacía, verificar si el concepto estaba en columna A
      if (!rawConcept) {
        const altConceptObj = sheet[`A${r}`];
        if (altConceptObj && typeof altConceptObj.v === 'string' && !/^\d+$/.test(altConceptObj.v.trim())) {
          rawConcept = altConceptObj.v.trim();
        }
      }

      if (!rawConcept) return;

      const upperConcept = rawConcept.toUpperCase();
      if (
        upperConcept === 'TOTAL' ||
        upperConcept === 'SUBTOTAL' ||
        upperConcept.startsWith('TOTAL ') ||
        upperConcept.startsWith('SUBTOTAL ') ||
        upperConcept.includes('SUBTOTAL GASTOS') ||
        upperConcept.includes('TOTAL DE GASTOS') ||
        upperConcept.includes('REEMBOLSO / REINTEGRO') ||
        upperConcept.includes('ANTICIPO DEPOSITADO') ||
        upperConcept.includes('ANTICIPO OTORGADO') ||
        upperConcept.includes('SALDO FINAL') ||
        upperConcept === 'CONCEPTO' ||
        upperConcept === 'CONCEPTO / CATEGORÍA' ||
        upperConcept === 'CONCEPTO / CATEGORIA' ||
        upperConcept === 'DESCRIPCION' ||
        upperConcept === 'DESCRIPCIÓN' ||
        upperConcept === 'FECHA' ||
        upperConcept === 'CATEGORIA' ||
        upperConcept === 'CATEGORÍA'
      ) {
        return; // Excluir renglones de totales y encabezados de columnas
      }

      detectedCategoriesSet.add(rawConcept);

      // Si la sección activa es OTROS GASTOS o GASTOS DE OFICINA y el concepto es un subconcepto
      // (ej. "Comida", "Propina", "Estancia/ Hospedaje"):
      let displayConcept = rawConcept;
      if (sectionTitle.toUpperCase().includes('OTRO') && !rawConcept.toUpperCase().includes('OTRO')) {
        displayConcept = `Otros Gastos - ${rawConcept}`;
      } else if (sectionTitle.toUpperCase().includes('OFICINA') && !rawConcept.toUpperCase().includes('OFICINA')) {
        displayConcept = `Gastos de Oficina - ${rawConcept}`;
      }

      const mappedCategory = resolveCategory(rawConcept) || resolveCategory(displayConcept);
      const resolvedPaymentMethod: PaymentMethodType =
        paymentMethod === 'TARJETA_EMPRESA' ? 'ANTICIPO' : paymentMethod;

      // CASO 1: Buscar montos desglosados en columnas de fecha diarias (C..I)
      let foundDailyItems = false;

      for (const dCol of dateColumns) {
        const amountCellRef = `${dCol.colLetter}${r}`;
        const amountObj = sheet[amountCellRef];

        if (!amountObj || amountObj.v === null || amountObj.v === undefined || amountObj.v === '') {
          continue;
        }

        let numVal: number;
        if (typeof amountObj.v === 'number') {
          numVal = amountObj.v;
        } else {
          numVal = parseFloat(String(amountObj.v).replace(/[$,\s]/g, ''));
        }

        if (isNaN(numVal) || numVal <= 0) continue;

        const amount = Number(numVal.toFixed(2));
        foundDailyItems = true;

        let isOutOfRange = false;
        if (tripStartDate && tripEndDate) {
          if (dCol.dateIso < tripStartDate || dCol.dateIso > tripEndDate) {
            isOutOfRange = true;
          }
        }

        items.push({
          id: `excel_${Date.now()}_${items.length}_${Math.random().toString(36).substring(2, 6)}`,
          concept: displayConcept,
          sourceCategory: rawConcept,
          amount,
          expenseDate: dCol.dateIso,
          category: mappedCategory,
          paymentMethod: resolvedPaymentMethod,
          sectionTitle,
          excelCellRef: amountCellRef,
          isOutOfRange,
        });

        if (isOutOfRange) {
          warnings.push(
            `Partida "${displayConcept}" con fecha ${dCol.dateIso} ($${amount.toFixed(2)}) se encuentra fuera del período oficial del viaje.`
          );
        }
      }

      // CASO 2: Si el usuario NO desglosó por día pero capturó el total en la columna J
      if (!foundDailyItems) {
        const totalCellRef = `${config.columnaTotalControl}${r}`;
        const totalObj = sheet[totalCellRef];

        if (totalObj && totalObj.v !== null && totalObj.v !== undefined && totalObj.v !== '') {
          let numVal: number;
          if (typeof totalObj.v === 'number') {
            numVal = totalObj.v;
          } else {
            numVal = parseFloat(String(totalObj.v).replace(/[$,\s]/g, ''));
          }

          if (!isNaN(numVal) && numVal > 0) {
            const amount = Number(numVal.toFixed(2));

            items.push({
              id: `excel_${Date.now()}_${items.length}_${Math.random().toString(36).substring(2, 6)}`,
              concept: displayConcept,
              sourceCategory: rawConcept,
              amount,
              expenseDate: defaultExpenseDate,
              category: mappedCategory,
              paymentMethod: resolvedPaymentMethod,
              sectionTitle,
              excelCellRef: totalCellRef,
              isOutOfRange: false,
            });
          }
        }
      }
    };

    // REGLA OPERATIVA DIMER:
    // La empresa NO cuenta actualmente con tarjetas corporativas.
    // Todo el dinero comprobado corresponde al anticipo depositado por Tesorería
    // en la tarjeta personal del colaborador.
    const isSectionHeaderRow = (r: number): boolean => {
      const colA = sheet[`A${r}`]?.v;
      const colB = sheet[`${config.columnaConcepto}${r}`]?.v;
      const text = String(colB || '').trim().toUpperCase();
      const isNoIndex = colA === undefined || colA === null || colA === '' || isNaN(Number(colA));
      const isKnownSection =
        text === 'VIAJES' ||
        text === 'COMIDAS' ||
        text === 'GASTOS DE OFICINA' ||
        text === 'OTROS GASTOS' ||
        text === 'GASTOS EN EFECTIVO' ||
        text === 'TARJETA PERSONAL' ||
        text === 'DESEMBOLSO PERSONAL' ||
        text.includes('VIAJE') ||
        text.includes('COMIDA') ||
        text.includes('OFICINA') ||
        text.includes('OTRO GASTO') ||
        text === 'OTROS GASTOS';

      let hasAmounts = false;
      for (const dCol of dateColumns) {
        const v = sheet[`${dCol.colLetter}${r}`]?.v;
        if (v !== undefined && v !== null && v !== '') {
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,\s]/g, ''));
          if (!isNaN(n) && n > 0) {
            hasAmounts = true;
            break;
          }
        }
      }
      const jVal = sheet[`${config.columnaTotalControl}${r}`]?.v;
      if (jVal !== undefined && jVal !== null && jVal !== '') {
        const n = typeof jVal === 'number' ? jVal : parseFloat(String(jVal).replace(/[$,\s]/g, ''));
        if (!isNaN(n) && n > 0) hasAmounts = true;
      }

      return isNoIndex && isKnownSection && !hasAmounts;
    };

    const minRow = (config.fechaHeaderRow || 8) + 1;
    const maxScanRow = config.filaTotalGastos ? config.filaTotalGastos - 1 : 50;
    let currentSectionTitle = 'GASTOS CON ANTICIPO (TARJETA PERSONAL)';

    for (let r = minRow; r <= maxScanRow; r++) {
      if (config.controlRows.has(r)) continue;

      const conceptCellRef = `${config.columnaConcepto}${r}`;
      const conceptObj = sheet[conceptCellRef] || sheet[`A${r}`];
      const rawConcept = conceptObj ? String(conceptObj.v || '').trim() : '';
      if (!rawConcept) continue;

      if (isSectionHeaderRow(r)) {
        currentSectionTitle = rawConcept.toUpperCase();
        continue;
      }

      const isPersonalRow = config.personalRows.includes(r);
      const paymentMethod: PaymentMethodType = isPersonalRow ? 'PERSONAL_REEMBOLSO' : 'ANTICIPO';
      processRow(r, paymentMethod, currentSectionTitle);
    }

    // PASO 4: TOTAL DE CONTROL Y CONCILIACIÓN
    let excelReportedTotal: number | null = null;

    // Buscar en celda de control configurada (ej. J47)
    if (config.totalGastosControlCell) {
      const cellObj = sheet[config.totalGastosControlCell];
      if (cellObj && cellObj.v !== null && cellObj.v !== undefined) {
        const val = typeof cellObj.v === 'number'
          ? cellObj.v
          : parseFloat(String(cellObj.v).replace(/[$,\s]/g, ''));
        if (!isNaN(val) && val > 0) {
          excelReportedTotal = Number(val.toFixed(2));
        }
      }
    }

    // Si no se encontró en la celda exacta, buscar en fila de control
    if (excelReportedTotal === null && config.filaTotalGastos) {
      const r = config.filaTotalGastos;
      for (let c = 0; c < 15; c++) {
        const ref = `${XLSX.utils.encode_col(c)}${r}`;
        const obj = sheet[ref];
        if (obj && obj.v !== null && obj.v !== undefined) {
          const val = typeof obj.v === 'number'
            ? obj.v
            : parseFloat(String(obj.v).replace(/[$,\s]/g, ''));
          if (!isNaN(val) && val > 0) {
            excelReportedTotal = Number(val.toFixed(2));
            break;
          }
        }
      }
    }

    const totalImported = Number(items.reduce((sum, it) => sum + it.amount, 0).toFixed(2));
    const finalTotalExcel = excelReportedTotal !== null ? excelReportedTotal : totalImported;
    const difference = Number(Math.abs(finalTotalExcel - totalImported).toFixed(2));
    const reconciliationStatus = difference <= 0.01 ? 'CONCILIACION_CORRECTA' : 'DIFERENCIA_DETECTADA';

    if (reconciliationStatus === 'DIFERENCIA_DETECTADA') {
      warnings.push(
        `Se detectó una diferencia de $${difference.toFixed(2)} MXN entre el Total del Excel ($${finalTotalExcel.toFixed(2)}) y la suma de las partidas importadas ($${totalImported.toFixed(2)}). Revisa las partidas antes de confirmar.`
      );
    }

    return {
      success: true,
      sheetName: config.hojaPrincipal,
      items,
      totalExcel: finalTotalExcel,
      totalImported,
      difference,
      reconciliationStatus,
      warnings,
      dateColumnsCount: dateColumns.length,
      detectedCategories: Array.from(detectedCategoriesSet),
      config,
    };
  } catch (err: any) {
    return {
      success: false,
      sheetName: '',
      items: [],
      totalExcel: 0,
      totalImported: 0,
      difference: 0,
      reconciliationStatus: 'DIFERENCIA_DETECTADA',
      warnings: [],
      dateColumnsCount: 0,
      detectedCategories: [],
      error: `Error al procesar el archivo Excel: ${err?.message || 'Estructura inválida'}`,
    };
  }
}
