import React from 'react';
import { Printer, X, Banknote, CheckCircle2 } from 'lucide-react';

interface RefundReceiptModalProps {
  folio: string;
  employeeName: string;
  department?: string;
  destination?: string;
  amount: number;
  refundDate: string;
  method: 'SPEI' | 'EFECTIVO';
  reference?: string;
  onClose: () => void;
}

export default function RefundReceiptModal({
  folio,
  employeeName,
  department,
  destination,
  amount,
  refundDate,
  method,
  reference,
  onClose,
}: RefundReceiptModalProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-6">
        <div className="bg-slate-900 text-white rounded-t-xl p-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-300" />
            <div>
              <p className="text-xs font-black">Recibo de Reembolso</p>
              <p className="text-[10px] text-slate-300 font-mono">{folio}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handlePrint} className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button type="button" onClick={onClose} className="p-1.5 text-slate-300 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white shadow-2xl print:shadow-none print:rounded-none rounded-b-xl p-6 text-slate-900">
          <div className="text-center border-b-2 border-slate-900 pb-4">
            <div className="mx-auto w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-lg">D</div>
            <h1 className="mt-2 text-base font-black uppercase">DIMER CORPORATIVO</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recibo de Reembolso de Viáticos</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="block text-[9px] font-bold uppercase text-slate-400">Folio</span>
              <span className="font-mono font-black">{folio}</span>
            </div>
            <div className="text-right">
              <span className="block text-[9px] font-bold uppercase text-slate-400">Fecha</span>
              <span className="font-semibold">{refundDate || new Date().toLocaleDateString('es-MX')}</span>
            </div>
            <div>
              <span className="block text-[9px] font-bold uppercase text-slate-400">Empleado</span>
              <span className="font-bold">{employeeName || 'N/D'}</span>
            </div>
            <div className="text-right">
              <span className="block text-[9px] font-bold uppercase text-slate-400">Departamento</span>
              <span className="font-semibold">{department || 'N/D'}</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4 text-center">
            <p className="text-[10px] font-bold uppercase text-slate-500">Monto recibido por DIMER</p>
            <p className="mt-1 text-2xl font-black font-mono">{formatCurrency(amount || 0)}</p>
            <p className="mt-1 text-[10px] text-slate-500">Por concepto de devolución de sobrante de viáticos.</p>
          </div>

          <div className="mt-4 space-y-2 text-[11px]">
            <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
              <span className="text-slate-500">Forma de entrega</span>
              <span className="font-bold">{method === 'SPEI' ? 'Transferencia SPEI' : 'Efectivo / Caja'}</span>
            </div>
            {destination && (
              <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
                <span className="text-slate-500">Destino / Comisión</span>
                <span className="font-semibold text-right">{destination}</span>
              </div>
            )}
            {reference && (
              <div className="flex justify-between gap-3 border-b border-slate-200 pb-1.5">
                <span className="text-slate-500">Referencia</span>
                <span className="font-mono font-bold text-right">{reference}</span>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 border border-slate-300 rounded-lg text-[10px] leading-relaxed">
            Declaro que entregué/reintegré a DIMER el importe señalado en este recibo correspondiente al sobrante del anticipo de viáticos del folio indicado.
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 text-center text-[10px]">
            <div className="pt-8 border-t border-slate-500">
              <p className="font-bold">{employeeName || 'Empleado'}</p>
              <p className="uppercase text-slate-500 mt-0.5">Firma de quien entrega</p>
            </div>
            <div className="pt-8 border-t border-slate-500">
              <p className="font-bold">Finanzas / Tesorería</p>
              <p className="uppercase text-slate-500 mt-0.5">Firma de quien recibe</p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400">
            <span><CheckCircle2 className="inline w-3 h-3 mr-1" />Documento interno DIMER</span>
            <span>Folio {folio}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
