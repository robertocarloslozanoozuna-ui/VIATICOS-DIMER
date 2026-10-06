import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const wb = XLSX.utils.book_new();

// -------------------------------------------------------------
// HOJA 1: REPORTE DE GASTOS MENSUAL
// -------------------------------------------------------------
const wsData = [
  // Fila 1 - 5: Encabezado institucional DIMER
  ['DIMER CORPORATIVO S.A. DE C.V.'],
  ['REPORTE OFICIAL DE GASTOS MENSUAL - COMPROBACIÓN DE VIÁTICOS'],
  ['FOLIO:', 'VIAT-2026-000001', 'EMPLEADO:', 'Juan Perez'],
  ['PERIODO:', '2026-09-21 al 2026-09-27', 'ANTICIPO DEPOSITADO EN TARJETA PERSONAL:', 7850],
  ['* NOTA OFICIAL DIMER: Todo el dinero comprobado corresponde al anticipo depositado por Tesorería a la tarjeta personal del colaborador. La empresa NO cuenta actualmente con tarjetas corporativas.'],
  [],
  [],
  [],
  [],
  [],
  // Fila 11: Título de Sección de Gastos
  ['', 'GASTOS CUBIERTOS CON ANTICIPO (DEPOSITADOS EN TARJETA PERSONAL)'],
  // Fila 12: Encabezados de tabla
  ['', 'CONCEPTO / CATEGORÍA', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', 'TOTAL'],
  // Filas 13 - 23: Conceptos
  ['', 'Hospedaje', 1500, 800, 0, 0, 0, 0, 0, 2300],
  ['', 'Gasolina', 650, 0, 450, 0, 0, 0, 0, 1100],
  ['', 'Casetas', 320, 0, 320, 0, 0, 0, 0, 640],
  ['', 'Rentas de Autos / Traslados', 0, 850, 0, 0, 0, 0, 0, 850],
  ['', 'Desayuno', 150, 160, 140, 0, 0, 0, 0, 450],
  ['', 'Comida', 320, 280, 350, 0, 0, 0, 0, 950],
  ['', 'Cena', 250, 220, 280, 0, 0, 0, 0, 750],
  ['', 'Taxi / Uber', 180, 0, 220, 0, 0, 0, 0, 400],
  ['', 'Estacionamiento', 120, 0, 0, 0, 0, 0, 0, 120],
  ['', 'Propina / Gastos Menores', 50, 40, 50, 0, 0, 0, 0, 140],
  ['', 'Papelería / Otros', 0, 150, 0, 0, 0, 0, 0, 150],
  ['', 'Gastos de Oficina', 0, 0, 0, 0, 0, 0, 0, 0],
  ['', 'Otros Gastos (Comidas / Imprevistos)', 0, 0, 0, 0, 0, 0, 0, 0],
  // Fila 26: Subtotal
  ['', 'SUBTOTAL GASTOS CON ANTICIPO (TARJETA PERSONAL)', 3540, 2500, 1810, 0, 0, 0, 0, 7850],
  // Fila 27: Desembolso personal adicional (si aplica)
  ['', 'DESEMBOLSO ADICIONAL DEL COLABORADOR (A REEMBOLSAR)', 0, 0, 0, 0, 0, 0, 0, 0],
  // Fila 28: Reintegro a Finanzas
  ['', 'REEMBOLSO / REINTEGRO A FINANZAS (DEVOLUCIÓN DE SOBRANTE)', '', '', '', '', '', '', '', 0],
  // Fila 29: Total Gastos Comprobados
  ['', 'TOTAL DE GASTOS COMPROBADOS', 3540, 2500, 1810, 0, 0, 0, 0, 7850],
  // Fila 30: Importe depositado al colaborador
  ['', 'IMPORTE DEPOSITADO AL COLABORADOR', '', '', '', '', '', '', '', 7850],
  // Fila 31: Saldo no utilizado
  ['', 'SALDO NO UTILIZADO', '', '', '', '', '', '', '', 0],
  // Fila 32: Importe a devolver a DIMER
  ['', 'IMPORTE A DEVOLVER A DIMER', '', '', '', '', '', '', '', 0],
  // Fila 33: Importe adicional a reembolsar al colaborador
  ['', 'IMPORTE ADICIONAL A REEMBOLSAR AL COLABORADOR', '', '', '', '', '', '', '', 0]
];

const ws1 = XLSX.utils.aoa_to_sheet(wsData);

// Ancho de columnas para excelente legibilidad en Excel
ws1['!cols'] = [
  { wch: 10 },  // Col A
  { wch: 48 },  // Col B: Concepto
  { wch: 14 },  // Col C: Fecha 1
  { wch: 14 },  // Col D: Fecha 2
  { wch: 14 },  // Col E: Fecha 3
  { wch: 14 },  // Col F: Fecha 4
  { wch: 14 },  // Col G: Fecha 5
  { wch: 14 },  // Col H: Fecha 6
  { wch: 14 },  // Col I: Fecha 7
  { wch: 18 }   // Col J: Total
];

XLSX.utils.book_append_sheet(wb, ws1, 'REPORTE DE GASTOS MENSUAL');

// -------------------------------------------------------------
// HOJA 2: DIMER_CONFIG (Contrato inteligente)
// -------------------------------------------------------------
const configData = [
  ['PARAMETRO', 'VALOR', 'DESCRIPCION'],
  ['VERSION_CONFIG', '2.2', 'Versión actualizada del contrato: anticipo a tarjeta personal sin tarjetas corporativas'],
  ['PLANTILLA_ID', 'DIMER_VIATICOS_MENSUAL', 'Identificador oficial de plantilla DIMER'],
  ['HOJA_PRINCIPAL', 'REPORTE DE GASTOS MENSUAL', 'Nombre de la hoja de cálculo de gastos'],
  ['CELDA_FECHA_INICIO', 'C12', 'Celda donde inicia el encabezado de fechas'],
  ['CELDA_FECHA_FIN', 'I12', 'Celda donde finaliza el encabezado de fechas'],
  ['COLUMNAS_FECHA', 'C:I', 'Rango de columnas que contienen días del viaje'],
  ['COLUMNA_CONCEPTO', 'B', 'Columna que contiene la descripción del gasto'],
  ['COLUMNA_TOTAL_CONTROL', 'J', 'Columna de control de totales acumulados'],
  ['CELDA_ANTICIPO_OTORGADO', 'D4', 'Celda del anticipo depositado en tarjeta personal'],
  ['FILAS_GASTOS_ANTICIPO_INICIO', '13', 'Fila inicial de gastos con anticipo en tarjeta personal'],
  ['FILAS_GASTOS_ANTICIPO_FIN', '25', 'Fila final de gastos con anticipo en tarjeta personal'],
  ['GASTOS_ANTICIPO_DATA_ROWS', '13:25', 'Filas de gastos cubiertos con anticipo depositado'],
  ['FILA_SUBTOTAL_ANTICIPO', '26', 'Fila de subtotal de gastos con anticipo'],
  ['FILA_DESEMBOLSO_PERSONAL', '27', 'Fila de desembolso adicional del colaborador a reembolsar'],
  ['FILA_REEMBOLSO', '28', 'Fila de control de reembolso/reintegro a Finanzas'],
  ['FILA_TOTAL_GASTOS', '29', 'Fila de control de total general de gastos comprobados'],
  ['TOTAL_GASTOS_CONTROL_CELL', 'J29', 'Celda de control de total general de gastos comprobados'],
  ['CONTROL_ROWS', '26,27,28,29,30,31,32,33', 'Filas de control y subtotales excluidas de partidas directas'],
  // Retrocompatibilidad para contratos legacy
  ['FILAS_TC_EMPRESA_INICIO', '13', 'Compatibilidad retroactiva: fila inicial de gastos con anticipo'],
  ['FILAS_TC_EMPRESA_FIN', '25', 'Compatibilidad retroactiva: fila final de gastos con anticipo'],
  ['TC_EMPRESA_DATA_ROWS', '13:25', 'Compatibilidad retroactiva: gastos anticipo'],
  ['FILA_SUBTOTAL_TC_EMPRESA', '26', 'Compatibilidad retroactiva: fila de subtotal de gastos con anticipo'],
  ['FILAS_EFECTIVO_PERSONAL_INICIO', '27', 'Fila inicial de desembolso adicional personal'],
  ['FILAS_EFECTIVO_PERSONAL_FIN', '27', 'Fila final de desembolso adicional personal'],
  [],
  ['CATALOGO_CONCEPTOS', 'CATEGORIA_DIMER', 'FORMA_PAGO_DEFAULT'],
  ['Hospedaje', 'HOSPEDAJE', 'ANTICIPO'],
  ['Gasolina', 'GASOLINA', 'ANTICIPO'],
  ['Casetas', 'CASETAS', 'ANTICIPO'],
  ['Rentas de Autos / Traslados', 'TRANSPORTE_LOCAL', 'ANTICIPO'],
  ['Desayuno', 'ALIMENTOS', 'ANTICIPO'],
  ['Comida', 'ALIMENTOS', 'ANTICIPO'],
  ['Comidas', 'ALIMENTOS', 'ANTICIPO'],
  ['Cena', 'ALIMENTOS', 'ANTICIPO'],
  ['Taxi / Uber', 'TRANSPORTE_LOCAL', 'ANTICIPO'],
  ['Estacionamiento', 'ESTACIONAMIENTO', 'ANTICIPO'],
  ['Propina / Gastos Menores', 'GASTOS_MENORES', 'ANTICIPO'],
  ['Papelería / Otros', 'GASTOS_MENORES', 'ANTICIPO'],
  ['Gastos de Oficina', 'GASTOS_MENORES', 'ANTICIPO'],
  ['Otros Gastos', 'GASTOS_MENORES', 'ANTICIPO'],
  ['Viajes', 'TRANSPORTE_FORANEO', 'ANTICIPO']
];

const ws2 = XLSX.utils.aoa_to_sheet(configData);
ws2['!cols'] = [
  { wch: 32 },
  { wch: 28 },
  { wch: 75 }
];

XLSX.utils.book_append_sheet(wb, ws2, 'DIMER_CONFIG');

const targetPath = path.join(process.cwd(), 'data', 'Reporte de Gastos DIMER.xlsx');
XLSX.writeFile(wb, targetPath);
console.log('Reporte de Gastos DIMER.xlsx generado exitosamente en:', targetPath);
