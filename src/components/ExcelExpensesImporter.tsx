import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  RefreshCw,
  Trash2,
  Check,
  X,
  FileCheck,
  Calendar,
  Layers,
  Info
} from 'lucide-react';
import type {
  ExpenseItem,
  ExpenseFileAttachment,
  ExcelAuditSummary,
  ExcelParsedExpense,
  ExpenseCategoryType,
  PaymentMethodType,
} from '../types.js';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from './ExcelExpensesTable.js';
import { authFetch } from '../utils/apiHelper.js';

interface ExcelExpensesImporterProps {
  folio: string;
  tripStartDate?: string;
  tripEndDate?: string;
  canEdit: boolean;
  existingOriginalFile?: ExpenseFileAttachment;
  existingAuditSummary?: ExcelAuditSummary;
  onImportConfirmed: (
    items: ExpenseItem[],
    originalFile: ExpenseFileAttachment,
    summary: ExcelAuditSummary
  ) => void;
  onDownloadOriginalFile: (file: ExpenseFileAttachment) => void;
}

export const ExcelExpensesImporter: React.FC<ExcelExpensesImporterProps> = ({
  folio,
  tripStartDate,
  tripEndDate,
  canEdit,
  existingOriginalFile,
  existingAuditSummary,
  onImportConfirmed,
  onDownloadOriginalFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Preview state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [parsedItems, setParsedItems] = useState<ExcelParsedExpense[]>([]);
  const [originalExcelFile, setOriginalExcelFile] = useState<ExpenseFileAttachment | null>(null);
  const [auditSummary, setAuditSummary] = useState<ExcelAuditSummary | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [excelTotal, setExcelTotal] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  async function handleFileSelected(file: File) {
    setImportError(null);
    setDuplicateWarning(null);

    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (ext !== 'xlsx') {
      setImportError(`Formato no admitido (.${ext}). Solo se permite el formato oficial Excel (.xlsx).`);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setImportError(`El archivo supera el límite de 15 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    setProcessing(true);

    try {
      // Leer a Base64 dataUrl
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer el archivo desde el dispositivo'));
        reader.readAsDataURL(file);
      });

      // Llamada al backend para procesar, validar y almacenar el archivo
      const res = await authFetch('/api/expenses/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio,
          file: {
            name: file.name,
            size: file.size,
            type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dataUrl,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar el archivo Excel.');
      }

      setParsedItems(data.items || []);
      setOriginalExcelFile(data.originalExcelFile);
      setAuditSummary(data.excelAuditSummary);
      setParseWarnings(data.warnings || []);
      setExcelTotal(data.totalExcel || 0);

      if (data.isDuplicate) {
        setDuplicateWarning(
          `Advertencia: El archivo "${file.name}" ya había sido importado anteriormente en este folio.`
        );
      }

      setShowPreviewModal(true);
    } catch (err: any) {
      setImportError(err.message || 'Error inesperado al importar el Excel.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  // Modificaciones en vista previa antes de importar
  function handleUpdatePreviewItem(
    index: number,
    field: keyof ExcelParsedExpense,
    value: any
  ) {
    setParsedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function handleDeletePreviewItem(index: number) {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Cálculo en tiempo real de la conciliación en el preview
  const currentImportedTotal = Number(
    parsedItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0).toFixed(2)
  );
  const currentDifference = Number(Math.abs(excelTotal - currentImportedTotal).toFixed(2));
  const currentReconciliationStatus =
    currentDifference === 0 ? 'CONCILIACION_CORRECTA' : 'DIFERENCIA_DETECTADA';

  function handleConfirmImport() {
    if (!originalExcelFile || !auditSummary) return;

    // Convertir partidas del preview a ExpenseItems oficiales del sistema
    const convertedItems: ExpenseItem[] = parsedItems.map((p, idx) => ({
      id: `item_excel_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      concept: p.concept,
      sourceCategory: p.sourceCategory,
      amount: Number(p.amount) || 0,
      type: 'TICKET', // Tipo inicial; el colaborador podrá adjuntar PDF o XML complementario
      expenseDate: p.expenseDate,
      category: p.category,
      paymentMethod: p.paymentMethod || 'ANTICIPO',
      importedFromExcel: true,
      excelRowIndex: idx + 1,
      createdAt: new Date().toISOString(),
    }));

    const updatedSummary: ExcelAuditSummary = {
      ...auditSummary,
      totalImported: currentImportedTotal,
      difference: currentDifference,
      itemsCount: convertedItems.length,
      reconciliationStatus: currentReconciliationStatus,
    };

    onImportConfirmed(convertedItems, originalExcelFile, updatedSummary);
    setShowPreviewModal(false);
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden space-y-3">
      {/* Header */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span>Importar Reporte de Gastos Excel (.xlsx)</span>
              <span className="px-2 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-mono">
                DIMER Oficial
              </span>
            </h3>
            <p className="text-[11px] text-emerald-200/90">
              Carga tu archivo <strong>Reporte de Gastos DIMER.xlsx</strong> para generar automáticamente tus partidas y conciliar totales.
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/expenses/download-template"
            download="Reporte de Gastos DIMER.xlsx"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-700 text-emerald-100 hover:text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer shrink-0 border border-emerald-500/40"
            title="Descargar la plantilla oficial Excel de Reporte de Gastos DIMER con contrato DIMER_CONFIG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Plantilla Oficial (.xlsx)</span>
          </a>

          {/* Botón de descarga de Excel original si ya existe uno cargado */}
          {existingOriginalFile && (
            <button
              type="button"
              onClick={() => onDownloadOriginalFile(existingOriginalFile)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
              title="Descargar exactamente el archivo Excel original subido para este folio"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Reporte Subido</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Info Banner sobre Excel original */}
        {existingOriginalFile && existingAuditSummary && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">
                  Archivo Excel en Expediente: <strong>{existingOriginalFile.name}</strong> ({formatFileSize(existingOriginalFile.size)})
                </p>
                <p className="text-[11px] text-emerald-800">
                  Subido por <strong>{existingAuditSummary.uploadedBy || 'Colaborador'}</strong> el {new Date(existingOriginalFile.uploadedAt).toLocaleString('es-MX')} &bull; {existingAuditSummary.itemsCount} partida(s) &bull; Total Excel: {formatCurrency(existingAuditSummary.totalExcel)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                existingAuditSummary.reconciliationStatus === 'CONCILIACION_CORRECTA'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {existingAuditSummary.reconciliationStatus === 'CONCILIACION_CORRECTA'
                  ? '✓ Conciliación Exacta'
                  : `Diferencia: ${formatCurrency(existingAuditSummary.difference)}`}
              </span>
            </div>
          </div>
        )}

        {/* Zona de Arrastre / Selección (Sólo si canEdit) */}
        {canEdit && (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/70'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="w-10 h-10 bg-white rounded-full shadow-2xs border border-slate-200 flex items-center justify-center mx-auto mb-2 text-emerald-700">
                {processing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>

              <p className="text-xs font-bold text-slate-800">
                {processing
                  ? 'Leyendo e interpretando archivo Excel...'
                  : 'Arrastra tu archivo "Reporte de Gastos DIMER.xlsx" aquí o haz clic para examinar'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Formato admitido: <strong>.xlsx</strong> &bull; Hoja principal: <strong>REPORTE DE GASTOS MENSUAL</strong> &bull; Límite: 15 MB
              </p>
            </div>

            {importError && (
              <div className="mt-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-rose-950 font-bold block">Aviso de lectura de plantilla:</strong>
                    <span>{importError}</span>
                  </div>
                </div>
                <a
                  href="/api/expenses/download-template"
                  download="Reporte de Gastos DIMER.xlsx"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla Oficial</span>
                </a>
              </div>
            )}

            {duplicateWarning && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE VISTA PREVIA Y CONCILIACIÓN ANTES DE CONFIRMAR IMPORTACIÓN */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[650] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <span>Revisión y Conciliación del Reporte Excel</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-mono">
                      {parsedItems.length} partidas detectadas
                    </span>
                  </h4>
                  <p className="text-[11px] text-emerald-200/90 truncate max-w-md">
                    Archivo: <strong>{originalExcelFile?.name}</strong> &bull; Hoja: <strong>{auditSummary?.sheetName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto grow">
              {/* Tarjeta de Conciliación de Totales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Total Declarado en Excel:
                  </span>
                  <span className="font-mono text-base font-black text-slate-900">
                    {formatCurrency(excelTotal)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    (Renglón de control "TOTAL DE GASTOS")
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-xs">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                    Suma de Partidas a Importar:
                  </span>
                  <span className="font-mono text-base font-black text-emerald-950">
                    {formatCurrency(currentImportedTotal)}
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    ({parsedItems.length} celdas con importe mayor a 0)
                  </span>
                </div>

                <div className={`p-3 rounded-lg border text-xs ${
                  currentReconciliationStatus === 'CONCILIACION_CORRECTA'
                    ? 'border-emerald-300 bg-emerald-100/50 text-emerald-950'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    Diferencia de Conciliación:
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-base font-black">
                      {formatCurrency(currentDifference)}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border ${
                      currentReconciliationStatus === 'CONCILIACION_CORRECTA'
                        ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                        : 'bg-amber-200 text-amber-900 border-amber-400'
                    }`}>
                      {currentReconciliationStatus === 'CONCILIACION_CORRECTA'
                        ? '✓ Conciliación Exacta'
                        : '⚠ Diferencia Detectada'}
                    </span>
                  </div>
                  <span className="text-[10px] opacity-80 block mt-0.5">
                    {currentReconciliationStatus === 'CONCILIACION_CORRECTA'
                      ? 'La suma de las celdas coincide al 100% con el total del Excel.'
                      : 'Revisa las partidas; puedes editarlas antes de confirmar.'}
                  </span>
                </div>
              </div>

              {/* Advertencias detectadas */}
              {parseWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Observaciones de la lectura del Excel:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                    {parseWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tabla de Partidas Detectadas */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Partidas extraídas (puedes ajustar fecha, categoría, forma de pago o monto):</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {parsedItems.length} registros
                  </span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2 px-2 text-center w-8">#</th>
                        <th className="py-2 px-2.5 min-w-[110px]">Fecha</th>
                        <th className="py-2 px-2.5 min-w-[160px]">Concepto Original</th>
                        <th className="py-2 px-2.5 min-w-[170px]">Categoría Mapeada</th>
                        <th className="py-2 px-2.5 min-w-[150px]">Forma de Pago</th>
                        <th className="py-2 px-2.5 text-right min-w-[110px]">Importe (MXN)</th>
                        <th className="py-2 px-2 text-center w-10">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {parsedItems.map((item, idx) => (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            item.isOutOfRange ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="py-1.5 px-2 text-center font-mono text-[10px] text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Fecha */}
                          <td className="py-1.5 px-2.5">
                            <input
                              type="date"
                              value={item.expenseDate}
                              onChange={(e) =>
                                handleUpdatePreviewItem(idx, 'expenseDate', e.target.value)
                              }
                              className={`w-full text-xs py-0.5 px-1.5 border rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none ${
                                item.isOutOfRange ? 'border-amber-400 bg-amber-50/80' : 'border-slate-300'
                              }`}
                            />
                            {item.isOutOfRange && (
                              <span className="text-[9px] text-amber-700 font-bold block mt-0.5">
                                ⚠ Fuera de periodo
                              </span>
                            )}
                          </td>

                          {/* Concepto Original */}
                          <td className="py-1.5 px-2.5">
                            <input
                              type="text"
                              value={item.concept}
                              onChange={(e) =>
                                handleUpdatePreviewItem(idx, 'concept', e.target.value)
                              }
                              className="w-full text-xs py-0.5 px-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none font-medium"
                            />
                            {item.sectionTitle && (
                              <span className="text-[9px] text-slate-400 block truncate" title={item.sectionTitle}>
                                Sec: {item.sectionTitle}
                              </span>
                            )}
                          </td>

                          {/* Categoría Mapeada */}
                          <td className="py-1.5 px-2.5">
                            <select
                              value={item.category || ''}
                              onChange={(e) =>
                                handleUpdatePreviewItem(
                                  idx,
                                  'category',
                                  (e.target.value as ExpenseCategoryType) || undefined
                                )
                              }
                              className="w-full text-xs py-0.5 px-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            >
                              <option value="">Pendiente de clasificación...</option>
                              {CATEGORY_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.iconDesc} {c.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Forma de Pago */}
                          <td className="py-1.5 px-2.5">
                            <select
                              value={item.paymentMethod || 'ANTICIPO'}
                              onChange={(e) =>
                                handleUpdatePreviewItem(
                                  idx,
                                  'paymentMethod',
                                  (e.target.value as PaymentMethodType) || undefined
                                )
                              }
                              className="w-full text-xs py-0.5 px-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            >
                              
                              {PAYMENT_METHOD_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Importe */}
                          <td className="py-1.5 px-2.5 text-right">
                            <div className="relative">
                              <span className="absolute left-1.5 top-0.5 text-slate-400 text-xs">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.amount}
                                onChange={(e) =>
                                  handleUpdatePreviewItem(
                                    idx,
                                    'amount',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full text-right text-xs py-0.5 pl-4 pr-1.5 font-mono font-bold border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none text-slate-900"
                              />
                            </div>
                          </td>

                          {/* Acción Quitar */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePreviewItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Eliminar partida"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600">
                Al confirmar, se agregarán estas <strong>{parsedItems.length}</strong> partidas a la matriz de comprobación y se conservará el Excel original para Finanzas.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={parsedItems.length === 0 || parsedItems.some((p) => !p.category || !p.paymentMethod)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>IMPORTAR GASTOS AL EXPEDIENTE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
