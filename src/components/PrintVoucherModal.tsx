import React from 'react';
import { Printer, X, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { TravelRequest } from '../types';

interface PrintVoucherModalProps {
  request: TravelRequest | null;
  onClose: () => void;
}

export default function PrintVoucherModal({ request, onClose }: PrintVoucherModalProps) {
  if (!request) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden print:m-0 print:border-none print:shadow-none animate-in fade-in duration-150">
        {/* Modal Controls (Hidden in Print) */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm">Póliza Oficial de Viáticos &mdash; {request.folio}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Documento</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 space-y-6 text-slate-800 bg-white font-sans">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
                D
              </div>
              <div>
                <h1 className="font-black text-xl text-slate-900 tracking-tight">DIMER CORPORATIVO</h1>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Póliza de Autorización y Comprobación de Viáticos
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-slate-400 uppercase">Folio Único Oficial</div>
              <div className="text-xl font-black text-blue-800 font-mono">{request.folio}</div>
              <div className="text-[11px] text-slate-500 font-medium">
                Fecha Emisión: {new Date(request.createdAt).toLocaleDateString('es-MX')}
              </div>
            </div>
          </div>

          {/* Estado de la Solicitud */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase">Estado Oficial:</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-200 rounded">
                {request.status}
              </span>
            </div>
            <div className="text-slate-500">
              Validación Criptográfica &bull; ID: <span className="font-mono">{request.id}</span>
            </div>
          </div>

          {/* Datos del Beneficiario y Viaje */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-400 uppercase text-[10px] block">1. Solicitante</span>
              <p className="font-bold text-slate-900 text-sm">{request.requesterName || request.user?.name || 'Juan Pérez'}</p>
              <p className="text-slate-600">{request.user?.email || 'N/A'}</p>
              <p className="text-slate-500 font-semibold">{request.department || request.user?.department || 'Departamento General'}</p>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-400 uppercase text-[10px] block">2. Tipo & Urgencia</span>
              <p className="font-bold text-indigo-700">{request.requestType || 'Viáticos y Gastos de Viaje'}</p>
              <p className="text-slate-700">
                Urgencia: <span className="font-bold uppercase text-slate-900">{request.urgency || 'Media'}</span>
              </p>
              <p className="text-slate-500 text-[11px]">
                Fecha: {request.requestDate || new Date(request.createdAt).toLocaleDateString('es-MX')}
              </p>
            </div>

            <div className="space-y-1 sm:col-span-1 col-span-2">
              <span className="font-bold text-slate-400 uppercase text-[10px] block">3. Jefe Inmediato Autorizador</span>
              <p className="font-bold text-slate-900 font-mono text-xs truncate">{request.bossEmail}</p>
              <p className="text-slate-500">Autorización jerárquica con token</p>
            </div>
          </div>

          {/* Itinerario y Destino */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-500 uppercase block">Destino / Ubicación</span>
                <p className="font-bold text-slate-900 text-sm">{request.destination || 'Oficinas Centrales'}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase block">Periodo / Fecha</span>
                <p className="font-medium text-slate-900">
                  {request.startDate ? (
                    <>
                      {new Date(request.startDate).toLocaleDateString('es-MX')} al{' '}
                      {new Date(request.endDate).toLocaleDateString('es-MX')}
                    </>
                  ) : (
                    request.requestDate || 'N/A'
                  )}
                </p>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase block">Descripción / Detalle de lo Solicitado</span>
              <p className="text-slate-800 mt-0.5 leading-relaxed font-sans">{request.detail || request.reason}</p>
            </div>

            {request.comments && (
              <div>
                <span className="font-bold text-slate-500 uppercase block">Observaciones / Desglose</span>
                <p className="text-slate-600 italic mt-0.5">{request.comments}</p>
              </div>
            )}
          </div>

          {/* Cuadro Financiero */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-4">Concepto</th>
                  <th className="py-2.5 px-4 text-right">Monto (MXN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-700">Monto Total Solicitado por el Empleado</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(request.amountRequested)}
                  </td>
                </tr>
                <tr className="bg-emerald-50">
                  <td className="py-3 px-4 font-bold text-emerald-900">
                    Monto Final Autorizado por la Jefatura
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-800 text-base">
                    {formatCurrency(request.amountAuthorized || request.amountRequested)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Firmas de Autorización */}
          <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <p className="font-bold text-slate-900">{request.user?.name || 'Solicitante'}</p>
              <p className="text-[10px] text-slate-500 uppercase">Firma del Solicitante</p>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1">
              <p className="font-bold text-slate-900">{request.bossEmail.split('@')[0]}</p>
              <p className="text-[10px] text-slate-500 uppercase">Firma de Aprobación Jefe</p>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1">
              <p className="font-bold text-slate-900">CP. Finanzas / Tesorería</p>
              <p className="text-[10px] text-slate-500 uppercase">Firma de Dispersión</p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between items-center">
            <span>Sistema Automatizado de Gestión de Viáticos &copy; 2026</span>
            <span>Documento Oficial con Validez Interna</span>
          </div>
        </div>
      </div>
    </div>
  );
}
