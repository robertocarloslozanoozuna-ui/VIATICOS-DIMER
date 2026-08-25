import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Printer,
  ExternalLink,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  DollarSign,
  Building,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
import type { TravelRequest, User } from '../types';

interface MisSolicitudesViewProps {
  currentUser: User | null;
  requests: TravelRequest[];
  onNavigateToCreate: () => void;
  onNavigateToApprove: (requestId: string) => void;
  onOpenPrintVoucher: (request: TravelRequest) => void;
}

export default function MisSolicitudesView({
  currentUser,
  requests,
  onNavigateToCreate,
  onNavigateToApprove,
  onOpenPrintVoucher,
}: MisSolicitudesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<TravelRequest | null>(null);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusFilter === 'TODAS' || r.status === statusFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        r.folio.toLowerCase().includes(searchLower) ||
        r.destination.toLowerCase().includes(searchLower) ||
        r.reason.toLowerCase().includes(searchLower) ||
        r.bossEmail.toLowerCase().includes(searchLower) ||
        (r.user?.name && r.user.name.toLowerCase().includes(searchLower));

      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, searchTerm]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  // KPIs
  const totalCount = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'PENDIENTE_APROBACION').length;
  const approvedCount = requests.filter((r) => r.status === 'APROBADA' || r.status === 'PAGADA').length;
  const totalRequestedAmount = requests.reduce((acc, r) => acc + (r.amountRequested || 0), 0);
  const totalAuthorizedAmount = requests.reduce((acc, r) => acc + (r.amountAuthorized || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE_APROBACION':
        return {
          label: 'Pendiente Jefe',
          classes: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: Clock,
        };
      case 'APROBADA':
        return {
          label: 'Aprobada (A Finanzas)',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
        };
      case 'PAGADA':
        return {
          label: 'Dispersada / Pagada',
          classes: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: DollarSign,
        };
      case 'FINALIZADA':
        return {
          label: 'Finalizada',
          classes: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: CheckCircle2,
        };
      case 'RECHAZADA':
        return {
          label: 'Rechazada',
          classes: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: XCircle,
        };
      case 'CORRECCION_SOLICITADA':
        return {
          label: 'Corrección',
          classes: 'bg-orange-100 text-orange-800 border-orange-300',
          icon: AlertCircle,
        };
      default:
        return {
          label: status,
          classes: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: Clock,
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* High Density KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Solicitudes</span>
            <Layers className="w-3 h-3 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 leading-none">{totalCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            {formatCurrency(totalRequestedAmount)} solicitado
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Pendientes Jefe</span>
            <Clock className="w-3 h-3 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 leading-none">{pendingCount}</div>
          <div className="text-[10px] text-amber-700 mt-1">Requieren dictamen</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Autorizadas / Pagadas</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 leading-none">{approvedCount}</div>
          <div className="text-[10px] text-emerald-700 mt-1">
            {formatCurrency(totalAuthorizedAmount)} autorizado
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Tasa de Aprobación</span>
            <TrendingUp className="w-3 h-3 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 leading-none">
            {totalCount > 0 ? `${Math.round((approvedCount / totalCount) * 100)}%` : '100%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Auditoría activa</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-3 flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por folio, solicitante, destino..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        {/* Status Filters (High density chips) */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto scrollbar-none pb-0.5">
          {['TODAS', 'PENDIENTE_APROBACION', 'APROBADA', 'PAGADA', 'RECHAZADA'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {st === 'TODAS' ? 'Todas' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Requests High Density Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-slate-700 font-bold text-xs">No se encontraron solicitudes</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">Prueba cambiando los filtros o registra una nueva solicitud.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#f1f5f9] border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Solicitante</th>
                  <th className="py-2.5 px-3">Destino y Período</th>
                  <th className="py-2.5 px-3">Jefe Directo</th>
                  <th className="py-2.5 px-3">Monto Solicitado</th>
                  <th className="py-2.5 px-3">Monto Autorizado</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredRequests.map((r) => {
                  const badge = getStatusBadge(r.status);
                  const BadgeIcon = badge.icon;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      {/* Folio */}
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 text-[11px] whitespace-nowrap">
                        {r.folio}
                      </td>

                      {/* Solicitante */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-[11px]">
                          {r.requesterName || r.user?.name || 'Juan Pérez'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {r.department || r.user?.department || 'Comercial'} • <span className="font-medium text-indigo-600">{r.requestType || 'Viáticos'}</span>
                        </div>
                      </td>

                      {/* Destination & Dates */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 text-[11px] flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{r.destination}</span>
                          {r.urgency && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              r.urgency === 'alta' ? 'bg-rose-100 text-rose-800' :
                              r.urgency === 'baja' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {r.urgency}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {r.requestDate || new Date(r.startDate).toLocaleDateString('es-MX')}
                          </span>
                        </div>
                      </td>

                      {/* Boss Email */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono whitespace-nowrap">
                        {r.bossEmail}
                      </td>

                      {/* Amount Requested */}
                      <td className="py-2.5 px-3 font-bold text-slate-800 text-[11px] whitespace-nowrap">
                        {formatCurrency(r.amountRequested)}
                      </td>

                      {/* Amount Authorized */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.amountAuthorized ? (
                          <span className="font-bold text-emerald-700 text-[11px]">
                            {formatCurrency(r.amountAuthorized)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Pendiente</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.classes}`}
                        >
                          <BadgeIcon className="w-2.5 h-2.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedDetailRequest(r)}
                            title="Inspeccionar Detalle"
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenPrintVoucher(r)}
                            title="Imprimir Póliza Oficial"
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {r.status === 'PENDIENTE_APROBACION' && (
                            <button
                              onClick={() => onNavigateToApprove(r.id)}
                              title="Gestionar en Aprobaciones"
                              className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
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

      {/* Modal / Inspection Card (High Density dark slate aesthetic) */}
      {selectedDetailRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] text-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider uppercase">
                  Inspección de Registro
                </span>
                <h3 className="text-lg font-black">{selectedDetailRequest.folio}</h3>
              </div>
              <button
                onClick={() => setSelectedDetailRequest(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">1. Solicitante</span>
                  <p className="font-semibold text-slate-200">
                    {selectedDetailRequest.requesterName || selectedDetailRequest.user?.name || 'Juan Pérez'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">2. Área / Departamento</span>
                  <p className="text-slate-200 font-medium">
                    {selectedDetailRequest.department || selectedDetailRequest.user?.department || 'DIMER'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">3. Tipo de Solicitud</span>
                  <p className="text-indigo-300 font-semibold">{selectedDetailRequest.requestType || 'Viáticos'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">4. Urgencia</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5 ${
                    selectedDetailRequest.urgency === 'alta' ? 'bg-rose-900/60 text-rose-300 border border-rose-700' :
                    selectedDetailRequest.urgency === 'baja' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                    'bg-amber-900/60 text-amber-300 border border-amber-700'
                  }`}>
                    {selectedDetailRequest.urgency?.toUpperCase() || 'MEDIA'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">5. Fecha Solicitud</span>
                  <p className="text-slate-300 text-[11px]">
                    {selectedDetailRequest.requestDate || new Date(selectedDetailRequest.createdAt).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Jefe Notificado</span>
                  <p className="font-mono text-indigo-300 text-[11px] truncate">{selectedDetailRequest.bossEmail}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">6. Descripción / Detalle</span>
                <p className="bg-slate-900/60 p-2.5 rounded-md border border-slate-800 text-slate-300 text-xs leading-relaxed">
                  {selectedDetailRequest.detail || selectedDetailRequest.reason}
                </p>
              </div>

              {selectedDetailRequest.comments && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Comentarios / Desglose</span>
                  <p className="bg-slate-900/60 p-2.5 rounded-md border border-slate-800 text-slate-300 text-[11px] whitespace-pre-line">
                    {selectedDetailRequest.comments}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monto Solicitado</span>
                  <p className="text-base font-bold text-slate-200">{formatCurrency(selectedDetailRequest.amountRequested)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Monto Autorizado</span>
                  <p className="text-base font-bold text-emerald-400">
                    {selectedDetailRequest.amountAuthorized
                      ? formatCurrency(selectedDetailRequest.amountAuthorized)
                      : 'Pendiente'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setSelectedDetailRequest(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  const req = selectedDetailRequest;
                  setSelectedDetailRequest(null);
                  onOpenPrintVoucher(req);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Póliza Oficial</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

