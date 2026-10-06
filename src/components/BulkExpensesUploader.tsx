import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  FileCode,
  Image,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  X,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  Plus
} from 'lucide-react';
import type { ExpenseDocumentAnalysis, ExpenseFileAttachment } from '../types.js';
import { authFetch } from '../utils/apiHelper.js';

export interface FileQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'PENDIENTE' | 'VALIDANDO' | 'LISTO' | 'SUBIENDO' | 'SUBIDO' | 'ERROR';
  progress: number;
  error?: string;
  isDuplicate?: boolean;
  attachment?: ExpenseFileAttachment;
}

interface BulkExpensesUploaderProps {
  folio?: string;
  existingFileSignatures?: Set<string>; // 'name_size'
  onAttachmentsUploaded: (attachments: ExpenseFileAttachment[]) => void;
  onClose?: () => void;
}

export const BulkExpensesUploader: React.FC<BulkExpensesUploaderProps> = ({
  folio,
  existingFileSignatures = new Set(),
  onAttachmentsUploaded,
  onClose,
}) => {
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_EXTS = ['pdf', 'xml', 'jpg', 'jpeg', 'png', 'webp'];

  function validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size <= 0) {
      return { valid: false, error: 'El archivo está vacío (0 bytes).' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `Excede el límite de 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).` };
    }
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!ALLOWED_EXTS.includes(ext)) {
      return { valid: false, error: `Extensión .${ext} no permitida. Formatos válidos: PDF, XML, JPG, JPEG, PNG, WEBP.` };
    }
    return { valid: true };
  }

  function handleAddFiles(filesList: FileList | File[]) {
    setGlobalNotice(null);
    const newItems: FileQueueItem[] = [];
    const currentSignatures = new Set(queue.map(q => `${q.name}_${q.size}`));

    Array.from(filesList).forEach((file) => {
      const sig = `${file.name}_${file.size}`;
      const isDuplicate = currentSignatures.has(sig) || existingFileSignatures.has(sig);
      currentSignatures.add(sig);

      const validation = validateFile(file);
      const item: FileQueueItem = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        status: validation.valid ? 'LISTO' : 'ERROR',
        progress: validation.valid ? 0 : 0,
        error: validation.error,
        isDuplicate,
      };
      newItems.push(item);
    });

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
      // Reset input value so re-selecting same files works if cleared
      e.target.value = '';
    }
  }

  function removeQueueItem(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  function clearAll() {
    setQueue([]);
    setGlobalNotice(null);
  }

  async function uploadIndividualFile(item: FileQueueItem): Promise<ExpenseFileAttachment | null> {
    // Read file as base64 dataUrl
    return new Promise((resolve) => {
      const reader = new FileReader();

      // Update progress locally to 30%
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'SUBIENDO', progress: 30 } : q))
      );

      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: 65 } : q))
          );

          const res = await authFetch('/api/expenses/upload-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              size: item.size,
              type: item.type,
              dataUrl,
              folio,
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success || !data.file) {
            throw new Error(data.error || 'Fallo en la validación del servidor.');
          }

          let attachment: ExpenseFileAttachment = data.file;

          // Lectura automática del importe y tipo del comprobante.
          // Si el análisis falla, el archivo sigue guardándose como soporte.
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: 82 } : q))
          );
          try {
            const analysisRes = await authFetch('/api/expenses/analyze-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folio,
                name: item.name,
                size: item.size,
                type: item.type,
                dataUrl,
              }),
            });
            const analysisData = await analysisRes.json();
            if (analysisRes.ok && analysisData?.success && analysisData?.analysis) {
              attachment = {
                ...attachment,
                analysis: analysisData.analysis as ExpenseDocumentAnalysis,
              };
            } else {
              attachment = {
                ...attachment,
                analysis: {
                  status: 'ERROR',
                  source: 'NINGUNO',
                  includedInTotal: false,
                  analyzedAt: new Date().toISOString(),
                  error: analysisData?.error || 'No fue posible analizar el importe.',
                },
              };
            }
          } catch (analysisError: any) {
            attachment = {
              ...attachment,
              analysis: {
                status: 'ERROR',
                source: 'NINGUNO',
                includedInTotal: false,
                analyzedAt: new Date().toISOString(),
                error: analysisError?.message || 'No fue posible analizar el importe.',
              },
            };
          }

          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'SUBIDO', progress: 100, attachment, error: undefined }
                : q
            )
          );
          resolve(attachment);
        } catch (err: any) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'ERROR', progress: 0, error: err.message || 'Error al procesar archivo' }
                : q
            )
          );
          resolve(null);
        }
      };

      reader.onerror = () => {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'ERROR', progress: 0, error: 'Error al leer el archivo desde el dispositivo' }
              : q
          )
        );
        resolve(null);
      };

      reader.readAsDataURL(item.file);
    });
  }

  async function retryItem(item: FileQueueItem) {
    const val = validateFile(item.file);
    if (!val.valid) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'ERROR', error: val.error } : q))
      );
      return;
    }
    await uploadIndividualFile(item);
  }

  async function handleStartUploadAll() {
    const pendingItems = queue.filter(
      (item) => item.status === 'LISTO' || item.status === 'ERROR'
    );

    if (pendingItems.length === 0) {
      setGlobalNotice('No hay archivos pendientes listos para subir.');
      return;
    }

    setProcessing(true);
    setGlobalNotice(null);

    const uploadedList: ExpenseFileAttachment[] = [];

    // Process each file individually and safely
    for (const item of pendingItems) {
      const att = await uploadIndividualFile(item);
      if (att) {
        uploadedList.push(att);
      }
    }

    setProcessing(false);

    if (uploadedList.length > 0) {
      onAttachmentsUploaded(uploadedList);
      setGlobalNotice(
        `¡${uploadedList.length} documento(s) procesado(s) exitosamente y guardado(s) en el expediente!`
      );
    }
  }

  const pendingCount = queue.filter((q) => q.status === 'LISTO' || q.status === 'PENDIENTE').length;
  const errorCount = queue.filter((q) => q.status === 'ERROR').length;
  const uploadedCount = queue.filter((q) => q.status === 'SUBIDO').length;

  // Suma únicamente los importes finales detectados en documentos principales.
  // Los XML CFDI no se suman aquí porque son complemento fiscal y podrían duplicar una factura.
  const detectedDocumentsTotal = Number(
    queue.reduce((sum, q) => {
      const analysis = q.attachment?.analysis;
      return sum + (
        analysis?.status === 'DETECTADO' &&
        analysis.includedInTotal &&
        Number.isFinite(Number(analysis.amount))
          ? Number(analysis.amount)
          : 0
      );
    }, 0).toFixed(2)
  );

  const detectedDocumentsCount = queue.filter(
    (q) => q.attachment?.analysis?.status === 'DETECTADO' && q.attachment.analysis.includedInTotal
  ).length;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-600" />;
    if (ext === 'xml') return <FileCode className="w-4 h-4 text-amber-600" />;
    return <Image className="w-4 h-4 text-teal-600" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-500/20 rounded-lg text-teal-300">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Carga de Documentos y Evidencias (PDF, XML, Capturas)</h3>
            <p className="text-[11px] text-teal-200">
              Sube facturas (PDF, XML) y capturas de ticket (JPG, PNG, WEBP). Se guardan como soporte documental para consulta y descarga por Finanzas o el usuario, sin agregar filas a la tabla.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Dropzone Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-teal-500 bg-teal-50/70'
              : 'border-slate-300 hover:border-teal-400 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xml,.jpg,.jpeg,.png,.webp,application/pdf,text/xml,application/xml,image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="w-12 h-12 bg-white rounded-full shadow-2xs border border-slate-200 flex items-center justify-center mx-auto mb-3 text-teal-600">
            <Upload className="w-6 h-6" />
          </div>

          <p className="text-xs font-bold text-slate-800">
            Haz clic para seleccionar documentos o arrástralos aquí
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Formatos admitidos: <strong>PDF, XML (CFDI), JPG, JPEG, PNG, WEBP</strong> &bull; Límite: 10 MB por archivo
          </p>

          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded">Comprobante / Captura (PDF, JPG, PNG)</span>
            <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded font-bold">Complemento Fiscal (XML CFDI)</span>
          </div>
        </div>

        {/* Fiscal rule clarification banner */}
        <div className="p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-[11px] flex items-start gap-2">
          <FileCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>Soporte Documental:</strong> Los documentos que subas quedan resguardados en el expediente digital para ser descargados y revisados por Finanzas y por ti. <strong>No generan partidas en la tabla de comprobación ni modifican montos</strong>.
          </span>
        </div>

        {/* Global Notice */}
        {globalNotice && (
          <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
            <span>{globalNotice}</span>
          </div>
        )}

        {/* Resumen de importes detectados */}
        {queue.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/60">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-indigo-700">
                Suma de totales detectados
              </span>
              <span className="block mt-0.5 text-2xl font-mono font-black text-indigo-950">
                {formatCurrency(detectedDocumentsTotal)}
              </span>
              <span className="block mt-0.5 text-[10px] text-indigo-800">
                {detectedDocumentsCount} documento(s) con importe final identificado
              </span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-600">
                Control de conciliación
              </span>
              <span className="block mt-0.5 text-sm font-bold text-slate-800">
                Se suma cada “Total detectado” una sola vez
              </span>
              <span className="block mt-0.5 text-[10px] text-slate-500">
                Los XML CFDI se excluyen de esta suma para evitar duplicar el importe de su factura.
              </span>
            </div>
          </div>
        )}

        {/* Summary Counter & Actions */}
        {queue.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-slate-700">Total en cola: {queue.length}</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                  {pendingCount} listos
                </span>
              )}
              {uploadedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  {uploadedCount} subidos
                </span>
              )}
              {errorCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                  {errorCount} con error
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={processing}
                className="px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded text-xs font-semibold transition"
              >
                Limpiar lista
              </button>

              <button
                type="button"
                onClick={handleStartUploadAll}
                disabled={processing || pendingCount === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Subiendo archivos...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir {pendingCount} Archivo(s) al Expediente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Queue Items List */}
        {queue.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border text-xs transition flex flex-col gap-1.5 ${
                  item.status === 'ERROR'
                    ? 'bg-rose-50/70 border-rose-200'
                    : item.status === 'SUBIDO'
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(item.name)}
                    <span className="font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      ({formatFileSize(item.size)})
                    </span>
                    {item.name.toLowerCase().endsWith('.xml') && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        XML CFDI &bull; Complemento Fiscal (Importe: N/A)
                      </span>
                    )}
                    {item.attachment?.analysis?.status === 'DETECTADO' && item.attachment.analysis.amount ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {item.attachment.analysis.documentType === 'FACTURA' ? 'Factura' : item.attachment.analysis.documentType === 'TICKET' ? 'Ticket' : 'Documento'} &bull; Total: {item.attachment.analysis.amount.toFixed(2)}
                      </span>
                    ) : item.attachment?.analysis?.status === 'SIN_TOTAL' ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Sin total detectable
                      </span>
                    ) : null}

                    {item.isDuplicate && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertTriangle className="w-2.5 h-2.5" /> Posible duplicado
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'SUBIDO' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" /> Listo
                      </span>
                    )}

                    {item.status === 'SUBIENDO' && (
                      <span className="inline-flex items-center gap-1 text-teal-700 font-bold text-[11px]">
                        <RefreshCw className="w-3 h-3 animate-spin" /> {item.progress}%
                      </span>
                    )}

                    {item.status === 'ERROR' && (
                      <button
                        type="button"
                        onClick={() => retryItem(item)}
                        disabled={processing}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-2xs transition"
                        title="Reintentar este archivo"
                      >
                        <RefreshCw className="w-3 h-3" /> Reintentar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeQueueItem(item.id)}
                      disabled={processing}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Eliminar de la lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {item.status === 'SUBIENDO' && (
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Error message */}
                {item.status === 'ERROR' && item.error && (
                  <div className="text-[11px] text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{item.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
