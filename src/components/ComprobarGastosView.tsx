import React, { useState, useEffect, useId, useMemo } from 'react';
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
  Edit3
} from 'lucide-react';
import type {
  User as UserType,
  TravelRequest,
  ExpenseItem,
  ExpenseVerification,
  ExpenseType,
  ExpenseFileAttachment,
  ExpenseRefund,
} from '../types';
import { authFetch } from '../utils/apiHelper';

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
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<'SPEI' | 'EFECTIVO'>('SPEI');
  const [refundReference, setRefundReference] = useState<string>('');
  const [refundDate, setRefundDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [refundFile, setRefundFile] = useState<ExpenseFileAttachment | null>(null);
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

  // Saving / Finalizing states
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
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
        setNotes(data.verification.notes || '');
        if (data.verification.refund) {
          setRefund(data.verification.refund);
        } else {
          setRefund(null);
        }
      } else {
        setItems([]);
        setNotes('');
        setRefund(null);
      }
    } catch (e: any) {
      setSearchError(e.message || 'Error de conexión al buscar solicitud.');
    } finally {
      setSearching(false);
    }
  }

  // File to base64 converter helper for expense items
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
    reader.onload = () => {
      const attachment: ExpenseFileAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || (field === 'xml' ? 'text/xml' : field === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      };

      if (field === 'xml') setItemXmlFile(attachment);
      if (field === 'pdf') setItemPdfFile(attachment);
      if (field === 'ticket') setItemTicketFile(attachment);
      setItemFormError(null);
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
      notes: refundNotes.trim() || undefined,
      registeredAt: refund?.registeredAt || new Date().toISOString(),
    };

    setRefund(savedRefund);
    setShowRefundModal(false);
    setActionSuccess('Comprobante de reembolso de sobrante registrado. Recuerda guardar el borrador o finalizar.');
  }

  function handleRemoveRefund() {
    if (confirm('¿Deseas eliminar el comprobante de reembolso registrado?')) {
      setRefund(null);
      setActionSuccess('Reembolso eliminado.');
    }
  }

  // Financial calculations
  const totalAmountPaid = Number(
    loadedRequest?.amountAuthorized && Number(loadedRequest.amountAuthorized) > 0
      ? loadedRequest.amountAuthorized
      : loadedRequest?.amountRequested || 0
  );
  const totalExpenses = items.reduce((acc, it) => acc + Number(it.amount || 0), 0);
  const difference = Number((totalAmountPaid - totalExpenses).toFixed(2));
  const isFavorEmpresa = difference > 0;
  const isFavorColaborador = difference < 0;
  const isExacto = difference === 0;

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
          notes,
          refund: refund || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar el borrador.');
      }
      setVerification(data.verification);
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

  function downloadAllFiles(v: ExpenseVerification) {
    v.items.forEach((item, index) => {
      setTimeout(() => {
        if (item.xmlFile) downloadAttachment(item.xmlFile);
        if (item.pdfFile) downloadAttachment(item.pdfFile);
        if (item.ticketFile) downloadAttachment(item.ticketFile);
      }, index * 250);
    });
    if (v.refund?.receiptFile) {
      setTimeout(() => {
        downloadAttachment(v.refund!.receiptFile!);
      }, (v.items.length || 1) * 250);
    }
  }

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
                <span className="block font-bold text-slate-400 uppercase text-[10px]">Anticipo Otorgado</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {formatCurrency(totalAmountPaid)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Dispersado por Tesorería</p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
                <span className="block font-bold text-slate-400 uppercase text-[10px]">Gastos Comprobados</span>
                <div className="text-xl font-black text-teal-700 font-mono mt-1">
                  {formatCurrency(totalExpenses)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{items.length} comprobante(s) registrado(s)</p>
              </div>

              <div
                className={`p-4 rounded-xl shadow-xs border transition-colors ${
                  isFavorEmpresa
                    ? 'bg-amber-50/60 border-amber-300'
                    : isFavorColaborador
                    ? 'bg-blue-50/60 border-blue-300'
                    : 'bg-emerald-50/60 border-emerald-300'
                }`}
              >
                <span className="block font-bold uppercase text-[10px] text-slate-500">
                  Diferencia / Balance
                </span>
                <div
                  className={`text-xl font-black font-mono mt-1 ${
                    isFavorEmpresa ? 'text-amber-800' : isFavorColaborador ? 'text-blue-800' : 'text-emerald-800'
                  }`}
                >
                  {isFavorEmpresa ? `+${formatCurrency(difference)}` : isFavorColaborador ? `-${formatCurrency(Math.abs(difference))}` : '$0.00 MXN'}
                </div>
                <p
                  className={`text-[11px] font-bold mt-0.5 ${
                    isFavorEmpresa ? 'text-amber-800' : isFavorColaborador ? 'text-blue-800' : 'text-emerald-800'
                  }`}
                >
                  {isFavorEmpresa
                    ? 'Sobrante a devolver a Finanzas'
                    : isFavorColaborador
                    ? 'Faltante a favor del colaborador'
                    : 'Comprobación exacta al 100%'}
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
                  <button
                    type="button"
                    onClick={handleOpenRefundModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>{refund ? 'Modificar Reembolso' : '+ Registrar Reembolso de Sobrante'}</span>
                  </button>
                )}
              </div>

              <div className="p-4">
                {refund ? (
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
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800">
                        {isFavorEmpresa
                          ? `Tienes un sobrante a devolver a Finanzas de ${formatCurrency(difference)} MXN.`
                          : 'No se ha registrado ningún reembolso de dinero sobrante a Finanzas.'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Cuenta bancaria oficial BBVA: <strong>0123456789</strong> &bull; CLABE: <strong>012180001234567890</strong> &bull; Titular: <strong>Dimer Corporativo S.A. de C.V.</strong>
                      </p>
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleOpenRefundModal}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold text-xs shadow-2xs whitespace-nowrap cursor-pointer"
                      >
                        + Adjuntar Reembolso
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expense Items List & Add Button */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    Comprobantes de Gastos Registrados
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Facturas fiscales con archivo XML y PDF, o tickets de compra con fotografía/PDF.
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      resetItemModal();
                      setShowItemModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Comprobante</span>
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Sin comprobantes registrados</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-md mx-auto">
                    {canEdit
                      ? 'Haz clic en "Agregar Comprobante" para adjuntar tus facturas (XML + PDF) o tickets.'
                      : 'No se encontraron comprobantes registrados para esta solicitud.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Concepto</th>
                        <th className="px-3 py-2.5">Fecha</th>
                        <th className="px-3 py-2.5">Tipo</th>
                        <th className="px-3 py-2.5 text-right">Importe</th>
                        <th className="px-3 py-2.5">Archivos Adjuntos</th>
                        <th className="px-3 py-2.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item, index) => {
                        const isFactura = item.type === 'FACTURA';
                        const hasXml = Boolean(item.xmlFile);
                        const hasPdf = Boolean(item.pdfFile);
                        const hasTicket = Boolean(item.ticketFile);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              <div>{item.concept}</div>
                              {item.notes && (
                                <div className="text-[10px] text-slate-400 font-normal">{item.notes}</div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                              {item.expenseDate}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isFactura
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isFactura ? 'Factura Fiscal' : 'Ticket'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              {formatCurrency(item.amount)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isFactura ? (
                                  <>
                                    {hasXml ? (
                                      <button
                                        type="button"
                                        onClick={() => downloadAttachment(item.xmlFile!)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10px] font-bold border border-teal-200 cursor-pointer"
                                        title={`Descargar ${item.xmlFile!.name}`}
                                      >
                                        <FileCode className="w-3 h-3 text-teal-600" />
                                        XML
                                        <Download className="w-2.5 h-2.5" />
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                        Falta XML
                                      </span>
                                    )}

                                    {hasPdf ? (
                                      <button
                                        type="button"
                                        onClick={() => downloadAttachment(item.pdfFile!)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200 cursor-pointer"
                                        title={`Descargar ${item.pdfFile!.name}`}
                                      >
                                        <FileText className="w-3 h-3 text-blue-600" />
                                        PDF
                                        <Download className="w-2.5 h-2.5" />
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                        Falta PDF
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {hasTicket ? (
                                      <button
                                        type="button"
                                        onClick={() => downloadAttachment(item.ticketFile!)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 cursor-pointer"
                                        title={`Descargar ${item.ticketFile!.name}`}
                                      >
                                        <FileText className="w-3 h-3 text-amber-600" />
                                        Ticket
                                        <Download className="w-2.5 h-2.5" />
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                        Sin comprobante
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Eliminar comprobante"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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

                {verification && (
                  <button
                    type="button"
                    onClick={() => downloadAllFiles(verification)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold shadow-2xs transition cursor-pointer"
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
                    {items.length} ({items.filter((i) => i.type === 'FACTURA').length} facturas, {items.filter((i) => i.type === 'TICKET').length} tickets)
                  </span>
                </div>
              </div>

              {/* Financial Balance Summary Card */}
              <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Anticipo Otorgado:</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(totalAmountPaid)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total Comprobado:</span>
                  <span className="font-mono font-bold text-teal-700">{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="font-bold text-slate-700">Balance:</span>
                  <div>
                    {isFavorEmpresa ? (
                      <span className="font-bold text-amber-800">
                        Sobrante Empresa: {formatCurrency(difference)}
                      </span>
                    ) : isFavorColaborador ? (
                      <span className="font-bold text-blue-800">
                        Faltante Reembolsar: {formatCurrency(Math.abs(difference))}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-800">Exacto ($0.00)</span>
                    )}
                  </div>
                </div>
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
                  <strong>Aviso:</strong> Tienes un saldo a favor de la empresa por {formatCurrency(difference)}. Si ya realizaste el depósito o transferencia, puedes adjuntar el comprobante de reintegro antes de enviar.
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
    </div>
  );
};
