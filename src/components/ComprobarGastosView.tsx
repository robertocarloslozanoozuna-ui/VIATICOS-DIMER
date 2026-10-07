import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import {
  Receipt,
  Search,
  FileText,
  FileCode,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  ArrowRight,
  Download,
  Trash2,
  Plus,
  Eye,
  Check,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  Info,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  FolderDown,
  X,
  Send,
  Save,
  HelpCircle,
  CreditCard,
  Banknote,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  Image as ImageIcon,
  Paperclip,
  FileCheck,
  Printer
} from 'lucide-react';
import type {
  User as UserType,
  TravelRequest,
  ExpenseItem,
  ExpenseVerification,
  ExpenseType,
  ExpenseFileAttachment,
  ExpenseDocumentAnalysis,
  ExpenseRefund,
  ExcelAuditSummary,
} from '../types';
import { authFetch } from '../utils/apiHelper';
import { computeExpenseBalances } from '../utils/expenseCalculations';
import { BulkExpensesUploader } from './BulkExpensesUploader';
import { ExcelExpensesTable } from './ExcelExpensesTable';
import { ExcelExpensesImporter } from './ExcelExpensesImporter';
import RefundReceiptModal from './RefundReceiptModal';
import { downloadRefundReceiptPdf } from '../utils/refundReceiptPdf';
import { summarizeDocumentTotals } from '../utils/documentTotals';

interface ComprobarGastosViewProps {
  currentUser: UserType;
  initialFolio?: string | null;
  onNavigateToRequests?: () => void;
}

export const ComprobarGastosView: React.FC<ComprobarGastosViewProps> = ({
  currentUser,
  initialFolio,
  onNavigateToRequests,
}) => {
  const fileXmlId = useId();
  const filePdfId = useId();
  const fileTicketId = useId();
  const fileRefundId = useId();

  const isAdmin =
    String(currentUser.role || '').toUpperCase() === 'ADMIN' ||
    Boolean(currentUser.roles?.some((r) => String(r.name || r.id).toUpperCase() === 'ADMIN'));
  const isFinanzas =
    String(currentUser.role || '').toUpperCase() === 'FINANZAS' ||
    Boolean(currentUser.roles?.some((r) => String(r.name || r.id).toUpperCase() === 'FINANZAS'));
  const isPrivileged = isAdmin || isFinanzas;

  // Search state
  const [searchFolio, setSearchFolio] = useState<string>(initialFolio || '');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Active Request & Verification
  const [loadedRequest, setLoadedRequest] = useState<TravelRequest | null>(null);
  const [verification, setVerification] = useState<ExpenseVerification | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Expense items list for active request
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Refund state (Opción para reembolsar dinero a finanzas que les sobró)
  const [refund, setRefund] = useState<ExpenseRefund | null>(null);
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [showRefundReceipt, setShowRefundReceipt] = useState<boolean>(false);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<'SPEI' | 'EFECTIVO'>('SPEI');
  const [refundReference, setRefundReference] = useState<string>('');
  const [refundDate, setRefundDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [refundFile, setRefundFile] = useState<ExpenseFileAttachment | null>(null);
  const [signedRefundFile, setSignedRefundFile] = useState<ExpenseFileAttachment | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>('');
  const [refundFormError, setRefundFormError] = useState<string | null>(null);

  // New item modal / form state
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [itemConcept, setItemConcept] = useState<string>('');
  const [itemAmount, setItemAmount] = useState<string>('');
  const [itemDate, setItemDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [itemType, setItemType] = useState<ExpenseType>('FACTURA');
  const [itemXmlFile, setItemXmlFile] = useState<ExpenseFileAttachment | null>(null);
  const [itemPdfFile, setItemPdfFile] = useState<ExpenseFileAttachment | null>(null);
  const [itemTicketFile, setItemTicketFile] = useState<ExpenseFileAttachment | null>(null);
  const [itemNotes, setItemNotes] = useState<string>('');
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  // Bulk Uploader & Available Attachments Pool
  const [showBulkUploaderModal, setShowBulkUploaderModal] = useState<boolean>(false);
  const [uploadedAttachmentsPool, setUploadedAttachmentsPool] = useState<ExpenseFileAttachment[]>([]);
  const [pendingFiscalXmls, setPendingFiscalXmls] = useState<ExpenseFileAttachment[]>([]);
  const [supportFiles, setSupportFiles] = useState<ExpenseFileAttachment[]>([]);
  const [previewModalFile, setPreviewModalFile] = useState<ExpenseFileAttachment | null>(null);

  // Original Excel Report File and Audit Summary
  const [originalExcelFile, setOriginalExcelFile] = useState<ExpenseFileAttachment | null>(null);
  const [excelAuditSummary, setExcelAuditSummary] = useState<ExcelAuditSummary | null>(null);

  // Finanzas Accounting Closure
  const [showFinalizeAccountingModal, setShowFinalizeAccountingModal] = useState<boolean>(false);
  const [finalizingAccounting, setFinalizingAccounting] = useState<boolean>(false);
  const [finalizeAccountingNotes, setFinalizeAccountingNotes] = useState<string>('Facturas fiscales SAT y comprobantes validados al 100%. Expediente concluido.');

  // Saving / Finalizing states
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const [submittingFinal, setSubmittingFinal] = useState<boolean>(false);
  const [showConfirmFinalModal, setShowConfirmFinalModal] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Requests & Verifications data
  const [allRequests, setAllRequests] = useState<TravelRequest[]>([]);
  const [verificationsList, setVerificationsList] = useState<ExpenseVerification[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Folio filter category for the overview panel:
  // 'POR_COMPROBAR' (solo pagadas no comprobadas) | 'PARCIAL' | 'SIN_INICIAR' | 'COMPROBADAS_100'
  const [activeFolioCategory, setActiveFolioCategory] = useState<
    'POR_COMPROBAR' | 'PARCIAL' | 'SIN_INICIAR' | 'COMPROBADAS_100'
  >('POR_COMPROBAR');

  // Load requests and verifications
  async function loadData() {
    try {
      setLoadingData(true);
      const [reqsRes, versRes] = await Promise.all([
        authFetch('/api/requests'),
        authFetch('/api/expenses/list'),
      ]);

      if (reqsRes.ok) {
        const reqs: TravelRequest[] = await reqsRes.json();
        setAllRequests(Array.isArray(reqs) ? reqs : []);
      }

      if (versRes.ok) {
        const d = await versRes.json();
        if (d.success && Array.isArray(d.verifications)) {
          setVerificationsList(d.verifications);
        }
      }
    } catch (e) {
      console.error('[LOAD-DATA-ERROR]', e);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentUser.id, isPrivileged]);

  // Auto-search if initialFolio provided
  useEffect(() => {
    if (initialFolio) {
      setSearchFolio(initialFolio);
      handleSearch(initialFolio);
    }
  }, [initialFolio]);

  // Classification of folios based on user prompt requirements:
  // "cuando ya se compruebe un gasto quita de esa vista el folio.
  // solo ve agregando ai folios que ya esten pagados y que no se allan comprobado
  // y separalos por comprobados parcial o ya comprobados al 100%"
  const relevantRequests = useMemo(() => {
    if (isPrivileged) return allRequests;
    return allRequests.filter(
      (r) =>
        r.userId === currentUser.id ||
        (r.user?.email && r.user.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [allRequests, currentUser, isPrivileged]);

  // 1. Folios pagados que NO se han comprobado (excluye COMPROBADA y FINALIZADA)
  const paidUncompletedRequests = useMemo(() => {
    return relevantRequests.filter((r) => r.status === 'PAGADA');
  }, [relevantRequests]);

  // 1a. Comprobados Parcial (en borrador con al menos 1 comprobante o borrador iniciado)
  const partialRequests = useMemo(() => {
    return paidUncompletedRequests.filter((r) => {
      const ver = verificationsList.find((v) => v.folio === r.folio);
      return ver && ver.items && ver.items.length > 0;
    });
  }, [paidUncompletedRequests, verificationsList]);

  // 1b. Sin Comprobar (sin ningún comprobante capturado)
  const unstartedRequests = useMemo(() => {
    return paidUncompletedRequests.filter((r) => {
      const ver = verificationsList.find((v) => v.folio === r.folio);
      return !ver || !ver.items || ver.items.length === 0;
    });
  }, [paidUncompletedRequests, verificationsList]);

  // 2. Ya Comprobados al 100% (comprobación enviada a finanzas o finalizada)
  const completed100Requests = useMemo(() => {
    return relevantRequests.filter((r) => {
      if (r.status === 'COMPROBADA' || r.status === 'FINALIZADA') return true;
      const ver = verificationsList.find((v) => v.folio === r.folio);
      return ver?.status === 'ENVIADA';
    });
  }, [relevantRequests, verificationsList]);

  // Search handler
  async function handleSearch(targetFolio?: string) {
    const folioToFind = (targetFolio || searchFolio).trim().toUpperCase();
    if (!folioToFind) {
      setSearchError('Ingresa un folio oficial (ej. VIAT-2026-000001).');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await authFetch(`/api/expenses/search?folio=${encodeURIComponent(folioToFind)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(data.error || 'No se pudo localizar la solicitud.');
        setLoadedRequest(null);
        setVerification(null);
        setItems([]);
        setRefund(null);
        return;
      }

      setLoadedRequest(data.request);
      setVerification(data.verification || null);
      setCanEdit(Boolean(data.canEdit));
      setStatusNotice(data.statusNotice || null);

      if (data.verification) {
        setItems(data.verification.items || []);
        setPendingFiscalXmls(data.verification.pendingFiscalXmls || []);
        setSupportFiles(data.verification.supportFiles || []);
        setOriginalExcelFile(data.verification.originalExcelFile || null);
        setExcelAuditSummary(data.verification.excelAuditSummary || null);
        setNotes(data.verification.notes || '');
        if (data.verification.refund) {
          setRefund(data.verification.refund);
          setRefundAmount(String(data.verification.refund.amount ?? ''));
          setRefundMethod(data.verification.refund.method || 'SPEI');
          setRefundReference(data.verification.refund.reference || '');
          setRefundDate(data.verification.refund.refundDate || new Date().toISOString().split('T')[0]);
          setRefundFile(data.verification.refund.receiptFile || null);
          setSignedRefundFile(data.verification.refund.signedReceiptFile || null);
          setRefundNotes(data.verification.refund.notes || '');
        } else {
          setRefund(null);
          setRefundAmount('');
          setRefundMethod('SPEI');
          setRefundReference('');
          setRefundDate(new Date().toISOString().split('T')[0]);
          setRefundFile(null);
          setSignedRefundFile(null);
          setRefundNotes('');
        }

        // Collect existing attachments to pool
        const existingAtts: ExpenseFileAttachment[] = [];
        (data.verification.items || []).forEach((it: ExpenseItem) => {
          if (it.xmlFile) existingAtts.push(it.xmlFile);
          if (it.pdfFile) existingAtts.push(it.pdfFile);
          if (it.ticketFile) existingAtts.push(it.ticketFile);
        });
        (data.verification.supportFiles || []).forEach((sf: ExpenseFileAttachment) => {
          existingAtts.push(sf);
        });
        (data.verification.pendingFiscalXmls || []).forEach((px: ExpenseFileAttachment) => {
          existingAtts.push(px);
        });
        if (data.verification.originalExcelFile) {
          existingAtts.push(data.verification.originalExcelFile);
        }
        setUploadedAttachmentsPool(existingAtts);
      } else {
        setItems([]);
        setPendingFiscalXmls([]);
        setSupportFiles([]);
        setOriginalExcelFile(null);
        setExcelAuditSummary(null);
        setNotes('');
        setRefund(null);
        setRefundAmount('');
        setRefundMethod('SPEI');
        setRefundReference('');
        setRefundDate(new Date().toISOString().split('T')[0]);
        setRefundFile(null);
        setSignedRefundFile(null);
        setRefundNotes('');
        setUploadedAttachmentsPool([]);
      }

      // Auto-switch to COMPROBADAS_100 if the folio has already been sent to Finanzas or finalized
      if (data.request.status === 'COMPROBADA' || data.request.status === 'FINALIZADA') {
        setActiveFolioCategory('COMPROBADAS_100');
      }
    } catch (e: any) {
      setSearchError(e.message || 'Error de conexión al buscar solicitud.');
    } finally {
      setSearching(false);
    }
  }

  // File to base64 converter helper for expense items
  async function analyzeAttachment(attachment: ExpenseFileAttachment): Promise<ExpenseDocumentAnalysis | undefined> {
    try {
      const res = await authFetch('/api/expenses/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: loadedRequest?.folio,
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          dataUrl: attachment.dataUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.analysis) {
        return data.analysis as ExpenseDocumentAnalysis;
      }
      return {
        status: 'ERROR',
        source: 'NINGUNO',
        includedInTotal: false,
        analyzedAt: new Date().toISOString(),
        error: data?.error || 'No fue posible analizar el documento.',
      };
    } catch (error: any) {
      return {
        status: 'ERROR',
        source: 'NINGUNO',
        includedInTotal: false,
        analyzedAt: new Date().toISOString(),
        error: error?.message || 'No fue posible analizar el documento.',
      };
    }
  }

  function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'xml' | 'pdf' | 'ticket'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setItemFormError(`El archivo "${file.name}" supera el límite de 10 MB.`);
      return;
    }

    if (field === 'xml' && !file.name.toLowerCase().endsWith('.xml') && !file.type.includes('xml')) {
      setItemFormError('El archivo de factura fiscal XML debe tener extensión .xml');
      return;
    }

    if (field === 'pdf' && !file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setItemFormError('El archivo de factura debe tener extensión .pdf');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const attachment: ExpenseFileAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || (field === 'xml' ? 'text/xml' : field === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      };

      setItemFormError(null);
      const analysis = await analyzeAttachment(attachment);
      const analyzedAttachment: ExpenseFileAttachment = analysis
        ? { ...attachment, analysis }
        : attachment;

      if (field === 'xml') setItemXmlFile(analyzedAttachment);
      if (field === 'pdf') setItemPdfFile(analyzedAttachment);
      if (field === 'ticket') setItemTicketFile(analyzedAttachment);
    };
    reader.onerror = () => {
      setItemFormError('Error al leer el archivo. Intenta de nuevo.');
    };
    reader.readAsDataURL(file);
  }

  // File upload for refund voucher
  function handleRefundFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setRefundFormError(`El comprobante "${file.name}" supera el límite de 10 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const attachment: ExpenseFileAttachment = {
        id: `refund_att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      };
      setRefundFile(attachment);
      setRefundFormError(null);
    };
    reader.onerror = () => {
      setRefundFormError('Error al leer el archivo del comprobante.');
    };
    reader.readAsDataURL(file);
  }

  function handleAddItem() {
    setItemFormError(null);
    const concept = itemConcept.trim();
    const amount = Number(itemAmount);

    if (!concept) {
      setItemFormError('Ingresa un concepto o descripción para el gasto.');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      setItemFormError('El importe del gasto debe ser mayor a $0.00 MXN.');
      return;
    }

    if (!itemDate) {
      setItemFormError('Selecciona la fecha del gasto.');
      return;
    }

    if (itemType === 'FACTURA') {
      if (!itemXmlFile || !itemPdfFile) {
        setItemFormError('Para Factura Fiscal se requiere adjuntar obligatoriamente el archivo XML y el PDF.');
        return;
      }
    } else {
      if (!itemTicketFile) {
        setItemFormError('Para Ticket de Compra se requiere adjuntar el comprobante (PDF o imagen).');
        return;
      }
    }

    const newItem: ExpenseItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      concept,
      amount,
      type: itemType,
      expenseDate: itemDate,
      xmlFile: itemType === 'FACTURA' ? itemXmlFile || undefined : undefined,
      pdfFile: itemType === 'FACTURA' ? itemPdfFile || undefined : undefined,
      ticketFile: itemType === 'TICKET' ? itemTicketFile || undefined : undefined,
      notes: itemNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setItems([...items, newItem]);
    resetItemModal();
  }

  function resetItemModal() {
    setItemConcept('');
    setItemAmount('');
    setItemDate(new Date().toISOString().split('T')[0]);
    setItemType('FACTURA');
    setItemXmlFile(null);
    setItemPdfFile(null);
    setItemTicketFile(null);
    setItemNotes('');
    setItemFormError(null);
    setShowItemModal(false);
  }

  function handleRemoveItem(itemId: string) {
    setItems(items.filter((it) => it.id !== itemId));
  }

  // Open refund modal
  function handleOpenRefundModal() {
    setRefundFormError(null);
    if (refund) {
      setRefundAmount(String(refund.amount));
      setRefundMethod(refund.method);
      setRefundReference(refund.reference);
      setRefundDate(refund.refundDate);
      setRefundFile(refund.receiptFile || null);
      setRefundNotes(refund.notes || '');
    } else {
      const defaultAmount = difference > 0 ? String(difference.toFixed(2)) : '';
      setRefundAmount(defaultAmount);
      setRefundMethod('SPEI');
      setRefundReference('');
      setRefundDate(new Date().toISOString().split('T')[0]);
      setRefundFile(null);
      setRefundNotes('');
    }
    setShowRefundModal(true);
  }

  // Save refund to local state
  function handleSaveRefund(e: React.FormEvent) {
    e.preventDefault();
    setRefundFormError(null);
    const amount = Number(refundAmount);

    if (isNaN(amount) || amount <= 0) {
      setRefundFormError('Ingresa un monto de reembolso válido mayor a $0.00 MXN.');
      return;
    }

    if (!refundReference.trim()) {
      setRefundFormError('Ingresa la clave de rastreo SPEI, número de recibo o referencia bancaria.');
      return;
    }

    if (!refundDate) {
      setRefundFormError('Selecciona la fecha en que se realizó el reintegro.');
      return;
    }

    const savedRefund: ExpenseRefund = {
      amount: Number(amount.toFixed(2)),
      method: refundMethod,
      reference: refundReference.trim(),
      refundDate,
      receiptFile: refundFile || undefined,
      signedReceiptFile: signedRefundFile || undefined,
      notes: refundNotes.trim() || undefined,
      registeredAt: refund?.registeredAt || new Date().toISOString(),
    };

    setRefund(savedRefund);
    setShowRefundModal(false);
    setActionSuccess('Comprobante de reembolso de sobrante registrado. Recuerda guardar el borrador o finalizar.');
  }

  function handleSignedRefundFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setRefundFormError(`El recibo firmado "${file.name}" supera el límite de 10 MB.`);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setRefundFormError('El recibo firmado debe ser un archivo PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSignedRefundFile({
        id: `signed_refund_att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      });
      setRefundFormError(null);
    };
    reader.onerror = () => setRefundFormError('Error al leer el recibo firmado.');
    reader.readAsDataURL(file);
  }

  function handleRemoveRefund() {
    if (confirm('¿Deseas eliminar el comprobante de reembolso registrado?')) {
      setRefund(null);
      setRefundFile(null);
      setSignedRefundFile(null);
      setActionSuccess('Reembolso eliminado.');
    }
  }

  // Official Financial Calculations Engine
  const totalAmountPaid = Number(
    loadedRequest?.amountAuthorized && Number(loadedRequest.amountAuthorized) > 0
      ? loadedRequest.amountAuthorized
      : loadedRequest?.amountRequested || 0
  );

  const financialBalances = useMemo(() => {
    return computeExpenseBalances(totalAmountPaid, items, refund);
  }, [totalAmountPaid, items, refund]);

  const {
    totalExpenses,
    totalAnticipo,
    totalTarjetaEmpresa,
    totalPersonal,
    refundAmount: computedRefundAmount,
    saldoAnticipoAntesReintegro,
    saldoPendienteDevolucion,
    saldoFavorColaborador,
    financialStatus,
    difference,
    balanceType,
    balanceAmount,
    saldoNoUtilizado,
    importeADevolverDIMER,
    importeAdicionalReembolsar,
  } = financialBalances;

  const isFavorEmpresa = financialStatus === 'SOBRANTE_PENDIENTE';
  const isFavorColaborador = financialStatus === 'FAVOR_COLABORADOR';
  const isExacto = financialStatus === 'CUENTA_SALDADA';

  const documentTotals = useMemo(
    () => summarizeDocumentTotals(items, supportFiles, pendingFiscalXmls),
    [items, supportFiles, pendingFiscalXmls]
  );

  // Normaliza el nombre base para detectar parejas (ej. factura_hotel.pdf y factura_hotel.xml)
  function getFileBaseSignature(filename: string): string {
    return filename
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[_\s-]+/g, '')
      .trim();
  }

  // Handle files uploaded from BulkExpensesUploader
  // REGLA DEFINITIVA SOLICITADA POR EL USUARIO:
  // Cuando se suban los documentos como PDF, XML o capturas:
  // NO se registran como una comprobación en la tabla para agregar montos.
  // Solo se suben al expediente como soporte documental y quedan listos para ser descargados por Finanzas o por el mismo usuario.
  function handleAttachmentsUploaded(newAttachments: ExpenseFileAttachment[]) {
    // 1. Incorporar al expediente de documentos de soporte (supportFiles)
    setSupportFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => f.id || `${f.name}_${f.size}`));
      const fresh = newAttachments.filter((f) => !existingKeys.has(f.id || `${f.name}_${f.size}`));
      return [...prev, ...fresh];
    });

    // 2. Incorporar al pool de comprobantes disponibles
    setUploadedAttachmentsPool((prev) => {
      const existingKeys = new Set(prev.map((f) => f.id || `${f.name}_${f.size}`));
      const fresh = newAttachments.filter((f) => !existingKeys.has(f.id || `${f.name}_${f.size}`));
      return [...prev, ...fresh];
    });

    // 3. NO alterar la matriz de comprobación de gastos (items).
    // Las partidas contables se definen exclusivamente mediante la importación del Reporte Excel oficial o captura manual.
    setShowBulkUploaderModal(false);
    setActionSuccess(
      `¡${newAttachments.length} documento(s) (PDF, XML o capturas) resguardado(s) exitosamente en el expediente! Disponibles para consulta y descarga tanto por el colaborador como por Finanzas.`
    );
  }

  function handleRemoveSupportFile(fileId: string) {
    setSupportFiles((prev) => prev.filter((f) => f.id !== fileId));
    setUploadedAttachmentsPool((prev) => prev.filter((f) => f.id !== fileId));
    setActionSuccess('Documento retirado del expediente.');
  }

  // Asociar un XML pendiente a una partida de gasto existente (sin modificar su importe)
  function handleAssociatePendingXmlToRow(xml: ExpenseFileAttachment, rowId: string) {
    const updated = items.map((it) => {
      if (it.id !== rowId) return it;
      return {
        ...it,
        xmlFile: xml,
        type: 'FACTURA' as ExpenseType,
      };
    });
    setItems(updated);
    setPendingFiscalXmls((prev) => prev.filter((x) => x.id !== xml.id));
    const targetItem = items.find((i) => i.id === rowId);
    setActionSuccess(
      `Complemento fiscal "${xml.name}" asociado exitosamente a "${targetItem?.concept || 'Gasto'}". El importe permanece sin alteraciones.`
    );
  }

  // Crear una nueva partida vacía a partir de un XML pendiente (el usuario capturará el importe)
  function handleCreateRowFromPendingXml(xml: ExpenseFileAttachment) {
    const defaultDate = loadedRequest?.startDate
      ? new Date(loadedRequest.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const newRow: ExpenseItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      concept: xml.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      amount: 0, // Capturado por el usuario
      type: 'FACTURA',
      expenseDate: defaultDate,
      category: 'HOSPEDAJE',
      paymentMethod: 'ANTICIPO',
      createdAt: new Date().toISOString(),
      xmlFile: xml,
    };

    setItems((prev) => [...prev, newRow]);
    setPendingFiscalXmls((prev) => prev.filter((x) => x.id !== xml.id));
    setActionSuccess(
      `Partida creada para el complemento fiscal "${xml.name}". Captura el importe del gasto y adjunta el PDF correspondiente.`
    );
  }

  function handleRemovePendingXml(xmlId: string) {
    if (confirm('¿Deseas descartar este complemento fiscal XML de la lista de pendientes?')) {
      setPendingFiscalXmls((prev) => prev.filter((x) => x.id !== xmlId));
      setActionSuccess('Complemento fiscal XML retirado de pendientes.');
    }
  }

  function handleUnassignXml(removedXml: ExpenseFileAttachment) {
    setPendingFiscalXmls((prev) => {
      if (prev.some((x) => x.id === removedXml.id)) return prev;
      return [...prev, removedXml];
    });
    setActionSuccess(`Complemento fiscal "${removedXml.name}" regresó a la bandeja de pendientes.`);
  }

  // Confirmación de importación masiva desde Reporte de Gastos Excel (.xlsx)
  function handleExcelImportConfirmed(
    newItems: ExpenseItem[],
    originalFile: ExpenseFileAttachment,
    summary: ExcelAuditSummary
  ) {
    setOriginalExcelFile(originalFile);
    setExcelAuditSummary(summary);
    setUploadedAttachmentsPool((prev) => {
      if (prev.some((a) => a.id === originalFile.id)) return prev;
      return [...prev, originalFile];
    });

    // Control anti-duplicados:
    // Evita duplicar partidas si ya existían exactamente con la misma fecha, concepto e importe
    setItems((prev) => {
      const existingSignatures = new Set(
        prev.map((it) => `${it.expenseDate}_${it.concept.trim().toLowerCase()}_${it.amount}`)
      );
      const nonDuplicates = newItems.filter(
        (it) => !existingSignatures.has(`${it.expenseDate}_${it.concept.trim().toLowerCase()}_${it.amount}`)
      );

      return [...prev, ...nonDuplicates];
    });

    setActionSuccess(
      `¡Reporte de Gastos Excel "${originalFile.name}" importado con éxito! Se cargaron ${newItems.length} partidas al expediente y se conservó el archivo original para Finanzas.`
    );
  }

  // Handle Finanzas Accounting Closure
  async function handleFinalizeAccounting() {
    if (!loadedRequest) return;
    setFinalizingAccounting(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await authFetch(`/api/requests/${loadedRequest.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: finalizeAccountingNotes.trim() || 'Facturas fiscales SAT y comprobantes validados al 100%. Expediente cerrado.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al realizar el cierre contable del folio.');
      }

      setLoadedRequest(data.request);
      setShowFinalizeAccountingModal(false);
      setStatusNotice('Solicitud de viáticos finalizada y expediente cerrado contablemente por Finanzas.');
      setActionSuccess(`¡Folio ${loadedRequest.folio} cerrado contablemente con éxito por Finanzas!`);
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Error al cerrar contablemente el folio.');
    } finally {
      setFinalizingAccounting(false);
    }
  }

  // Persistencia automática del progreso de la comprobación.
  // Usa el mismo endpoint de borrador existente, pero sin interrumpir al usuario.
  async function persistDraftSilently() {
    if (!loadedRequest || !canEdit || submittingFinal || finalizingAccounting || autosaveInFlightRef.current) return;

    autosaveInFlightRef.current = true;
    try {
      const res = await authFetch('/api/expenses/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: loadedRequest.folio,
          items,
          supportFiles,
          pendingFiscalXmls,
          originalExcelFile: originalExcelFile || null,
          excelAuditSummary: excelAuditSummary || null,
          notes,
          refund: refund || undefined,
        }),
      });

      if (!res.ok) {
        console.warn('[AUTOSAVE-DRAFT] No se pudo guardar el progreso:', res.status);
      }
    } catch (e) {
      console.warn('[AUTOSAVE-DRAFT] Error al guardar progreso:', e);
    } finally {
      autosaveInFlightRef.current = false;
    }
  }

  // Cada cambio relevante se guarda automáticamente después de una breve pausa.
  // Evita peticiones por cada tecla y permite salir a otro menú sin perder el avance.
  useEffect(() => {
    if (!loadedRequest || !canEdit || searching || submittingFinal || finalizingAccounting) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void persistDraftSilently();
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    loadedRequest,
    canEdit,
    searching,
    submittingFinal,
    finalizingAccounting,
    items,
    supportFiles,
    pendingFiscalXmls,
    originalExcelFile,
    excelAuditSummary,
    notes,
    refund,
  ]);

  // Save draft
  async function handleSaveDraft() {
    if (!loadedRequest) return;
    setSavingDraft(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await authFetch('/api/expenses/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: loadedRequest.folio,
          items,
          supportFiles,
          pendingFiscalXmls,
          originalExcelFile: originalExcelFile || null,
          excelAuditSummary: excelAuditSummary || null,
          notes,
          refund: refund || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar el borrador.');
      }
      setVerification(data.verification);
      setPendingFiscalXmls(data.verification.pendingFiscalXmls || []);
      setSupportFiles(data.verification.supportFiles || []);
      setOriginalExcelFile(data.verification.originalExcelFile || null);
      setExcelAuditSummary(data.verification.excelAuditSummary || null);
      setActionSuccess('Borrador guardado exitosamente. Puedes continuar capturando en cualquier momento.');
      // Refresh list so partial progress is updated
      loadData();
    } catch (e: any) {
      setActionError(e.message || 'Error al guardar borrador.');
    } finally {
      setSavingDraft(false);
    }
  }

  function handleOpenSubmitModal() {
    if (!loadedRequest) return;
    if (items.length === 0) {
      setActionError('Debes registrar al menos un comprobante de gasto antes de finalizar.');
      return;
    }
    setActionError(null);
    setShowConfirmFinalModal(true);
  }

  // Final submission to Finanzas
  async function executeSubmitFinal() {
    if (!loadedRequest) return;
    setSubmittingFinal(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await authFetch('/api/expenses/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: loadedRequest.folio,
          items,
          supportFiles,
          pendingFiscalXmls,
          originalExcelFile: originalExcelFile || null,
          excelAuditSummary: excelAuditSummary || null,
          notes,
          refund: refund || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al finalizar la comprobación.');
      }

      setLoadedRequest(data.request);
      setVerification(data.verification);
      setPendingFiscalXmls(data.verification.pendingFiscalXmls || []);
      setSupportFiles(data.verification.supportFiles || []);
      setOriginalExcelFile(data.verification.originalExcelFile || null);
      setExcelAuditSummary(data.verification.excelAuditSummary || null);
      setCanEdit(false);
      setShowConfirmFinalModal(false);
      setStatusNotice('Comprobación finalizada y enviada con éxito a Finanzas.');
      setActionSuccess(
        '¡Comprobación enviada con éxito a Finanzas! El folio ha quedado registrado en estado COMPROBADA y se ha retirado de tus pendientes.'
      );

      // Re-load data so this folio is immediately removed from pending folios list
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Error al enviar comprobación.');
    } finally {
      setSubmittingFinal(false);
    }
  }

  function downloadAttachment(file: ExpenseFileAttachment) {
    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadAllCurrentFiles() {
    let delayCounter = 0;
    // Partidas
    items.forEach((item) => {
      if (item.xmlFile) {
        setTimeout(() => downloadAttachment(item.xmlFile!), delayCounter * 250);
        delayCounter++;
      }
      if (item.pdfFile) {
        setTimeout(() => downloadAttachment(item.pdfFile!), delayCounter * 250);
        delayCounter++;
      }
      if (item.ticketFile) {
        setTimeout(() => downloadAttachment(item.ticketFile!), delayCounter * 250);
        delayCounter++;
      }
    });
    // Documentos adjuntos de soporte (PDF, XML, Capturas)
    supportFiles.forEach((sf) => {
      setTimeout(() => downloadAttachment(sf), delayCounter * 250);
      delayCounter++;
    });
    // Complementos fiscales XML pendientes
    pendingFiscalXmls.forEach((px) => {
      setTimeout(() => downloadAttachment(px), delayCounter * 250);
      delayCounter++;
    });
    // Reporte Excel original
    if (originalExcelFile) {
      setTimeout(() => downloadAttachment(originalExcelFile), delayCounter * 250);
      delayCounter++;
    }
    // Ficha de reintegro
    if (refund?.receiptFile) {
      setTimeout(() => downloadAttachment(refund.receiptFile!), delayCounter * 250);
      delayCounter++;
    }
  }

  function downloadAllFiles(v: ExpenseVerification) {
    let delayCounter = 0;
    v.items.forEach((item) => {
      if (item.xmlFile) {
        setTimeout(() => downloadAttachment(item.xmlFile!), delayCounter * 250);
        delayCounter++;
      }
      if (item.pdfFile) {
        setTimeout(() => downloadAttachment(item.pdfFile!), delayCounter * 250);
        delayCounter++;
      }
      if (item.ticketFile) {
        setTimeout(() => downloadAttachment(item.ticketFile!), delayCounter * 250);
        delayCounter++;
      }
    });
    if (v.supportFiles && v.supportFiles.length > 0) {
      v.supportFiles.forEach((sf) => {
        setTimeout(() => downloadAttachment(sf), delayCounter * 250);
        delayCounter++;
      });
    }
    if (v.pendingFiscalXmls && v.pendingFiscalXmls.length > 0) {
      v.pendingFiscalXmls.forEach((px) => {
        setTimeout(() => downloadAttachment(px), delayCounter * 250);
        delayCounter++;
      });
    }
    if (v.originalExcelFile) {
      setTimeout(() => downloadAttachment(v.originalExcelFile!), delayCounter * 250);
      delayCounter++;
    }
    if (v.refund?.receiptFile) {
      setTimeout(() => {
        downloadAttachment(v.refund!.receiptFile!);
      }, delayCounter * 250);
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider">
              <Receipt className="w-3.5 h-3.5" />
              Módulo de Comprobación de Gastos
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Rendición y Comprobación de Viáticos
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl">
              Solo se muestran folios en estado <strong>Pagada</strong> que aún no han sido comprobados.
              Registra tus facturas fiscales (XML + PDF), tickets y reembolsos de sobrante a Finanzas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            {onNavigateToRequests && (
              <button
                type="button"
                onClick={onNavigateToRequests}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
              >
                <span>Mis Solicitudes</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-5">
        {/* Folio Search Box Card */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-teal-600" />
            Búsqueda Directa por Folio
          </h2>
          <p className="text-[11px] text-slate-500 mb-3">
            Ingresa un folio oficial para capturar facturas o consultar el expediente.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-2 max-w-xl"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFolio}
                onChange={(e) => setSearchFolio(e.target.value.toUpperCase())}
                placeholder="Ej. VIAT-2026-000001"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 uppercase tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {searching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Buscar Folio
                </>
              )}
            </button>
          </form>

          {/* Search Error Message */}
          {searchError && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900 space-y-0.5">
                <p className="font-bold">No fue posible acceder a la solicitud</p>
                <p>{searchError}</p>
              </div>
            </div>
          )}
        </div>

        {/* ORGANIZED FOLIOS PANEL requested by user:
            "cuando ya se compruebe un gasto quita de esa vista el folio.
             solo ve agregando ai folios que ya esten pagados y que no se allan comprobado
             y separalos por comprobados parcial o ya comprobados al 100%" */}
        {!loadedRequest && (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            {/* Category Navigation Pills */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-600" />
                  Bandeja de Viáticos y Comprobaciones
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isPrivileged
                    ? 'Supervisión de folios pagados por comprobar y expedientes finalizados.'
                    : 'Tus viáticos recibidos organizados por avance de comprobación.'}
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  id="tab-por-comprobar"
                  onClick={() => setActiveFolioCategory('POR_COMPROBAR')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeFolioCategory === 'POR_COMPROBAR'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Por Comprobar</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-900/40 text-teal-100 font-mono font-bold">
                    {paidUncompletedRequests.length}
                  </span>
                </button>

                <button
                  type="button"
                  id="tab-parciales"
                  onClick={() => setActiveFolioCategory('PARCIAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeFolioCategory === 'PARCIAL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Comprobados Parcial</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/60 font-mono font-bold">
                    {partialRequests.length}
                  </span>
                </button>

                <button
                  type="button"
                  id="tab-sin-iniciar"
                  onClick={() => setActiveFolioCategory('SIN_INICIAR')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeFolioCategory === 'SIN_INICIAR'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Sin Iniciar</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 font-mono font-bold">
                    {unstartedRequests.length}
                  </span>
                </button>

                <button
                  type="button"
                  id="tab-comprobadas-100"
                  onClick={() => setActiveFolioCategory('COMPROBADAS_100')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeFolioCategory === 'COMPROBADAS_100'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Comprobados al 100%</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200/60 font-mono font-bold">
                    {completed100Requests.length}
                  </span>
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="p-4">
              {/* Category 1: POR_COMPROBAR (All pending pagados) */}
              {activeFolioCategory === 'POR_COMPROBAR' && (
                <div>
                  {paidUncompletedRequests.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">¡Al día! No tienes folios pagados pendientes de comprobar</p>
                      <p className="text-slate-400 mt-1">
                        Todos los viáticos recibidos han sido comprobados o no cuentas con solicitudes pagadas pendientes.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {paidUncompletedRequests.map((req) => {
                        const ver = verificationsList.find((v) => v.folio === req.folio);
                        const isPartial = ver && ver.items && ver.items.length > 0;
                        const totalPaid = Number(req.amountAuthorized || req.amountRequested || 0);
                        const totalComp = Number(ver?.totalExpenses || 0);
                        const pct = totalPaid > 0 ? Math.min(100, Math.round((totalComp / totalPaid) * 100)) : 0;

                        return (
                          <div
                            key={req.id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-teal-400 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                  {req.folio}
                                </span>
                                {isPartial ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Borrador ({ver.items.length} gastos)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    Sin Iniciar
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 className="font-bold text-slate-900 text-xs">
                                  {req.destination || 'Comisión'}
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  {req.user?.name || req.requesterName} &bull; {req.department || 'Operaciones'}
                                </p>
                              </div>

                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-slate-500">Anticipo Recibido:</span>
                                  <span className="font-mono font-bold text-slate-900">{formatCurrency(totalPaid)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-slate-500">Comprobado:</span>
                                  <span className={`font-mono font-bold ${isPartial ? 'text-teal-700' : 'text-slate-400'}`}>
                                    {formatCurrency(totalComp)} ({pct}%)
                                  </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchFolio(req.folio);
                                  handleSearch(req.folio);
                                }}
                                className="w-full py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                              >
                                <span>{isPartial ? 'Continuar Comprobación' : 'Iniciar Comprobación'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Category 2: PARCIAL (Solo los que tienen avance borrador) */}
              {activeFolioCategory === 'PARCIAL' && (
                <div>
                  {partialRequests.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">No hay comprobaciones parciales en borrador</p>
                      <p className="text-slate-400 mt-1">
                        Cuando inicies la captura de facturas y guardes el borrador de un folio, aparecerá aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {partialRequests.map((req) => {
                        const ver = verificationsList.find((v) => v.folio === req.folio);
                        const totalPaid = Number(req.amountAuthorized || req.amountRequested || 0);
                        const totalComp = Number(ver?.totalExpenses || 0);
                        const pct = totalPaid > 0 ? Math.min(100, Math.round((totalComp / totalPaid) * 100)) : 0;

                        return (
                          <div
                            key={req.id}
                            className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200 hover:border-amber-400 shadow-2xs transition flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-xs text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                                  {req.folio}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                  {ver?.items?.length || 0} comprobante(s)
                                </span>
                              </div>

                              <div>
                                <h4 className="font-bold text-slate-900 text-xs">
                                  {req.destination || 'Comisión'}
                                </h4>
                                <p className="text-[11px] text-slate-500">{req.user?.name || req.requesterName}</p>
                              </div>

                              <div className="bg-white p-2.5 rounded-lg border border-amber-100 space-y-1.5 text-xs">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-slate-500">Anticipo:</span>
                                  <span className="font-mono font-bold text-slate-900">{formatCurrency(totalPaid)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-slate-500">Comprobado parcial:</span>
                                  <span className="font-mono font-bold text-amber-700">
                                    {formatCurrency(totalComp)} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-amber-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchFolio(req.folio);
                                  handleSearch(req.folio);
                                }}
                                className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                              >
                                <span>Continuar Comprobación</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Category 3: SIN_INICIAR (Folios pagados sin ningún gasto) */}
              {activeFolioCategory === 'SIN_INICIAR' && (
                <div>
                  {unstartedRequests.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">No hay folios sin iniciar</p>
                      <p className="text-slate-400 mt-1">Todos tus viáticos pagados ya tienen comprobación iniciada.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {unstartedRequests.map((req) => (
                        <div
                          key={req.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 shadow-2xs transition flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-xs text-indigo-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {req.folio}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                0% Comprobado
                              </span>
                            </div>

                            <div>
                              <h4 className="font-bold text-slate-900 text-xs">{req.destination || 'Comisión'}</h4>
                              <p className="text-[11px] text-slate-500">{req.user?.name || req.requesterName}</p>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs flex justify-between items-center">
                              <span className="text-slate-500">Anticipo Pagado:</span>
                              <span className="font-mono font-bold text-slate-900">
                                {formatCurrency(req.amountAuthorized || req.amountRequested || 0)}
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 mt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchFolio(req.folio);
                                handleSearch(req.folio);
                              }}
                              className="w-full py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                            >
                              <span>Iniciar Comprobación</span>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Category 4: COMPROBADAS AL 100% (Enviadas o Finalizadas) */}
              {activeFolioCategory === 'COMPROBADAS_100' && (
                <div>
                  {completed100Requests.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Aún no hay comprobaciones concluidas al 100%</p>
                      <p className="text-slate-400 mt-1">
                        Cuando finalices y envíes la comprobación de un folio a Finanzas, aparecerá en este archivo histórico.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black tracking-wider text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3">Folio</th>
                            <th className="py-2.5 px-3">Solicitante</th>
                            <th className="py-2.5 px-3">Destino</th>
                            <th className="py-2.5 px-3 text-right">Anticipo</th>
                            <th className="py-2.5 px-3 text-right">Comprobado</th>
                            <th className="py-2.5 px-3 text-center">Estado</th>
                            <th className="py-2.5 px-3 text-center">Reembolso Sobrante</th>
                            <th className="py-2.5 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-medium">
                          {completed100Requests.map((req) => {
                            const ver = verificationsList.find((v) => v.folio === req.folio);
                            const hasRefund = Boolean(ver?.refund);

                            return (
                              <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                                  {req.folio}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900">
                                  {req.user?.name || req.requesterName}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate">
                                  {req.destination || 'Comisión'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                                  {formatCurrency(req.amountAuthorized || req.amountRequested || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                                  {formatCurrency(ver?.totalExpenses || req.amountAuthorized || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      req.status === 'FINALIZADA'
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : 'bg-teal-100 text-teal-800 border border-teal-200'
                                    }`}
                                  >
                                    {req.status === 'FINALIZADA' ? 'Cerrada / Finalizada' : 'Comprobada (En Finanzas)'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {hasRefund ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      {formatCurrency(ver!.refund!.amount)} Reintegrado
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Sin reintegro</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSearchFolio(req.folio);
                                      handleSearch(req.folio);
                                    }}
                                    className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-[11px] font-bold cursor-pointer"
                                  >
                                    Ver Expediente
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* If Request is loaded */}
        {loadedRequest && (
          <div className="space-y-5">
            {/* Top Return Button & Status Banner */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setLoadedRequest(null);
                  setSearchFolio('');
                  setItems([]);
                  setRefund(null);
                  setActionSuccess(null);
                  setActionError(null);
                  loadData();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la lista de folios</span>
              </button>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                  loadedRequest.status === 'COMPROBADA'
                    ? 'bg-teal-100 text-teal-900 border border-teal-300'
                    : loadedRequest.status === 'FINALIZADA'
                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                Folio: {loadedRequest.folio} &bull; {loadedRequest.status}
              </span>
            </div>

            {/* Finanzas Contextual Review Banner */}
            {loadedRequest.status === 'COMPROBADA' && (
              <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-indigo-950 text-white rounded-xl p-5 shadow-sm border border-teal-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-400/30 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                    EXPEDIENTE RECIBIDO PARA REVISIÓN DE FINANZAS
                  </div>
                  <h2 className="text-base font-black">
                    Revisión y Cierre Contable de Comprobación
                  </h2>
                  <p className="text-xs text-teal-100 max-w-xl">
                    El colaborador ha finalizado la entrega de facturas y tickets. Finanzas puede revisar cada comprobante SAT, verificar saldos y efectuar el cierre contable definitivo.
                  </p>
                </div>

                {isPrivileged && (
                  <button
                    type="button"
                    onClick={() => {
                      setFinalizeAccountingNotes('Facturas y tickets SAT validados al 100%. Cierre contable concluido.');
                      setShowFinalizeAccountingModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black shadow-md transition cursor-pointer shrink-0"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-950" />
                    <span>Proceder al Cierre Contable del Folio</span>
                  </button>
                )}
              </div>
            )}

            {statusNotice && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-center gap-2 font-medium">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{statusNotice}</span>
              </div>
            )}

            {/* Request Overview Card */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-teal-700">
                    {loadedRequest.folio}
                  </span>
                  <span className="text-xs text-slate-500">
                    &bull; Solicitud de Viáticos
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Registrada el {new Date(loadedRequest.createdAt).toLocaleDateString('es-MX')}
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="block font-bold text-slate-400 uppercase text-[10px]">Solicitante</span>
                  <span className="font-bold text-slate-900 text-sm">{loadedRequest.requesterName || currentUser.name}</span>
                  <span className="block text-slate-400 text-[11px]">{loadedRequest.department || currentUser.department}</span>
                </div>

                <div>
                  <span className="block font-bold text-slate-400 uppercase text-[10px]">Destino del Viaje</span>
                  <span className="font-bold text-slate-900 text-sm">{loadedRequest.destination || 'N/D'}</span>
                  <span className="block text-slate-400 text-[11px]">{loadedRequest.reason || 'Comisión laboral'}</span>
                </div>

                <div>
                  <span className="block font-bold text-slate-400 uppercase text-[10px]">Periodo de Comisión</span>
                  <span className="font-semibold text-slate-800">
                    {loadedRequest.startDate ? new Date(loadedRequest.startDate).toLocaleDateString('es-MX') : 'N/D'} al{' '}
                    {loadedRequest.endDate ? new Date(loadedRequest.endDate).toLocaleDateString('es-MX') : 'N/D'}
                  </span>
                </div>

                <div>
                  <span className="block font-bold text-slate-400 uppercase text-[10px]">Monto Pagado / Anticipado</span>
                  <span className="font-black text-slate-900 text-base text-teal-700 font-mono">
                    {formatCurrency(totalAmountPaid)}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Balance Summary Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
                <span className="block font-bold text-slate-400 uppercase text-[10px]">Importe Depositado al Colaborador</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {formatCurrency(totalAmountPaid)}
                </div>
                <p className="text-[11px] text-teal-700 font-medium mt-0.5">
                  Autorizado: {formatCurrency(loadedRequest.amountAuthorized || loadedRequest.amountRequested)}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
                <span className="block font-bold text-slate-400 uppercase text-[10px]">Total de Gastos Comprobados</span>
                <div className="text-xl font-black text-teal-700 font-mono mt-1">
                  {formatCurrency(totalExpenses)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {items.length} partida(s) registradas
                </p>
              </div>

              <div className={`p-4 rounded-xl shadow-xs border transition-colors ${
                saldoFavorColaborador > 0
                  ? 'bg-blue-50/70 border-blue-300'
                  : saldoPendienteDevolucion > 0
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-emerald-50/70 border-emerald-300'
              }`}>
                <span className="block font-bold uppercase text-[10px] text-slate-500">
                  {saldoFavorColaborador > 0
                    ? 'Importe Adicional a Reembolsar'
                    : saldoPendienteDevolucion > 0
                    ? 'Importe a Devolver a DIMER'
                    : 'Liquidación de Cuentas'}
                </span>
                <div className={`text-xl font-black font-mono mt-1 ${
                  saldoFavorColaborador > 0
                    ? 'text-blue-800'
                    : saldoPendienteDevolucion > 0
                    ? 'text-amber-800'
                    : 'text-emerald-800'
                }`}>
                  {saldoFavorColaborador > 0
                    ? formatCurrency(saldoFavorColaborador)
                    : saldoPendienteDevolucion > 0
                    ? formatCurrency(saldoPendienteDevolucion)
                    : '$0.00 MXN'}
                </div>
                <p className={`text-[11px] font-bold mt-0.5 ${
                  saldoFavorColaborador > 0
                    ? 'text-blue-800'
                    : saldoPendienteDevolucion > 0
                    ? 'text-amber-800'
                    : 'text-emerald-800'
                }`}>
                  {saldoFavorColaborador > 0
                    ? 'Saldo a favor del colaborador (reembolso pendiente)'
                    : saldoPendienteDevolucion > 0
                    ? 'Devolución requerida a Tesorería DIMER'
                    : 'Cuentas saldadas (cierre limpio)'}
                </p>
              </div>
            </div>

            {/* REQUIREMENT: "deja una opcion por si tienen que reembolzar dinero a finanzas que les sobro" */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-md">
                    <Banknote className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">
                      Reembolso de Dinero Sobrante a Finanzas (Reintegro)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Si el gasto real fue menor al anticipo recibido, registra aquí la ficha de depósito o transferencia de vuelta a Finanzas.
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenRefundModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>{refund ? 'Modificar Reembolso' : '+ Registrar Reembolso de Sobrante'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const amount = Number(refund?.amount || refundAmount || difference || 0);
                        if (isNaN(amount) || amount <= 0) {
                          setRefundFormError('Primero captura o calcula un monto de reembolso mayor a $0.00 MXN.');
                          return;
                        }

                        downloadRefundReceiptPdf({
                          folio: loadedRequest.folio,
                          employeeName: loadedRequest.requesterName || loadedRequest.user?.name || currentUser.name,
                          department: loadedRequest.department || currentUser.department,
                          destination: loadedRequest.destination,
                          amount,
                          refundDate: refund?.refundDate || refundDate,
                          method: refund?.method || refundMethod,
                          reference: (refund?.reference || refundReference).trim(),
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Recibo PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const amount = Number(refund?.amount || refundAmount || difference || 0);
                        if (isNaN(amount) || amount <= 0) {
                          setRefundFormError('Primero captura o calcula un monto de reembolso mayor a $0.00 MXN.');
                          return;
                        }
                        setRefundAmount(String(amount.toFixed(2)));
                        setRefundFormError(null);
                        setShowRefundReceipt(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Vista previa / Imprimir</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4">
                {refund && (
                  <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span className="font-bold text-emerald-900 text-xs">
                          Comprobante de Reintegro de Sobrante Registrado
                        </span>
                      </div>
                      <span className="font-mono font-black text-sm text-emerald-800">
                        {formatCurrency(refund.amount)} MXN
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase block">Método de Devolución</span>
                        <span className="font-semibold text-slate-800">
                          {refund.method === 'SPEI' ? 'Transferencia Bancaria (SPEI)' : 'Efectivo / Entrega en Caja'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase block">Clave de Rastreo / Folio</span>
                        <code className="font-mono text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {refund.reference}
                        </code>
                      </div>

                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase block">Fecha del Reintegro</span>
                        <span className="font-semibold text-slate-800">{refund.refundDate}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase block">Ficha / Comprobante</span>
                        {refund.receiptFile ? (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(refund.receiptFile!)}
                            className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 font-bold underline text-xs cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="truncate max-w-[130px]">{refund.receiptFile.name}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Sin archivo adjunto</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {refund.signedReceiptFile && (
                        <button
                          type="button"
                          onClick={() => downloadAttachment(refund.signedReceiptFile!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          Ver recibo firmado
                        </button>
                      )}
                    </div>

                    {refund.notes && (
                      <div className="text-[11px] text-emerald-900 bg-white/70 p-2 rounded border border-emerald-200">
                        <strong>Observaciones:</strong> {refund.notes}
                      </div>
                    )}

                    {canEdit && (
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleRemoveRefund}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          Eliminar comprobante de reintegro
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* IMPORTADOR DE REPORTE DE GASTOS EXCEL (.XLSX) */}
            <ExcelExpensesImporter
              folio={loadedRequest.folio}
              tripStartDate={loadedRequest.startDate}
              tripEndDate={loadedRequest.endDate}
              canEdit={canEdit}
              existingOriginalFile={originalExcelFile || undefined}
              existingAuditSummary={excelAuditSummary || undefined}
              onImportConfirmed={handleExcelImportConfirmed}
              onDownloadOriginalFile={downloadAttachment}
              onOriginalFileRemoved={() => {
                setOriginalExcelFile(null);
                setExcelAuditSummary(null);
              }}
            />

            {/* BANDEJA: Comprobantes Fiscales (XML CFDI) Pendientes de Asociar */}
            {pendingFiscalXmls.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-amber-950 flex items-center gap-2">
                        <span>Comprobantes Fiscales (XML CFDI) Pendientes de Asociar</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono text-[10px] font-bold">
                          {pendingFiscalXmls.length}
                        </span>
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Los archivos <strong>.xml</strong> son complementos fiscales del comprobante y <strong>no representan un gasto por sí mismos (Importe: N/A)</strong>. Asócialos a una partida de gasto existente o crea una nueva partida.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {pendingFiscalXmls.map((xml) => (
                    <div
                      key={xml.id}
                      className="bg-white border border-amber-200 rounded-lg p-3 text-xs shadow-2xs flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <FileCode className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-bold text-slate-800 truncate" title={xml.name}>
                              {xml.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className="px-1.5 py-0.2 bg-purple-50 text-purple-800 border border-purple-200 rounded font-bold font-mono">
                                XML CFDI
                              </span>
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-semibold">
                                Estado: Pendiente de asociar a un gasto
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              <span>Importe: </span>
                              <strong className="text-slate-700">N/A</strong>
                              <span className="text-slate-400"> (No suma a balances)</span>
                            </div>
                            {xml.uuid && (
                              <p className="text-[9px] font-mono text-slate-400 truncate max-w-xs" title={`UUID: ${xml.uuid}`}>
                                UUID: {xml.uuid}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => downloadAttachment(xml)}
                            className="p-1 text-slate-400 hover:text-amber-800 rounded transition"
                            title="Descargar XML CFDI"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemovePendingXml(xml.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Descartar este XML pendiente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                          {items.length > 0 ? (
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <select
                                className="text-[11px] py-1 px-2 border border-slate-300 rounded bg-slate-50 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none max-w-[170px] truncate"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssociatePendingXmlToRow(xml, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                              >
                                <option value="" disabled>
                                  Asociar a gasto existente...
                                </option>
                                {items.map((it, idx) => (
                                  <option key={it.id} value={it.id}>
                                    #{idx + 1} {it.concept || 'Sin concepto'} ({formatCurrency(it.amount)}) {it.xmlFile ? '✓ Ya tiene XML' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleCreateRowFromPendingXml(xml)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded transition shadow-2xs cursor-pointer ml-auto"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Crear nuevo gasto con este XML</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lectura automática de importes documentales */}
            <div className="bg-white rounded-xl shadow-2xs border border-indigo-200 overflow-hidden">
              <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs text-indigo-950 flex items-center gap-2">
                    <span>Conciliación Automática de Documentos</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                      {documentTotals.analyzedDocumentCount}/{documentTotals.primaryDocumentCount} analizados
                    </span>
                  </h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    El sistema lee el total de PDF, tickets e imágenes. Los XML CFDI se conservan únicamente como complemento fiscal y no se analizan ni se suman.
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-indigo-700">Total detectado en comprobantes</span>
                  <span className="font-mono text-xl font-black text-indigo-950">{formatCurrency(documentTotals.totalDetected)}</span>
                </div>
              </div>
              <div className="p-3 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                  Facturas: {documentTotals.invoiceCount}
                </span>
                <span className="px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                  Tickets: {documentTotals.ticketCount}
                </span>
                <span className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                  Por clasificar: {documentTotals.unclassifiedCount}
                </span>
                {documentTotals.pendingDocumentCount > 0 && (
                  <span className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
                    Pendientes de lectura: {documentTotals.pendingDocumentCount}
                  </span>
                )}
                {documentTotals.withoutTotalCount > 0 && (
                  <span className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                    Sin total: {documentTotals.withoutTotalCount}
                  </span>
                )}
              </div>
            </div>

            {/* EXPEDIENTE: Documentos y Comprobantes Adjuntos (PDF, XML, Capturas) */}
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <span>Expediente de Documentos Adjuntos (PDF, XML, Capturas)</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                        {supportFiles.length} archivo(s)
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Comprobantes y soportes documentales del viaje (facturas PDF, complementos fiscales XML, fotos/capturas de ticket). Se conservan en el expediente para consulta y descarga por Finanzas o el usuario sin registrarse como partidas de gasto en la tabla.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowBulkUploaderModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Subir Documentos</span>
                    </button>
                  )}

                  {supportFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={downloadAllCurrentFiles}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                      title="Descargar todos los documentos adjuntos en este folio"
                    >
                      <FolderDown className="w-3.5 h-3.5 text-slate-600" />
                      <span>Descargar Todos ({supportFiles.length})</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                {supportFiles.length === 0 ? (
                  <div className="text-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Archive className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">No hay documentos adjuntos aún en este expediente</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
                      Sube tus facturas PDF, XML o capturas/fotos de tickets para que queden disponibles para Finanzas y para tu consulta.
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setShowBulkUploaderModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir Documentos (PDF, XML, Capturas)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {supportFiles.map((file) => {
                      const lower = file.name.toLowerCase();
                      const isPdf = lower.endsWith('.pdf');
                      const isXml = lower.endsWith('.xml') || file.role === 'COMPLEMENTO_FISCAL';
                      const isImg =
                        lower.endsWith('.jpg') ||
                        lower.endsWith('.jpeg') ||
                        lower.endsWith('.png') ||
                        lower.endsWith('.webp') ||
                        Boolean(file.type && file.type.startsWith('image/'));

                      return (
                        <div
                          key={file.id}
                          className="p-3 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-2xs transition flex flex-col justify-between gap-2.5"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                isPdf
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                  : isXml
                                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                  : 'bg-teal-50 text-teal-600 border border-teal-100'
                              }`}
                            >
                              {isPdf && <FileText className="w-4 h-4" />}
                              {isXml && <FileCode className="w-4 h-4" />}
                              {isImg && <ImageIcon className="w-4 h-4" />}
                              {!isPdf && !isXml && !isImg && <Paperclip className="w-4 h-4" />}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    isPdf
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : isXml
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-teal-50 text-teal-800 border border-teal-200'
                                  }`}
                                >
                                  {isPdf ? 'Factura PDF' : isXml ? 'Fiscal XML CFDI' : 'Captura / Ticket'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {formatFileSize(file.size)}
                                </span>
                              </div>
                              {!isXml && file.analysis?.status === 'DETECTADO' && file.analysis.amount ? (
                                <div className="text-[10px] font-mono font-bold text-indigo-800">
                                  Total detectado: {formatCurrency(file.analysis.amount)}
                                  {file.analysis.confidence && (
                                    <span className="ml-1 text-[9px] font-sans font-semibold text-slate-500">
                                      ({file.analysis.confidence.toLowerCase()} confianza)
                                    </span>
                                  )}
                                </div>
                              ) : file.analysis?.status === 'SIN_TOTAL' ? (
                                <div className="text-[10px] font-semibold text-amber-700">
                                  No se detectó un total confiable
                                </div>
                              ) : file.analysis?.status === 'ERROR' || file.analysis?.status === 'NO_DISPONIBLE' ? (
                                <div className="text-[10px] font-semibold text-slate-500">
                                  Lectura automática no disponible
                                </div>
                              ) : null}
                              {file.uuid && (
                                <p className="text-[9px] font-mono text-slate-400 truncate" title={`UUID: ${file.uuid}`}>
                                  UUID: {file.uuid}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Descargar & Ver & Eliminar */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => downloadAttachment(file)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                              title="Descargar este archivo"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                              <span>Descargar</span>
                            </button>

                            <div className="flex items-center gap-1">
                              {isImg && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalFile(file)}
                                  className="p-1 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                                  title="Vista previa de captura"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSupportFile(file.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Eliminar este archivo del expediente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Excel Expenses Matrix Table (Captura Rápida) */}
            <ExcelExpensesTable
              items={items}
              startDate={loadedRequest.startDate}
              endDate={loadedRequest.endDate}
              canEdit={canEdit}
              availableAttachments={uploadedAttachmentsPool}
              pendingFiscalXmls={pendingFiscalXmls}
              onChangeItems={setItems}
              onOpenBulkUploader={() => setShowBulkUploaderModal(true)}
              onPreviewAttachment={downloadAttachment}
              onAssignPendingXml={handleAssociatePendingXmlToRow}
              onUnassignXml={handleUnassignXml}
            />

            {/* Solicitante Notes */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observaciones generales para Finanzas (opcional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEdit}
                rows={2}
                placeholder="Ej. Se anexan facturas de hospedaje y gasolina. El reintegro de sobrante se transfirió vía SPEI a la cuenta de Dimer."
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* Feedback messages */}
            {actionSuccess && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 font-semibold">{actionSuccess}</div>
              </div>
            )}

            {actionError && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 font-semibold">{actionError}</div>
              </div>
            )}

            {/* Bottom Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setLoadedRequest(null);
                  setSearchFolio('');
                  setItems([]);
                  setRefund(null);
                  setActionSuccess(null);
                  setActionError(null);
                  loadData();
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                &larr; Volver a lista de folios
              </button>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || submittingFinal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingDraft ? 'Guardando...' : 'Guardar Borrador'}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenSubmitModal}
                      disabled={savingDraft || submittingFinal || items.length === 0}
                      title={
                        items.length === 0
                          ? 'Agrega al menos un comprobante de gasto antes de finalizar'
                          : undefined
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submittingFinal ? 'Enviando a Finanzas...' : 'Finalizar y Enviar a Finanzas'}
                    </button>
                  </>
                )}

                {originalExcelFile && (
                  <button
                    type="button"
                    onClick={() => downloadAttachment(originalExcelFile)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                    title="Descargar exactamente el archivo Excel original subido por el colaborador"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Descargar Reporte Excel Original
                  </button>
                )}

                {(verification || supportFiles.length > 0 || items.some(i => i.xmlFile || i.pdfFile || i.ticketFile) || pendingFiscalXmls.length > 0 || originalExcelFile) && (
                  <button
                    type="button"
                    onClick={downloadAllCurrentFiles}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold shadow-2xs transition cursor-pointer"
                    title="Descargar todos los archivos y comprobantes de este folio"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Comprobantes
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Registrar Reembolso de Dinero Sobrante a Finanzas */}
      {showRefundModal && loadedRequest && (
        <div className="fixed inset-0 z-[550] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-emerald-900 text-white">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="text-sm font-bold">Reembolso de Dinero Sobrante a Finanzas</h3>
                  <p className="text-[10px] text-emerald-200 font-mono">Folio: {loadedRequest.folio}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="text-emerald-200 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRefund} className="p-5 space-y-4 text-xs">
              {refundFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{refundFormError}</span>
                </div>
              )}

              {/* Informative Bank Details */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-950 space-y-1">
                <span className="font-bold block text-emerald-800 uppercase tracking-wider text-[10px]">
                  Datos Bancarios Oficiales para Reintegro:
                </span>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div><strong>Banco:</strong> BBVA México</div>
                  <div><strong>Cuenta:</strong> 0123456789</div>
                  <div><strong>CLABE:</strong> 012180001234567890</div>
                  <div><strong>Beneficiario:</strong> Dimer Corporativo</div>
                </div>
                <div className="text-[10px] text-emerald-700 pt-0.5">
                  Concepto obligatorio de transferencia: <code>REINT-{loadedRequest.folio}</code>
                </div>
              </div>

              {/* Monto y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Monto Reembolsado ($ MXN) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {difference > 0 && (
                    <button
                      type="button"
                      onClick={() => setRefundAmount(difference.toFixed(2))}
                      className="text-[10px] text-emerald-700 hover:underline font-bold mt-1 block"
                    >
                      Usar sobrante exacto ({formatCurrency(difference)})
                    </button>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fecha del Reintegro <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Método de Devolución */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Método de Devolución <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('SPEI')}
                    className={`p-2.5 rounded-lg border text-left font-bold transition flex items-center gap-2 cursor-pointer ${
                      refundMethod === 'SPEI'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-700" />
                    <div>
                      <div>Transferencia SPEI</div>
                      <div className="text-[10px] text-slate-500 font-normal">Traspaso bancario</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRefundMethod('EFECTIVO')}
                    className={`p-2.5 rounded-lg border text-left font-bold transition flex items-center gap-2 cursor-pointer ${
                      refundMethod === 'EFECTIVO'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-700" />
                    <div>
                      <div>Efectivo / Caja</div>
                      <div className="text-[10px] text-slate-500 font-normal">Entrega en ventanilla</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Referencia o Clave de Rastreo */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {refundMethod === 'SPEI'
                    ? 'Clave de Rastreo / Folio SPEI / Referencia Bancaria *'
                    : 'Folio de Recibo de Caja / Referencia *'}
                </label>
                <input
                  type="text"
                  required
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  placeholder={
                    refundMethod === 'SPEI'
                      ? 'Ej. SPEI-984210382 o BBVA-REF-001'
                      : 'Ej. REC-CAJA-082 (o FIRMA-RECIBIDO)'
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Archivo Comprobante Ficha de Depósito */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ficha de Depósito o Comprobante SPEI (PDF o Imagen)
                </label>
                <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <div>
                      {refundFile ? (
                        <div className="text-[11px] font-bold text-emerald-800">
                          {refundFile.name} ({(refundFile.size / 1024).toFixed(1)} KB)
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500">Adjuntar voucher bancario o acuse de caja</div>
                      )}
                    </div>
                  </div>

                  {refundFile ? (
                    <button
                      type="button"
                      onClick={() => setRefundFile(null)}
                      className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  ) : (
                    <label
                      htmlFor={fileRefundId}
                      className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[11px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                    >
                      Seleccionar Archivo
                      <input
                        id={fileRefundId}
                        type="file"
                        accept=".pdf,image/png,image/jpeg"
                        onChange={handleRefundFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Recibo de reembolso firmado */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Recibo de Reembolso Firmado por el Empleado (PDF)
                </label>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      {signedRefundFile ? (
                        <div className="text-[11px] font-bold text-blue-900 truncate">
                          {signedRefundFile.name} ({(signedRefundFile.size / 1024).toFixed(1)} KB)
                        </div>
                      ) : (
                        <div className="text-[11px] text-blue-800">
                          Imprime el recibo, recaba la firma, escanéalo y súbelo aquí.
                        </div>
                      )}
                    </div>
                  </div>
                  {signedRefundFile ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => downloadAttachment(signedRefundFile)} className="text-[10px] text-blue-700 font-bold hover:underline cursor-pointer">
                        Ver
                      </button>
                      <button type="button" onClick={() => setSignedRefundFile(null)} className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer">
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label htmlFor={`${fileRefundId}-signed`} className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-100 rounded text-[11px] font-bold text-blue-800 cursor-pointer shadow-2xs whitespace-nowrap">
                      Subir PDF firmado
                      <input
                        id={`${fileRefundId}-signed`}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleSignedRefundFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas u observaciones (opcional)</label>
                <input
                  type="text"
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Ej. Transferencia efectuada desde cuenta personal para liquidar saldo."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar Reembolso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRefundReceipt && loadedRequest && (
        <RefundReceiptModal
          folio={loadedRequest.folio}
          employeeName={loadedRequest.requesterName || loadedRequest.user?.name || currentUser.name}
          department={loadedRequest.department || currentUser.department}
          destination={loadedRequest.destination}
          amount={Number(refundAmount || 0)}
          refundDate={refundDate}
          method={refundMethod}
          reference={refundReference.trim()}
          onClose={() => setShowRefundReceipt(false)}
        />
      )}

      {/* Modal to Add New Expense Item */}
      {showItemModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <p className="text-[10px] font-black uppercase text-teal-600 tracking-wider">
                  Nuevo Comprobante de Gasto
                </p>
                <h3 className="text-sm font-black text-slate-900">
                  Capturar Factura o Ticket
                </h3>
              </div>
              <button
                type="button"
                onClick={resetItemModal}
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {itemFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{itemFormError}</span>
                </div>
              )}

              {/* Type Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tipo de Comprobante <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemType('FACTURA');
                      setItemFormError(null);
                    }}
                    className={`p-2.5 rounded-lg border text-left font-bold transition cursor-pointer ${
                      itemType === 'FACTURA'
                        ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-teal-600" />
                      <span>Factura Fiscal (CFDI)</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Requiere archivo XML y PDF
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setItemType('TICKET');
                      setItemFormError(null);
                    }}
                    className={`p-2.5 rounded-lg border text-left font-bold transition cursor-pointer ${
                      itemType === 'TICKET'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-amber-600" />
                      <span>Ticket de Compra</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Comprobante simple (PDF o foto)
                    </p>
                  </button>
                </div>
              </div>

              {/* Concept */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Concepto o Descripción <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemConcept}
                  onChange={(e) => setItemConcept(e.target.value)}
                  placeholder="Ej. Hospedaje Hotel Misión, Gasolina Oxxo Gas, Casetas autopista..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Hotel / Hospedaje', 'Alimentos', 'Gasolina', 'Casetas', 'Boletos', 'Taxis / Uber'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setItemConcept(tag)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-medium cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount and Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Importe Total ($ MXN) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={itemAmount}
                      onChange={(e) => setItemAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fecha del Gasto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={itemDate}
                    onChange={(e) => setItemDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* File Upload Section for FACTURA (XML + PDF) */}
              {itemType === 'FACTURA' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Archivos Fiscales Requeridos:</span>
                    <span className="text-[10px] text-slate-400">Máx. 10 MB por archivo</span>
                  </div>

                  {/* XML File */}
                  <div
                    className={`p-2.5 rounded-lg border transition ${
                      itemXmlFile ? 'bg-teal-50/60 border-teal-300' : 'bg-slate-50 border-dashed border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className={`w-4 h-4 ${itemXmlFile ? 'text-teal-600' : 'text-slate-400'}`} />
                        <div>
                          <span className="font-bold text-slate-800">1. Archivo XML (CFDI)</span>
                          {itemXmlFile ? (
                            <p className="text-[10px] text-teal-700 truncate max-w-[200px]">
                              {itemXmlFile.name} ({(itemXmlFile.size / 1024).toFixed(1)} KB)
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400">Obligatorio (.xml)</p>
                          )}
                        </div>
                      </div>

                      {itemXmlFile ? (
                        <button
                          type="button"
                          onClick={() => setItemXmlFile(null)}
                          className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          Quitar
                        </button>
                      ) : (
                        <label
                          htmlFor={fileXmlId}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                        >
                          Seleccionar XML
                          <input
                            id={fileXmlId}
                            type="file"
                            accept=".xml,text/xml"
                            onChange={(e) => handleFileUpload(e, 'xml')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* PDF File */}
                  <div
                    className={`p-2.5 rounded-lg border transition ${
                      itemPdfFile ? 'bg-blue-50/60 border-blue-300' : 'bg-slate-50 border-dashed border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className={`w-4 h-4 ${itemPdfFile ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div>
                          <span className="font-bold text-slate-800">2. Representación Impresa (PDF)</span>
                          {itemPdfFile ? (
                            <p className="text-[10px] text-blue-700 truncate max-w-[200px]">
                              {itemPdfFile.name} ({(itemPdfFile.size / 1024).toFixed(1)} KB)
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400">Obligatorio (.pdf)</p>
                          )}
                        </div>
                      </div>

                      {itemPdfFile ? (
                        <button
                          type="button"
                          onClick={() => setItemPdfFile(null)}
                          className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          Quitar
                        </button>
                      ) : (
                        <label
                          htmlFor={filePdfId}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                        >
                          Seleccionar PDF
                          <input
                            id={filePdfId}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(e) => handleFileUpload(e, 'pdf')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload Section for TICKET */}
              {itemType === 'TICKET' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Comprobante de Ticket:</span>
                    <span className="text-[10px] text-slate-400">PDF, JPG o PNG</span>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border transition ${
                      itemTicketFile ? 'bg-amber-50/60 border-amber-300' : 'bg-slate-50 border-dashed border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className={`w-4 h-4 ${itemTicketFile ? 'text-amber-600' : 'text-slate-400'}`} />
                        <div>
                          <span className="font-bold text-slate-800">Archivo de Ticket</span>
                          {itemTicketFile ? (
                            <p className="text-[10px] text-amber-700 truncate max-w-[200px]">
                              {itemTicketFile.name} ({(itemTicketFile.size / 1024).toFixed(1)} KB)
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400">Adjunta foto clara o PDF del ticket</p>
                          )}
                        </div>
                      </div>

                      {itemTicketFile ? (
                        <button
                          type="button"
                          onClick={() => setItemTicketFile(null)}
                          className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          Quitar
                        </button>
                      ) : (
                        <label
                          htmlFor={fileTicketId}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                        >
                          Subir Ticket
                          <input
                            id={fileTicketId}
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => handleFileUpload(e, 'ticket')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Extra notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas adicionales del gasto (opcional)</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej. Consumo con el cliente Ing. Martínez..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetItemModal}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Guardar Comprobante
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Final Submission */}
      {showConfirmFinalModal && loadedRequest && (
        <div className="fixed inset-0 z-[600] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6">
            <div className="p-4 bg-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-200" />
                <div>
                  <h3 className="text-sm font-black">Confirmar Envío de Comprobación</h3>
                  <p className="text-[11px] text-teal-100 font-mono">Folio: {loadedRequest.folio}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submittingFinal && setShowConfirmFinalModal(false)}
                className="text-teal-200 hover:text-white p-1 cursor-pointer disabled:opacity-50"
                disabled={submittingFinal}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Solicitante:</span>
                  <span className="font-bold text-slate-900">{loadedRequest.requesterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destino:</span>
                  <span className="text-slate-700">{loadedRequest.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Comprobantes:</span>
                  <span className="font-bold text-slate-900">
                    {items.length} ({items.filter((i) => i.type === 'FACTURA').length} facturas, {items.filter((i) => i.type === 'TICKET').length} tickets, {items.filter((i) => i.type === 'PENDIENTE').length} por clasificar)
                  </span>
                </div>
              </div>

              {/* Financial Balance Summary Card */}
              <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Importe Depositado al Colaborador:</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(totalAmountPaid)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total de Gastos Comprobados:</span>
                  <span className="font-mono font-bold text-teal-700">{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-600">Saldo no Utilizado:</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(saldoNoUtilizado)}</span>
                </div>
                {saldoPendienteDevolucion > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-amber-800">Importe a Devolver a DIMER:</span>
                    <span className="font-mono font-bold text-amber-800">{formatCurrency(saldoPendienteDevolucion)}</span>
                  </div>
                )}
                {saldoFavorColaborador > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-blue-800">Importe Adicional a Reembolsar:</span>
                    <span className="font-mono font-bold text-blue-800">{formatCurrency(saldoFavorColaborador)}</span>
                  </div>
                )}
                {saldoPendienteDevolucion === 0 && saldoFavorColaborador === 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-emerald-800">Estado de Liquidación:</span>
                    <span className="font-bold text-emerald-800">Cuentas Saldadas ($0.00 MXN)</span>
                  </div>
                )}
              </div>

              {/* Refund confirmation item */}
              {refund ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-[11px] text-emerald-950 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-emerald-800">✓ Reintegro de Sobrante Registrado:</span>
                    <span>{refund.method === 'SPEI' ? 'SPEI' : 'Efectivo'} &bull; Ref: <code>{refund.reference}</code></span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800 text-xs">
                    {formatCurrency(refund.amount)}
                  </span>
                </div>
              ) : isFavorEmpresa ? (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900">
                  <strong>Aviso:</strong> Cuentas con un importe a devolver a DIMER de {formatCurrency(saldoPendienteDevolucion)}. Si ya realizaste el depósito o transferencia de reintegro, puedes adjuntar el comprobante antes de enviar.
                </div>
              ) : null}

              {notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700">
                  <strong>Observaciones:</strong> "{notes}"
                </div>
              )}

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Al confirmar, la solicitud pasará a estatus <strong>COMPROBADA</strong>, se retirará de tu bandeja de viáticos pendientes y se notificará por correo a Finanzas.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmFinalModal(false)}
                disabled={submittingFinal}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeSubmitFinal}
                disabled={submittingFinal}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submittingFinal ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Enviando a Finanzas...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirmar y Enviar a Finanzas
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Carga Masiva de Comprobantes */}
      {showBulkUploaderModal && loadedRequest && (
        <div className="fixed inset-0 z-[550] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-6">
            <BulkExpensesUploader
              folio={loadedRequest.folio}
              existingFileSignatures={new Set(uploadedAttachmentsPool.map(a => `${a.name}_${a.size}`))}
              onAttachmentsUploaded={handleAttachmentsUploaded}
              onClose={() => setShowBulkUploaderModal(false)}
            />
          </div>
        </div>
      )}

      {/* MODAL: Cierre Contable por Finanzas */}
      {showFinalizeAccountingModal && loadedRequest && (
        <div className="fixed inset-0 z-[550] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-300" />
                Cierre Contable del Expediente
              </h4>
              <button
                type="button"
                onClick={() => setShowFinalizeAccountingModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                ¿Confirmas el cierre contable del folio <strong>{loadedRequest.folio}</strong>? Esta acción marcará la solicitud como <strong>FINALIZADA</strong> en Tesorería y cerrará formalmente el expediente.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Notas de revisión contable para auditoría:
                </label>
                <textarea
                  value={finalizeAccountingNotes}
                  onChange={(e) => setFinalizeAccountingNotes(e.target.value)}
                  rows={3}
                  placeholder="Facturas fiscales SAT y comprobantes validados al 100%..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinalizeAccountingModal(false)}
                  disabled={finalizingAccounting}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeAccounting}
                  disabled={finalizingAccounting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {finalizingAccounting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Procesando Cierre...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Confirmar Cierre Contable</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Vista Previa de Captura / Ticket / Evidencia */}
      {previewModalFile && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Eye className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="font-bold text-xs truncate">{previewModalFile.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({formatFileSize(previewModalFile.size)})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadAttachment(previewModalFile)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalFile(null)}
                  className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/10 min-h-[300px]">
              {previewModalFile.type.startsWith('image/') ||
              previewModalFile.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <img
                  src={previewModalFile.dataUrl}
                  alt={previewModalFile.name}
                  className="max-h-[70vh] max-w-full object-contain rounded shadow-md"
                />
              ) : (
                <iframe
                  src={previewModalFile.dataUrl}
                  title={previewModalFile.name}
                  className="w-full h-[70vh] rounded border border-slate-300"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
