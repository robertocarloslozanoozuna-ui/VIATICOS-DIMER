import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  FileCode,
  Image,
  Download,
  Eye,
  AlertCircle,
  Calendar,
  CreditCard,
  Building,
  User,
  Paperclip,
  Check,
  X,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import type {
  ExpenseItem,
  ExpenseFileAttachment,
  ExpenseCategoryType,
  PaymentMethodType,
  ExpenseType
} from '../types.js';

interface ExcelExpensesTableProps {
  items: ExpenseItem[];
  startDate?: string;
  endDate?: string;
  canEdit: boolean;
  availableAttachments: ExpenseFileAttachment[];
  pendingFiscalXmls?: ExpenseFileAttachment[];
  onChangeItems: (items: ExpenseItem[]) => void;
  onOpenBulkUploader?: () => void;
  onPreviewAttachment?: (file: ExpenseFileAttachment) => void;
  onAssignPendingXml?: (file: ExpenseFileAttachment, rowId: string) => void;
  onUnassignXml?: (file: ExpenseFileAttachment) => void;
}

export const CATEGORY_OPTIONS: { value: ExpenseCategoryType; label: string; iconDesc: string }[] = [
  { value: 'HOSPEDAJE', label: 'Hospedaje (Hotel / Alojamiento)', iconDesc: '🏨' },
  { value: 'GASOLINA', label: 'Gasolina / Combustible', iconDesc: '⛽' },
  { value: 'CASETAS', label: 'Casetas y Peajes', iconDesc: '🛣️' },
  { value: 'TRANSPORTE_FORANEO', label: 'Transporte Foráneo (Vuelos / Boletos)', iconDesc: '✈️' },
  { value: 'TRANSPORTE_LOCAL', label: 'Transporte Local (Taxi / Uber / Didi)', iconDesc: '🚕' },
  { value: 'ALIMENTOS', label: 'Alimentos y Consumo', iconDesc: '🍽️' },
  { value: 'ESTACIONAMIENTO', label: 'Estacionamiento', iconDesc: '🅿️' },
  { value: 'GASTOS_MENORES', label: 'Gastos Menores / Imprevistos', iconDesc: '📦' },
];

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodType; label: string; badgeClass: string }[] = [
  { value: 'ANTICIPO', label: 'Pago con tarjeta', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'PERSONAL_REEMBOLSO', label: 'Pago con efectivo', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
];

export const ExcelExpensesTable: React.FC<ExcelExpensesTableProps> = ({
  items,
  startDate,
  endDate,
  canEdit,
  availableAttachments,
  pendingFiscalXmls = [],
  onChangeItems,
  onOpenBulkUploader,
  onPreviewAttachment,
  onAssignPendingXml,
  onUnassignXml,
}) => {
  const [selectedFileModalRowId, setSelectedFileModalRowId] = useState<string | null>(null);

  // Generate dynamic date vector from travel range
  const travelDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    const dates: string[] = [];
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return [];
      }
      const curr = new Date(start);
      // Limit to 45 days max to prevent infinite loop on invalid dates
      let count = 0;
      while (curr <= end && count < 45) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
        count++;
      }
    } catch {
      return [];
    }
    return dates;
  }, [startDate, endDate]);

  const minDate = travelDates.length > 0 ? travelDates[0] : undefined;
  const maxDate = travelDates.length > 0 ? travelDates[travelDates.length - 1] : undefined;

  function handleUpdateField<K extends keyof ExpenseItem>(
    index: number,
    field: K,
    value: ExpenseItem[K]
  ) {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    onChangeItems(updated);
  }

  function handleAddRow(initialFile?: ExpenseFileAttachment) {
    const defaultDate = travelDates.length > 0 ? travelDates[0] : new Date().toISOString().split('T')[0];
    const detectedType = initialFile?.analysis?.documentType;
    const isFactura = initialFile
      ? detectedType === 'FACTURA' || initialFile.name.toLowerCase().endsWith('.xml')
      : false;
    const isTicket = initialFile ? detectedType === 'TICKET' : false;

    // Regla de Oro: El importe siempre inicia en 0 y es capturado por el usuario.
    // El XML CFDI nunca sobreescribe ni impone un importe.
    const newItem: ExpenseItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      concept: initialFile ? initialFile.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') : '',
      amount: 0,
      type: isFactura ? 'FACTURA' : isTicket ? 'TICKET' : 'PENDIENTE',
      expenseDate: defaultDate,
      category: 'ALIMENTOS',
      paymentMethod: 'ANTICIPO',
      createdAt: new Date().toISOString(),
      ticketFile: (isTicket && initialFile) ? initialFile : undefined,
      pdfFile: (isFactura && initialFile && initialFile.name.toLowerCase().endsWith('.pdf')) ? initialFile : undefined,
      xmlFile: (isFactura && initialFile && initialFile.name.toLowerCase().endsWith('.xml')) ? initialFile : undefined,
    };

    onChangeItems([...items, newItem]);
  }

  function handleDeleteRow(index: number) {
    const updated = items.filter((_, i) => i !== index);
    onChangeItems(updated);
  }

  function handleAttachFileToRow(rowId: string, file: ExpenseFileAttachment) {
    const lower = file.name.toLowerCase();
    const isXml = lower.endsWith('.xml') || file.role === 'COMPLEMENTO_FISCAL';

    const updated = items.map((it) => {
      if (it.id !== rowId) return it;
      if (isXml) {
        // Asocia el XML como complemento fiscal sin tocar el importe de la partida
        return { ...it, xmlFile: file, type: 'FACTURA' as ExpenseType };
      }
      if (file.analysis?.documentType === 'FACTURA') {
        return {
          ...it,
          pdfFile: lower.endsWith('.pdf') ? file : it.pdfFile,
          ticketFile: undefined,
          type: 'FACTURA' as ExpenseType,
        };
      }
      if (file.analysis?.documentType === 'TICKET') {
        return {
          ...it,
          ticketFile: file,
          type: 'TICKET' as ExpenseType,
        };
      }
      if (lower.endsWith('.pdf')) {
        return { ...it, pdfFile: file, type: it.xmlFile ? ('FACTURA' as ExpenseType) : it.type };
      }
      // Imagen u otro comprobante: si no hubo lectura automática, conserva la clasificación existente.
      return { ...it, ticketFile: file, type: it.type === 'PENDIENTE' ? ('TICKET' as ExpenseType) : it.type };
    });

    onChangeItems(updated);

    if (isXml && onAssignPendingXml) {
      onAssignPendingXml(file, rowId);
    }

    setSelectedFileModalRowId(null);
  }

  function handleRemoveFileFromRow(rowId: string, fileKey: 'xmlFile' | 'pdfFile' | 'ticketFile') {
    let unassignedFile: ExpenseFileAttachment | undefined;

    const updated = items.map((it) => {
      if (it.id !== rowId) return it;
      const copy = { ...it };
      if (fileKey === 'xmlFile' && copy.xmlFile) {
        unassignedFile = copy.xmlFile;
      }
      delete copy[fileKey];
      return copy;
    });

    onChangeItems(updated);

    // Si se desvinculó un XML, devolverlo a la lista de pendientes para que no se pierda
    if (fileKey === 'xmlFile' && unassignedFile && onUnassignXml) {
      onUnassignXml(unassignedFile);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  // Subtotals (En DIMER todo el anticipo se depositó a tarjeta personal, no hay TC corporativas)
  const totalAnticipo = items.reduce(
    (sum, it) =>
      sum +
      (it.paymentMethod === 'ANTICIPO' ||
      it.paymentMethod === 'TARJETA_EMPRESA' ||
      !it.paymentMethod
        ? Number(it.amount || 0)
        : 0),
    0
  );
  const totalPersonal = items.reduce(
    (sum, it) =>
      sum +
      (it.paymentMethod === 'PERSONAL_REEMBOLSO' ? Number(it.amount || 0) : 0),
    0
  );
  const granTotal = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (ext === 'pdf') return <FileText className="w-3.5 h-3.5 text-rose-600" />;
    if (ext === 'xml') return <FileCode className="w-3.5 h-3.5 text-amber-600" />;
    return <Image className="w-3.5 h-3.5 text-teal-600" />;
  };

  const allModalFiles = useMemo(() => {
    const list: { file: ExpenseFileAttachment; isXml: boolean }[] = [];
    const seen = new Set<string>();

    (availableAttachments || []).forEach((f) => {
      const isXml = f.name.toLowerCase().endsWith('.xml') || f.role === 'COMPLEMENTO_FISCAL';
      if (!seen.has(f.id)) {
        seen.add(f.id);
        list.push({ file: f, isXml });
      }
    });

    (pendingFiscalXmls || []).forEach((f) => {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        list.push({ file: f, isXml: true });
      }
    });

    return list;
  }, [availableAttachments, pendingFiscalXmls]);

  return (
    <div className="space-y-3">
      {/* Table Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <span>Matriz de Comprobación de Gastos (Captura Rápida)</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {items.length} fila(s)
            </span>
          </h3>
          <p className="text-[11px] text-slate-500">
            {travelDates.length > 0 ? (
              <>
                Periodo oficial del viaje: <strong>{minDate}</strong> al <strong>{maxDate}</strong> ({travelDates.length} días)
              </>
            ) : (
              'Ingresa tus gastos por fecha y asigna los comprobantes correspondientes.'
            )}
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {onOpenBulkUploader && (
              <button
                type="button"
                onClick={onOpenBulkUploader}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Cargar Varios Comprobantes</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAddRow()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar Fila</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-2.5 text-center w-10">#</th>
                <th className="py-2.5 px-3 min-w-[180px]">Comprobante / Archivo</th>
                <th className="py-2.5 px-3 min-w-[130px]">Fecha de Gasto</th>
                <th className="py-2.5 px-3 min-w-[190px]">Categoría Contable</th>
                <th className="py-2.5 px-3 min-w-[200px]">Concepto / Descripción</th>
                <th className="py-2.5 px-3 min-w-[160px]">Forma de Pago</th>
                <th className="py-2.5 px-3 text-right min-w-[120px]">Importe (MXN)</th>
                {canEdit && <th className="py-2.5 px-2 text-center w-12">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="p-8 text-center text-slate-400">
                    <p className="font-semibold text-xs text-slate-600">No hay filas de gastos capturadas</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {canEdit
                        ? 'Haz clic en "+ Agregar Fila" o utiliza "Cargar Varios Comprobantes" para iniciar.'
                        : 'El expediente no tiene comprobantes registrados.'}
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const hasXml = Boolean(item.xmlFile);
                  const hasPdf = Boolean(item.pdfFile);
                  const hasTicket = Boolean(item.ticketFile);

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* # Index */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Comprobante / Archivos */}
                      <td className="py-2 px-3">
                        <div className="space-y-1">
                          {/* Attached files badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.type === 'PENDIENTE' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3" />
                                Por clasificar
                              </span>
                            )}
                            {hasXml && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                                <FileCode className="w-3 h-3 text-purple-700" />
                                <span className="truncate max-w-[85px]" title={item.xmlFile!.name}>{item.xmlFile!.name}</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-purple-100 text-purple-800 rounded">Fiscal</span>
                                {onPreviewAttachment && (
                                  <button
                                    type="button"
                                    onClick={() => onPreviewAttachment(item.xmlFile!)}
                                    className="hover:text-purple-950 p-0.5"
                                    title="Descargar XML CFDI"
                                  >
                                    <Download className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFileFromRow(item.id, 'xmlFile')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5"
                                    title="Desvincular XML (volverá a pendientes)"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            )}

                            {hasPdf && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <FileText className="w-3 h-3 text-rose-600" />
                                <span className="truncate max-w-[90px]">{item.pdfFile!.name}</span>
                                {onPreviewAttachment && (
                                  <button
                                    type="button"
                                    onClick={() => onPreviewAttachment(item.pdfFile!)}
                                    className="hover:text-rose-950 p-0.5"
                                    title="Descargar PDF"
                                  >
                                    <Download className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFileFromRow(item.id, 'pdfFile')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5"
                                    title="Quitar PDF"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            )}

                            {hasTicket && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                {getFileIcon(item.ticketFile!.name)}
                                <span className="truncate max-w-[90px]">{item.ticketFile!.name}</span>
                                {onPreviewAttachment && (
                                  <button
                                    type="button"
                                    onClick={() => onPreviewAttachment(item.ticketFile!)}
                                    className="hover:text-teal-950 p-0.5"
                                    title="Descargar comprobante"
                                  >
                                    <Download className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFileFromRow(item.id, 'ticketFile')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5"
                                    title="Quitar comprobante"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            )}

                            {!hasXml && !hasPdf && !hasTicket && (
                              <span className="text-[10px] text-amber-700 italic flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-500" /> Sin archivo adjunto
                              </span>
                            )}
                          </div>

                          {/* Quick Attach button for edit mode */}
                          {canEdit && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedFileModalRowId(item.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 hover:text-teal-900 hover:underline"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span>{hasXml || hasPdf || hasTicket ? 'Asociar otro archivo' : '+ Asignar archivo'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Fecha de Gasto */}
                      <td className="py-2 px-3">
                        {canEdit ? (
                          <input
                            type="date"
                            value={item.expenseDate || ''}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => handleUpdateField(idx, 'expenseDate', e.target.value)}
                            className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800 text-xs">
                            {item.expenseDate || 'N/D'}
                          </span>
                        )}
                      </td>

                      {/* Categoría Contable */}
                      <td className="py-2 px-3">
                        {canEdit ? (
                          <select
                            value={item.category || ''}
                            onChange={(e) =>
                              handleUpdateField(idx, 'category', e.target.value as ExpenseCategoryType)
                            }
                            className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                          >
                            <option value="" disabled>
                              Selecciona categoría...
                            </option>
                            {CATEGORY_OPTIONS.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.iconDesc} {cat.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            {item.category ? (
                              <span className="font-bold text-slate-800 text-xs">
                                {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label || item.category}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Sin clasificación histórica
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Concepto / Descripción */}
                      <td className="py-2 px-3">
                        {canEdit ? (
                          <input
                            type="text"
                            value={item.concept || ''}
                            placeholder="Ej. Hospedaje estancia laboral..."
                            onChange={(e) => handleUpdateField(idx, 'concept', e.target.value)}
                            className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-slate-800 text-xs">
                            {item.concept || 'Sin descripción'}
                          </span>
                        )}
                      </td>

                      {/* Forma de Pago */}
                      <td className="py-2 px-3">
                        {canEdit ? (
                          <select
                            value={item.paymentMethod === 'PERSONAL_REEMBOLSO' ? 'PERSONAL_REEMBOLSO' : 'ANTICIPO'}
                            onChange={(e) =>
                              handleUpdateField(idx, 'paymentMethod', e.target.value as PaymentMethodType)
                            }
                            className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            {(() => {
                              const isPersonal = item.paymentMethod === 'PERSONAL_REEMBOLSO';
                              const opt = isPersonal ? PAYMENT_METHOD_OPTIONS[1] : PAYMENT_METHOD_OPTIONS[0];
                              return (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${opt.badgeClass}`}
                                >
                                  {opt.label}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </td>

                      {/* Importe MXN */}
                      <td className="py-2 px-3 text-right">
                        {canEdit ? (
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.amount === 0 ? '' : item.amount}
                              placeholder="0.00"
                              onChange={(e) =>
                                handleUpdateField(idx, 'amount', parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-right text-xs py-1 pl-5 pr-2 font-mono font-bold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                      </td>

                      {/* Acción Borrar */}
                      {canEdit && (
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Subtotals */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs">
              <tr>
                <td colSpan={5} className="py-2.5 px-3 text-slate-500 text-right align-top">
                  <span className="block font-bold text-slate-700">Resumen de Comprobación:</span>
                  <span className="text-[10px] text-slate-400 block font-normal">
                    Fondos transferidos a la tarjeta personal del usuario
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right" colSpan={canEdit ? 3 : 2}>
                  <div className="flex flex-col gap-1 items-end text-[11px]">
                    <div className="flex items-center justify-between w-72">
                      <span className="text-teal-800 font-semibold">Gastos con Anticipo (Tarjeta Personal):</span>
                      <span className="font-mono font-bold text-teal-900">{formatCurrency(totalAnticipo)}</span>
                    </div>
                    {totalPersonal > 0 && (
                      <div className="flex items-center justify-between w-72">
                        <span className="text-blue-800 font-semibold">Desembolso Adicional (A Reembolsar):</span>
                        <span className="font-mono font-bold text-blue-900">{formatCurrency(totalPersonal)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between w-72 pt-1 border-t border-slate-300 text-xs font-black text-slate-900">
                      <span>Total General de Gastos:</span>
                      <span className="font-mono text-slate-950">{formatCurrency(granTotal)}</span>
                    </div>
                    <div className="w-72 mt-1 p-1.5 rounded bg-teal-50 border border-teal-200 text-left text-[10px] text-teal-900 font-normal leading-tight">
                      ℹ️ Todo el dinero comprobado corresponde al anticipo depositado en la tarjeta personal del colaborador. No se manejan tarjetas corporativas.
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal to select an available uploaded attachment for a row */}
      {selectedFileModalRowId && (
        <div className="fixed inset-0 z-[600] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-xs flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-teal-400" />
                Asignar Comprobante a la Fila
              </h4>
              <button
                type="button"
                onClick={() => setSelectedFileModalRowId(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Selecciona uno de los archivos cargados previamente para asociarlo a este gasto:
              </p>

              {allModalFiles.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  <p>No tienes comprobantes ni complementos fiscales en la bandeja de archivos.</p>
                  {onOpenBulkUploader && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFileModalRowId(null);
                        onOpenBulkUploader();
                      }}
                      className="mt-2 text-xs font-bold text-teal-700 hover:underline"
                    >
                      Subir comprobantes ahora &rarr;
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {allModalFiles.map(({ file, isXml }) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => handleAttachFileToRow(selectedFileModalRowId, file)}
                      className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between gap-2 transition cursor-pointer text-xs ${
                        isXml
                          ? 'border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/70'
                          : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {getFileIcon(file.name)}
                        <span className="font-medium text-slate-800 truncate">{file.name}</span>
                        {isXml && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0 font-mono">
                            XML CFDI &bull; Complemento Fiscal (Importe: N/A)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-teal-700 font-bold shrink-0">
                        {isXml ? 'Vincular XML' : 'Asignar'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedFileModalRowId(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
