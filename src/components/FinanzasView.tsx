import React, { useState } from 'react';
import {
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Printer,
  FileCheck,
  CreditCard,
  Building,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Banknote,
  Filter,
  Search,
  Receipt,
  ExternalLink,
  Archive,
  Eye,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import type { TravelRequest, User } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

export type FinanzasFilter =
  | 'TODAS'
  | 'PENDIENTES_PAGO'
  | 'PENDIENTES_CERRAR'
  | 'PAGADAS'
  | 'COMPROBADAS'
  | 'FINALIZADAS';

interface FinanzasViewProps {
  currentUser: User | null;
  requests: TravelRequest[];
  onRefreshData: () => void;
  onOpenPrintVoucher: (request: TravelRequest) => void;
  onNavigateToComprobar?: (folio: string) => void;
}

export default function FinanzasView({
  currentUser,
  requests,
  onRefreshData,
  onOpenPrintVoucher,
  onNavigateToComprobar,
}: FinanzasViewProps) {
  const [selectedRequestForPayment, setSelectedRequestForPayment] = useState<TravelRequest | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'SPEI' | 'EFECTIVO'>('SPEI');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New filters requested by user
  const [activeFilter, setActiveFilter] = useState<FinanzasFilter>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal for closing expense
  const [requestToFinalize, setRequestToFinalize] = useState<TravelRequest | null>(null);
  const [finalizeNotes, setFinalizeNotes] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const safeRequests = Array.isArray(requests) ? requests : [];

  // Subsets
  const approvedForPayment = safeRequests.filter((r) => r.status === 'APROBADA');
  const paidRequests = safeRequests.filter((r) => r.status === 'PAGADA');
  const comprobadasRequests = safeRequests.filter((r) => r.status === 'COMPROBADA');
  const pendingClosingRequests = safeRequests.filter(
    (r) => r.status === 'PAGADA' || r.status === 'COMPROBADA'
  );
  const finalizedRequests = safeRequests.filter((r) => r.status === 'FINALIZADA');

  // Filtered requests according to active tab
  let filteredRequests: TravelRequest[] = [];
  if (activeFilter === 'PENDIENTES_PAGO') {
    filteredRequests = approvedForPayment;
  } else if (activeFilter === 'PENDIENTES_CERRAR') {
    filteredRequests = pendingClosingRequests;
  } else if (activeFilter === 'PAGADAS') {
    filteredRequests = paidRequests;
  } else if (activeFilter === 'COMPROBADAS') {
    filteredRequests = comprobadasRequests;
  } else if (activeFilter === 'FINALIZADAS') {
    filteredRequests = finalizedRequests;
  } else {
    // TODAS: include all requests in financial lifecycle
    filteredRequests = safeRequests.filter((r) =>
      ['APROBADA', 'PAGADA', 'COMPROBADA', 'FINALIZADA'].includes(r.status)
    );
  }

  // Apply search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredRequests = filteredRequests.filter((r) => {
      const folio = (r.folio || '').toLowerCase();
      const name = (r.user?.name || r.requesterName || '').toLowerCase();
      const dest = (r.destination || '').toLowerCase();
      const dept = (r.department || '').toLowerCase();
      return folio.includes(q) || name.includes(q) || dest.includes(q) || dept.includes(q);
    });
  }

  // Financial totals
  const totalAuthorizedPendingPayment = approvedForPayment.reduce(
    (acc, r) => acc + (r.amountAuthorized || r.amountRequested),
    0
  );
  const totalPaid = paidRequests.reduce(
    (acc, r) => acc + (r.amountAuthorized || r.amountRequested),
    0
  );
  const totalComprobadas = comprobadasRequests.reduce(
    (acc, r) => acc + (r.amountAuthorized || r.amountRequested),
    0
  );

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForPayment) return;

    setProcessing(true);
    setStatusMessage(null);

    try {
      const defaultRef = paymentMethod === 'EFECTIVO' ? 'PAGO-EN-EFECTIVO' : 'SPEI-DIRECTO';
      const defaultNotes =
        paymentMethod === 'EFECTIVO'
          ? 'Pago en efectivo entregado al colaborador y registrado por Finanzas'
          : 'Dispersión bancaria SPEI autorizada por Finanzas';

      await safeFetchJson(`/api/requests/${selectedRequestForPayment.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          reference: paymentReference.trim() || defaultRef,
          notes: paymentNotes.trim() || defaultNotes,
        }),
      });

      setStatusMessage(
        `¡Dispersión registrada con éxito (${paymentMethod}) para el folio ${selectedRequestForPayment.folio}!`
      );
      setSelectedRequestForPayment(null);
      setPaymentMethod('SPEI');
      setPaymentReference('');
      setPaymentNotes('');
      onRefreshData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const executeFinalize = async () => {
    if (!requestToFinalize) return;

    setFinalizing(true);
    try {
      await safeFetchJson(`/api/requests/${requestToFinalize.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: finalizeNotes.trim() || 'Comprobación de viáticos verificada y expediente cerrado por Finanzas.',
        }),
      });

      setStatusMessage(`Solicitud ${requestToFinalize.folio} FINALIZADA con expediente cerrado.`);
      setRequestToFinalize(null);
      setFinalizeNotes('');
      onRefreshData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / KPIs */}
      <div className="bg-[#0f172a] text-white rounded-xl p-4 shadow-xs border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30 uppercase font-mono">
              Tesorería & Finanzas
            </span>
            <h1 className="text-base font-bold text-white mt-1">Dispersión y Liquidación de Viáticos</h1>
            <p className="text-xs text-slate-400">
              Control de dispersión de anticipos, seguimiento de comprobaciones y cierre contable de expedientes.
            </p>
          </div>
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-400 block text-[10px]">Buzón Oficial:</span>
            <strong className="text-emerald-400 font-mono text-xs">finanzas@dimer.com.mx</strong>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div
            onClick={() => setActiveFilter('PENDIENTES_PAGO')}
            className={`cursor-pointer transition p-3 rounded-lg border ${
              activeFilter === 'PENDIENTES_PAGO'
                ? 'bg-emerald-950/70 border-emerald-400 ring-1 ring-emerald-400'
                : 'bg-emerald-950/30 border-emerald-500/30 hover:bg-emerald-950/50'
            }`}
          >
            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider block">
              Por Dispersar (Aprobadas)
            </span>
            <div className="text-xl font-black text-emerald-300 mt-0.5">
              {formatCurrency(totalAuthorizedPendingPayment)}
            </div>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">
              {approvedForPayment.length} solicitud(es) autorizada(s)
            </span>
          </div>

          <div
            onClick={() => setActiveFilter('PAGADAS')}
            className={`cursor-pointer transition p-3 rounded-lg border ${
              activeFilter === 'PAGADAS'
                ? 'bg-blue-950/70 border-blue-400 ring-1 ring-blue-400'
                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
            }`}
          >
            <span className="text-[10px] text-blue-300 uppercase font-bold tracking-wider block">
              Pagadas / En Viaje
            </span>
            <div className="text-xl font-black text-white mt-0.5">{formatCurrency(totalPaid)}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {paidRequests.length} en comprobación
            </span>
          </div>

          <div
            onClick={() => setActiveFilter('COMPROBADAS')}
            className={`cursor-pointer transition p-3 rounded-lg border ${
              activeFilter === 'COMPROBADAS'
                ? 'bg-teal-950/70 border-teal-400 ring-1 ring-teal-400'
                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
            }`}
          >
            <span className="text-[10px] text-teal-300 uppercase font-bold tracking-wider block">
              Comprobadas (Por Revisar)
            </span>
            <div className="text-xl font-black text-teal-300 mt-0.5">{comprobadasRequests.length}</div>
            <span className="text-[10px] text-teal-400 mt-0.5 block">
              {formatCurrency(totalComprobadas)} comprobado
            </span>
          </div>

          <div
            onClick={() => setActiveFilter('FINALIZADAS')}
            className={`cursor-pointer transition p-3 rounded-lg border ${
              activeFilter === 'FINALIZADAS'
                ? 'bg-purple-950/70 border-purple-400 ring-1 ring-purple-400'
                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
            }`}
          >
            <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider block">
              Expedientes Cerrados
            </span>
            <div className="text-xl font-black text-purple-300 mt-0.5">{finalizedRequests.length}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Finalizadas al 100%</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* FILTER BAR requested by user:
          "filtrar por pendientes de pago, pendientes de cerrar gasto, pagadas, y comprobadas" */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="filter-todas"
              type="button"
              onClick={() => setActiveFilter('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'TODAS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Todas</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/40 font-mono">
                {safeRequests.filter((r) => ['APROBADA', 'PAGADA', 'COMPROBADA', 'FINALIZADA'].includes(r.status)).length}
              </span>
            </button>

            <button
              id="filter-pendientes-pago"
              type="button"
              onClick={() => setActiveFilter('PENDIENTES_PAGO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'PENDIENTES_PAGO'
                  ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-600'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pendientes de Pago</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/60 font-mono font-black">
                {approvedForPayment.length}
              </span>
            </button>

            <button
              id="filter-pendientes-cerrar"
              type="button"
              onClick={() => setActiveFilter('PENDIENTES_CERRAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'PENDIENTES_CERRAR'
                  ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-600'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes de Cerrar Gasto</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/60 font-mono font-black">
                {pendingClosingRequests.length}
              </span>
            </button>

            <button
              id="filter-pagadas"
              type="button"
              onClick={() => setActiveFilter('PAGADAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'PAGADAS'
                  ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-600'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Pagadas</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-200/60 font-mono font-black">
                {paidRequests.length}
              </span>
            </button>

            <button
              id="filter-comprobadas"
              type="button"
              onClick={() => setActiveFilter('COMPROBADAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'COMPROBADAS'
                  ? 'bg-teal-600 text-white shadow-xs ring-1 ring-teal-600'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Comprobadas</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-200/60 font-mono font-black">
                {comprobadasRequests.length}
              </span>
            </button>

            <button
              id="filter-finalizadas"
              type="button"
              onClick={() => setActiveFilter('FINALIZADAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'FINALIZADAS'
                  ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-600'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Cerradas</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200/60 font-mono font-black">
                {finalizedRequests.length}
              </span>
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar folio, beneficiario, destino..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Filtered Table View */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              {activeFilter === 'PENDIENTES_PAGO' && 'Solicitudes Aprobadas por Dispersar (Pendientes de Pago)'}
              {activeFilter === 'PENDIENTES_CERRAR' && 'Viáticos Dispersados Pendientes de Cierre Contable'}
              {activeFilter === 'PAGADAS' && 'Solicitudes Pagadas (En Comprobación de Gastos)'}
              {activeFilter === 'COMPROBADAS' && 'Comprobaciones Recibidas con Expediente Completo (Listas para Cierre)'}
              {activeFilter === 'FINALIZADAS' && 'Histórico de Expedientes Cerrados y Auditados'}
              {activeFilter === 'TODAS' && 'Bandeja General de Finanzas & Pagos'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {activeFilter === 'PENDIENTES_PAGO' && 'Genera dispersión SPEI o entrega en efectivo para fondear el viaje.'}
              {activeFilter === 'PENDIENTES_CERRAR' && 'Viáticos que requieren verificar comprobantes SAT o cerrar gasto contable.'}
              {activeFilter === 'PAGADAS' && 'Colaboradores con anticipo recibido en proceso de captura de comprobantes.'}
              {activeFilter === 'COMPROBADAS' && 'Facturas fiscales XML/PDF y balance enviados a Finanzas para revisión.'}
              {activeFilter === 'FINALIZADAS' && 'Expedientes concluidos con balance conciliado.'}
              {activeFilter === 'TODAS' && 'Visualización integral de todas las solicitudes en proceso financiero.'}
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {filteredRequests.length} registro(s)
          </span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No hay solicitudes en este filtro</p>
            <p className="text-slate-400 mt-0.5">
              {searchQuery
                ? 'No se encontraron resultados con el criterio de búsqueda ingresado.'
                : 'No existen registros pendientes en esta categoría actualmente.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Beneficiario</th>
                  <th className="py-2.5 px-3">Destino / Fechas</th>
                  <th className="py-2.5 px-3 text-right">Monto Autorizado</th>
                  <th className="py-2.5 px-3 text-center">Estado Financiero</th>
                  <th className="py-2.5 px-3 text-right">Acciones Disponibles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredRequests.map((r) => {
                  const isAprobada = r.status === 'APROBADA';
                  const isPagada = r.status === 'PAGADA';
                  const isComprobada = r.status === 'COMPROBADA';
                  const isFinalizada = r.status === 'FINALIZADA';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Folio */}
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700 text-xs whitespace-nowrap">
                        {r.folio}
                      </td>

                      {/* Beneficiario */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">
                          {r.user?.name || r.requesterName || 'Colaborador'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.department || r.user?.department || 'Operaciones'} &bull; {r.user?.email || r.bossEmail}
                        </div>
                      </td>

                      {/* Destino / Fechas */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-semibold text-slate-800 text-xs truncate">
                          {r.destination || 'Comisión'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(r.startDate).toLocaleDateString('es-MX')} al{' '}
                          {new Date(r.endDate).toLocaleDateString('es-MX')}
                        </div>
                      </td>

                      {/* Monto */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-xs text-right whitespace-nowrap">
                        {formatCurrency(r.amountAuthorized || r.amountRequested || 0)}
                      </td>

                      {/* Estado Financiero Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isAprobada && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pendiente de Pago
                          </span>
                        )}
                        {isPagada && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Pagada (En Comprobación)
                          </span>
                        )}
                        {isComprobada && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 shadow-2xs">
                            <CheckCircle className="w-3 h-3 text-teal-700" />
                            Comprobada (Lista p/ Cierre)
                          </span>
                        )}
                        {isFinalizada && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                            <Archive className="w-3 h-3 text-purple-700" />
                            Cerrada / Finalizada
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Póliza Button (always available) */}
                          <button
                            type="button"
                            onClick={() => onOpenPrintVoucher(r)}
                            title="Imprimir Póliza de Viáticos"
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Póliza</span>
                          </button>

                          {/* PENDIENTES DE PAGO: Registrar Pago */}
                          {isAprobada && (
                            <button
                              id={`btn-registrar-pago-${r.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedRequestForPayment(r);
                                setPaymentMethod('SPEI');
                                setPaymentReference('');
                                setPaymentNotes('');
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold shadow-xs flex items-center gap-1 transition cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Registrar Pago</span>
                            </button>
                          )}

                          {/* COMPROBADA: Ver Comprobantes y Cerrar Gasto */}
                          {isComprobada && (
                            <>
                              {onNavigateToComprobar && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToComprobar(r.folio)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Receipt className="w-3 h-3 text-teal-600" />
                                  <span>Ver Comprobación</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setRequestToFinalize(r);
                                  setFinalizeNotes('Facturas y tickets SAT validados al 100%. Expediente concluido.');
                                }}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Cerrar Gasto</span>
                              </button>
                            </>
                          )}

                          {/* PAGADA: Ver Comprobación o Cerrar Gasto Directo */}
                          {isPagada && (
                            <>
                              {onNavigateToComprobar && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToComprobar(r.folio)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Eye className="w-3 h-3 text-slate-500" />
                                  <span>Revisar Gastos</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setRequestToFinalize(r);
                                  setFinalizeNotes('Cierre anticipado o directo autorizado por Finanzas.');
                                }}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition"
                              >
                                <span>Cerrar Gasto</span>
                              </button>
                            </>
                          )}

                          {/* FINALIZADA: Ver Comprobantes */}
                          {isFinalizada && onNavigateToComprobar && (
                            <button
                              type="button"
                              onClick={() => onNavigateToComprobar(r.folio)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                            >
                              <FileCheck className="w-3 h-3 text-purple-600" />
                              <span>Expediente</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirmar Cierre de Gasto */}
      {requestToFinalize && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] text-white rounded-xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                  Cierre Contable de Gasto
                </span>
                <h3 className="text-base font-bold font-mono">Folio: {requestToFinalize.folio}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRequestToFinalize(null)}
                className="text-slate-400 hover:text-white p-1 rounded text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Beneficiario:</span>
                  <span className="font-bold text-white">
                    {requestToFinalize.user?.name || requestToFinalize.requesterName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Monto Dispersado:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(requestToFinalize.amountAuthorized || requestToFinalize.amountRequested || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estado Actual:</span>
                  <span className="font-mono font-bold text-teal-400">{requestToFinalize.status}</span>
                </div>
              </div>

              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-lg text-purple-200 text-[11px] leading-relaxed">
                Al confirmar, la solicitud pasará al estado final <strong>FINALIZADA</strong>, concluyendo el ciclo contable y archivando el expediente de viáticos.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Notas de Cierre Contable (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={finalizeNotes}
                  onChange={(e) => setFinalizeNotes(e.target.value)}
                  placeholder="Facturas fiscales SAT y comprobantes validados. Saldo liquidado satisfactoriamente..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRequestToFinalize(null)}
                  disabled={finalizing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeFinalize}
                  disabled={finalizing}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {finalizing ? 'Finalizando...' : 'Confirmar Cierre de Gasto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Pago (SPEI o Efectivo) */}
      {selectedRequestForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] text-white rounded-xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Registro de Pago • Tesorería
                </span>
                <h3 className="text-base font-bold font-mono">Folio: {selectedRequestForPayment.folio}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestForPayment(null)}
                className="text-slate-400 hover:text-white p-1 rounded text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-4 space-y-3.5 text-xs">
              {/* Beneficiario y Monto */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Monto a Dispersar</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {formatCurrency(
                      selectedRequestForPayment.amountAuthorized || selectedRequestForPayment.amountRequested
                    )}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-300 font-medium">
                  <span className="block font-bold text-white">
                    {selectedRequestForPayment.user?.name || selectedRequestForPayment.requesterName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {selectedRequestForPayment.department || 'Operaciones'}
                  </span>
                </div>
              </div>

              {/* Selector de Método de Pago: SPEI o Efectivo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Método de Pago *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="btn-select-spei"
                    onClick={() => {
                      setPaymentMethod('SPEI');
                      setPaymentReference('');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition cursor-pointer ${
                      paymentMethod === 'SPEI'
                        ? 'bg-blue-950/60 border-blue-500 text-white shadow-xs ring-1 ring-blue-500'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <CreditCard
                      className={`w-4 h-4 shrink-0 ${paymentMethod === 'SPEI' ? 'text-blue-400' : 'text-slate-500'}`}
                    />
                    <div>
                      <div className="font-bold text-xs text-white">SPEI</div>
                      <div className="text-[10px] text-slate-400">Transferencia bancaria</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-select-efectivo"
                    onClick={() => {
                      setPaymentMethod('EFECTIVO');
                      setPaymentReference('');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition cursor-pointer ${
                      paymentMethod === 'EFECTIVO'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-xs ring-1 ring-emerald-500'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <Banknote
                      className={`w-4 h-4 shrink-0 ${
                        paymentMethod === 'EFECTIVO' ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    <div>
                      <div className="font-bold text-xs text-white">Efectivo</div>
                      <div className="text-[10px] text-slate-400">Entrega en caja / sobre</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Referencia dinámica */}
              {paymentMethod === 'SPEI' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Clave de Rastreo / Folio SPEI / Referencia Bancaria *
                  </label>
                  <input
                    id="input-spei-reference"
                    type="text"
                    required
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Ej. SPEI-8921827419 (BBVA / Santander)"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Folio de Recibo / Vale de Caja / Referencia (Opcional)
                  </label>
                  <input
                    id="input-efectivo-reference"
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Ej. REC-EFECTIVO-001 (o dejar vacío para 'PAGO-EN-EFECTIVO')"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Notas de Tesorería</label>
                <textarea
                  id="textarea-payment-notes"
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder={
                    paymentMethod === 'EFECTIVO'
                      ? 'Efectivo entregado en ventanilla de tesorería contra firma de recibido...'
                      : 'Transferencia aplicada exitosamente a la cuenta bancaria del colaborador...'
                  }
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequestForPayment(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-payment"
                  type="submit"
                  disabled={processing}
                  className={`px-3.5 py-1.5 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-xs transition disabled:opacity-50 cursor-pointer ${
                    paymentMethod === 'EFECTIVO'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {processing
                    ? 'Registrando...'
                    : paymentMethod === 'EFECTIVO'
                    ? 'Confirmar Pago en Efectivo'
                    : 'Confirmar Dispersión SPEI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
