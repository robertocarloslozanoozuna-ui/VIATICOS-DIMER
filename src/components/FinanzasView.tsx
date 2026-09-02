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
  AlertCircle
} from 'lucide-react';
import type { TravelRequest, User } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

interface FinanzasViewProps {
  currentUser: User | null;
  requests: TravelRequest[];
  onRefreshData: () => void;
  onOpenPrintVoucher: (request: TravelRequest) => void;
}

export default function FinanzasView({
  currentUser,
  requests,
  onRefreshData,
  onOpenPrintVoucher,
}: FinanzasViewProps) {
  const [selectedRequestForPayment, setSelectedRequestForPayment] = useState<TravelRequest | null>(null);
  const [speiReference, setSpeiReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const safeRequests = Array.isArray(requests) ? requests : [];

  const approvedForPayment = safeRequests.filter((r) => r.status === 'APROBADA');
  const paidRequests = safeRequests.filter((r) => r.status === 'PAGADA');
  const finalizedRequests = safeRequests.filter((r) => r.status === 'FINALIZADA');

  const totalAuthorizedPendingPayment = approvedForPayment.reduce(
    (acc, r) => acc + (r.amountAuthorized || r.amountRequested),
    0
  );
  const totalPaid = paidRequests.reduce(
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
      await safeFetchJson(`/api/requests/${selectedRequestForPayment.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: speiReference.trim() || 'SPEI-DIRECTO',
          notes: paymentNotes.trim() || 'Dispersión bancaria autorizada por Finanzas',
        }),
      });

      setStatusMessage(`¡Dispersión registrada con éxito para el folio ${selectedRequestForPayment.folio}!`);
      setSelectedRequestForPayment(null);
      setSpeiReference('');
      setPaymentNotes('');
      onRefreshData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async (requestId: string, folio: string) => {
    if (!confirm(`¿Confirmas la finalización y cierre de comprobación de gastos para el folio ${folio}?`)) {
      return;
    }

    try {
      await safeFetchJson(`/api/requests/${requestId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'Facturas fiscales SAT y comprobantes verificados al 100%',
        }),
      });

      setStatusMessage(`Solicitud ${folio} FINALIZADA con comprobación completa.`);
      onRefreshData();
    } catch (e: any) {
      alert(e.message);
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
              Bandeja receptora de órdenes de pago tras el dictamen favorable del supervisor.
            </p>
          </div>
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-400 block text-[10px]">Buzón Oficial:</span>
            <strong className="text-emerald-400 font-mono text-xs">finanzas@dimer.com.mx</strong>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3">
            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider block">Por Dispersar (Aprobadas)</span>
            <div className="text-xl font-black text-emerald-300 mt-0.5">
              {formatCurrency(totalAuthorizedPendingPayment)}
            </div>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">
              {approvedForPayment.length} solicitud(es) autorizada(s)
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Pagado / Dispersado</span>
            <div className="text-xl font-black text-white mt-0.5">{formatCurrency(totalPaid)}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {paidRequests.length} solicitud(es) transferida(s)
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Comprobaciones Finalizadas</span>
            <div className="text-xl font-black text-purple-300 mt-0.5">{finalizedRequests.length}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Expedientes cerrados</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{statusMessage}</span>
        </div>
      )}

      {/* Section 1: Solicitudes Listas para Pago (APROBADAS) */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Solicitudes Autorizadas por Supervisor (Listas para Pago)
            </h3>
            <p className="text-[11px] text-slate-500">
              Requieren registro de transferencia bancaria SPEI para dispersión.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
            {approvedForPayment.length} Pendientes
          </span>
        </div>

        {approvedForPayment.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No hay solicitudes aprobadas pendientes de dispersión en este momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {approvedForPayment.map((req) => (
              <div
                key={req.id}
                className="p-3.5 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600 text-xs">{req.folio}</span>
                    <span className="font-semibold text-slate-900 text-xs">{req.user?.name || 'Solicitante'}</span>
                    <span className="text-[10px] text-slate-400">({req.user?.department || 'Ventas'})</span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    <strong>Destino:</strong> {req.destination} &bull; <strong>Fechas:</strong>{' '}
                    {new Date(req.startDate).toLocaleDateString('es-MX')} al {new Date(req.endDate).toLocaleDateString('es-MX')}
                  </p>
                  <p className="text-[11px] text-indigo-700 font-semibold">
                    <strong>Fecha requerida de depósito:</strong>{' '}
                    {req.depositDate ? new Date(`${req.depositDate}T00:00:00`).toLocaleDateString('es-MX') : 'No especificada'}
                  </p>

                  <p className="text-[11px] text-slate-500">
                    <strong>Autorizado por:</strong> <span className="font-mono text-indigo-700">{req.bossEmail}</span>
                    {req.comments && <span className="italic ml-2 text-slate-600">"{req.comments}"</span>}
                  </p>
                </div>

                <div className="flex flex-col md:items-end gap-1.5">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Monto a Dispersar</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {formatCurrency(req.amountAuthorized || req.amountRequested)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenPrintVoucher(req)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Póliza</span>
                    </button>
                    <button
                      onClick={() => setSelectedRequestForPayment(req)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold shadow-xs flex items-center gap-1 transition"
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>Registrar SPEI</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Histórico de Solicitudes Pagadas & Finalizadas */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Solicitudes Pagadas y Comprobaciones</h3>
            <p className="text-[11px] text-slate-500">
              Viáticos transferidos a los colaboradores en espera o con cierre de comprobación de gastos.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {paidRequests.length + finalizedRequests.length} Registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#f1f5f9] border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Folio</th>
                <th className="py-2.5 px-3">Beneficiario</th>
                <th className="py-2.5 px-3">Destino</th>
                <th className="py-2.5 px-3">Monto Dispersado</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {[...paidRequests, ...finalizedRequests].map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-indigo-600 text-[11px]">{r.folio}</td>
                  <td className="py-2 px-3 text-slate-900 text-[11px]">{r.user?.name || 'Juan Pérez'}</td>
                  <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-[180px]">{r.destination}</td>
                  <td className="py-2 px-3 font-bold text-slate-900 font-mono text-[11px]">
                    {formatCurrency(r.amountAuthorized || r.amountRequested)}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                        r.status === 'PAGADA'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onOpenPrintVoucher(r)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                      >
                        Póliza
                      </button>
                      {r.status === 'PAGADA' && (
                        <button
                          onClick={() => handleFinalize(r.id, r.folio)}
                          className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold transition"
                        >
                          Cerrar Gasto
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Pago SPEI */}
      {selectedRequestForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] text-white rounded-xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Dispersión Bancaria
                </span>
                <h3 className="text-base font-bold font-mono">Folio: {selectedRequestForPayment.folio}</h3>
              </div>
              <button
                onClick={() => setSelectedRequestForPayment(null)}
                className="text-slate-400 hover:text-white p-1 rounded text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-4 space-y-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Monto a Transferir</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {formatCurrency(
                      selectedRequestForPayment.amountAuthorized || selectedRequestForPayment.amountRequested
                    )}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-300 font-medium">
                  {selectedRequestForPayment.user?.name}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Clave de Rastreo / Folio SPEI / Referencia Bancaria *
                </label>
                <input
                  type="text"
                  required
                  value={speiReference}
                  onChange={(e) => setSpeiReference(e.target.value)}
                  placeholder="Ej. SPEI-8921827419 (BBVA / Santander)"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Notas de Tesorería</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Transferencia aplicada exitosamente a la cuenta de nómina..."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequestForPayment(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-xs transition disabled:opacity-50"
                >
                  {processing ? 'Registrando...' : 'Confirmar Dispersión SPEI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
