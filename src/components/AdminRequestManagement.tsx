import React, { useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Trash2, X } from 'lucide-react';
import type { TravelRequest } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

interface Props {
  requests: TravelRequest[];
  onRefreshData: () => void;
}

const deletableStatuses = new Set(['BORRADOR', 'PENDIENTE', 'PENDIENTE_APROBACION', 'RECHAZADA', 'CORRECCION_SOLICITADA']);

export default function AdminRequestManagement({ requests, onRefreshData }: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TravelRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('El viaje no se realizará');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const safeRequests = Array.isArray(requests) ? requests : [];

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4500);
  };

  const handleDelete = async (request: TravelRequest) => {
    if (!deletableStatuses.has(request.status)) return;
    if (!window.confirm(`¿Eliminar definitivamente la solicitud ${request.folio}?\n\nEstado actual: ${request.status}. Esta acción no se puede deshacer.`)) return;
    setProcessingId(request.id);
    try {
      await safeFetchJson(`/api/requests/${request.id}`, { method: 'DELETE' });
      notify('success', `La solicitud ${request.folio} fue eliminada correctamente.`);
      onRefreshData();
    } catch (error: any) {
      notify('error', error.message || 'Error eliminando la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setProcessingId(cancelTarget.id);
    try {
      await safeFetchJson(`/api/requests/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() || 'El viaje no se realizará' }),
      });
      notify('success', `La solicitud ${cancelTarget.folio} quedó CANCELADA.`);
      setCancelTarget(null);
      setCancelReason('El viaje no se realizará');
      onRefreshData();
    } catch (error: any) {
      notify('error', error.message || 'Error cancelando la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldIcon /><h2 className="text-sm font-black">Control administrativo de solicitudes</h2></div>
          <p className="text-[10px] text-slate-400 mt-1">Eliminar solicitudes no aprobadas o cancelar una aprobación cuando el viaje no se realizará.</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/20">ADMINISTRADOR</span>
      </div>

      {message && (
        <div className={`m-3 p-2.5 rounded-lg border text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="font-semibold">{message.text}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 border-y border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black">
            <tr><th className="px-3 py-2.5">Folio</th><th className="px-3 py-2.5">Solicitante</th><th className="px-3 py-2.5">Destino</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5 text-right">Acción administrativa</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {safeRequests.map((request) => {
              const canDelete = deletableStatuses.has(request.status);
              const canCancel = request.status === 'APROBADA';
              if (!canDelete && !canCancel) return null;
              const busy = processingId === request.id;
              return (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono font-bold text-indigo-600 whitespace-nowrap">{request.folio}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><div className="font-semibold text-slate-900">{request.requesterName || request.user?.name || 'Solicitante'}</div><div className="text-[10px] text-slate-400">{request.department || request.user?.department || 'Sin departamento'}</div></td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[220px] truncate">{request.destination || 'Sin destino'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${request.status === 'APROBADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{request.status}</span></td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {canDelete && <button disabled={busy} onClick={() => handleDelete(request)} className="inline-flex items-center gap-1 px-2.5 py-1.5 mr-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold disabled:opacity-50"><Trash2 className="w-3 h-3" />Eliminar</button>}
                    {canCancel && <button disabled={busy} onClick={() => setCancelTarget(request)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold disabled:opacity-50"><Ban className="w-3 h-3" />Cancelar viaje</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {safeRequests.every((request) => !deletableStatuses.has(request.status) && request.status !== 'APROBADA') && (
        <div className="p-8 text-center text-xs text-slate-400">No hay solicitudes disponibles para acciones administrativas.</div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-[400] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between"><div><p className="text-[10px] uppercase font-black text-amber-600">Cancelación administrativa</p><h3 className="text-base font-black text-slate-900">{cancelTarget.folio}</h3></div><button onClick={() => setCancelTarget(null)} className="p-1.5 rounded-md hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button></div>
            <div className="p-4 space-y-3"><div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">La solicitud está <strong>APROBADA</strong>. Al cancelarla ya no podrá pasar a pago.</div><label className="block text-xs font-bold text-slate-700">Motivo de cancelación<textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label></div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2"><button onClick={() => setCancelTarget(null)} className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-200">No cancelar</button><button disabled={processingId === cancelTarget.id} onClick={handleCancel} className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50">Confirmar cancelación</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function ShieldIcon() { return <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center"><ShieldMark /></div>; }
function ShieldMark() { return <span className="text-xs font-black">A</span>; }
