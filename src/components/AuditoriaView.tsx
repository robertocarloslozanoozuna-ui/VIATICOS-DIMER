import React, { useState, useEffect } from 'react';
import {
  History,
  Shield,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  CreditCard,
  FilePlus,
  RefreshCw,
  Clock,
  Code
} from 'lucide-react';
import type { AuditLog } from '../types';

export default function AuditoriaView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [selectedLogDetails, setSelectedLogDetails] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      const data: AuditLog[] = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      log.action.toLowerCase().includes(searchLower) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(searchLower)) ||
      (log.userName && log.userName.toLowerCase().includes(searchLower)) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(searchLower);

    return matchesAction && matchesSearch;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREACION_SOLICITUD':
        return { label: 'Creación de Solicitud', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: FilePlus };
      case 'APROBACION_JEFE':
        return { label: 'Aprobación de Jefe', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle };
      case 'RECHAZO_JEFE':
        return { label: 'Rechazo de Jefe', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: XCircle };
      case 'SOLICITUD_CORRECCION':
        return { label: 'Corrección Solicitada', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock };
      case 'DISPERSION_PAGO':
        return { label: 'Dispersión de Pago (SPEI)', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: CreditCard };
      case 'VISUALIZACION_SOLICITUD':
        return { label: 'Apertura / Visualización', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Eye };
      default:
        return { label: action, color: 'bg-slate-100 text-slate-800 border-slate-300', icon: Shield };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#0f172a] text-white rounded-xl p-4 shadow-xs border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
              TABLA AuditLog
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Trazabilidad Empresarial Inmutable</span>
          </div>
          <h1 className="text-base font-bold text-white mt-1">Bitácora de Auditoría en Tiempo Real</h1>
          <p className="text-xs text-slate-400">
            Registro automático de todas las operaciones (creaciones, aperturas, autorizaciones, rechazos y dispersiones).
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Bitácora</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-3 flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario, folio, acción..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto scrollbar-none pb-0.5 md:pb-0">
          {[
            { id: 'ALL', label: 'Todas' },
            { id: 'CREACION_SOLICITUD', label: 'Creación' },
            { id: 'APROBACION_JEFE', label: 'Aprobación' },
            { id: 'DISPERSION_PAGO', label: 'Pagos' },
            { id: 'VISUALIZACION_SOLICITUD', label: 'Aperturas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterAction(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
                filterAction === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Cargando registros de auditoría...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No hay registros de auditoría que coincidan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#f1f5f9] border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Acción Realizada</th>
                  <th className="py-2.5 px-3">Usuario / Correo</th>
                  <th className="py-2.5 px-3">Detalles JSON</th>
                  <th className="py-2.5 px-3 text-right">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      {/* Timestamp */}
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(log.createdAt).toLocaleString('es-MX')}
                      </td>

                      {/* Action */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border text-[10px] ${badge.color}`}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* User */}
                      <td className="py-2 px-3 font-sans whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs">{log.userName || 'Usuario'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.userEmail}</div>
                      </td>

                      {/* Details preview */}
                      <td className="py-2 px-3 text-slate-600 text-[10px] max-w-xs truncate font-mono">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>

                      {/* Action button */}
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => setSelectedLogDetails(log)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-sans font-semibold inline-flex items-center gap-1"
                        >
                          <Code className="w-3 h-3" />
                          <span>JSON</span>
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

      {/* JSON Viewer Modal */}
      {selectedLogDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] text-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider">
                  AUDIT_LOG_RECORD
                </span>
                <h3 className="text-sm font-bold font-mono">{selectedLogDetails.action}</h3>
              </div>
              <button
                onClick={() => setSelectedLogDetails(null)}
                className="text-slate-400 hover:text-white p-1 rounded text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">ID del Registro:</span>
                <span className="text-slate-200 text-[10px]">{selectedLogDetails.id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200 text-[10px]">{selectedLogDetails.createdAt}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Usuario:</span>
                <span className="text-slate-200 text-[10px]">
                  {selectedLogDetails.userEmail} ({selectedLogDetails.userName})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Payload de Detalles (JSON):</span>
                <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto text-emerald-400 text-[10px]">
                  {JSON.stringify(selectedLogDetails.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLogDetails(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold font-sans"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}