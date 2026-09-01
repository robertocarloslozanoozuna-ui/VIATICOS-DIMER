import React from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  TrendingUp,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react';
import type { TravelRequest } from '../types';

interface FinanzasDashboardProps {
  requests: TravelRequest[];
}

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value || 0);

const amountOf = (request: TravelRequest) => Number(request.amountAuthorized ?? request.amountRequested ?? 0);

const monthKey = (date: string) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
};

function RankedBars({
  items,
  valueFormatter = money,
}: {
  items: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">Sin datos suficientes para mostrar.</div>
      ) : (
        items.map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-[11px] mb-1">
              <span className="font-semibold text-slate-700 truncate" title={item.label}>{item.label}</span>
              <span className="font-mono font-bold text-slate-900 shrink-0">{valueFormatter(item.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function FinanzasDashboard({ requests }: FinanzasDashboardProps) {
  const safeRequests = Array.isArray(requests) ? requests : [];
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthRequests = safeRequests.filter((request) => monthKey(request.createdAt) === currentMonthKey);

  const requestedThisMonth = currentMonthRequests.reduce((sum, request) => sum + Number(request.amountRequested || 0), 0);
  const authorizedThisMonth = currentMonthRequests
    .filter((request) => ['APROBADA', 'PAGADA', 'FINALIZADA'].includes(request.status))
    .reduce((sum, request) => sum + amountOf(request), 0);
  const pendingPayment = safeRequests
    .filter((request) => request.status === 'APROBADA')
    .reduce((sum, request) => sum + amountOf(request), 0);
  const rejectedThisMonth = currentMonthRequests
    .filter((request) => request.status === 'RECHAZADA')
    .reduce((sum, request) => sum + Number(request.amountRequested || 0), 0);

  const departmentMap = new Map<string, number>();
  const employeeMap = new Map<string, number>();
  const destinationMap = new Map<string, number>();

  safeRequests.forEach((request) => {
    const department = request.department || request.user?.department || 'Sin departamento';
    const employee = request.requesterName || request.user?.name || 'Solicitante';
    const destination = request.destination || 'Sin destino';
    const amount = amountOf(request);
    departmentMap.set(department, (departmentMap.get(department) || 0) + amount);
    employeeMap.set(employee, (employeeMap.get(employee) || 0) + amount);
    destinationMap.set(destination, (destinationMap.get(destination) || 0) + amount);
  });

  const rank = (map: Map<string, number>, limit = 6) =>
    [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

  const departmentData = rank(departmentMap);
  const employeeData = rank(employeeMap);
  const destinationData = rank(destinationMap);

  const monthlyData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthRequests = safeRequests.filter((request) => monthKey(request.createdAt) === key);
    return {
      key,
      label: monthLabel(key),
      value: monthRequests.reduce((sum, request) => sum + Number(request.amountRequested || 0), 0),
    };
  });
  const maxMonth = Math.max(...monthlyData.map((item) => item.value), 1);

  const cards = [
    {
      title: 'Total solicitado este mes',
      value: money(requestedThisMonth),
      detail: `${currentMonthRequests.length} solicitud(es) registradas`,
      icon: CircleDollarSign,
      tone: 'indigo',
    },
    {
      title: 'Total autorizado',
      value: money(authorizedThisMonth),
      detail: 'Autorizado, pagado o finalizado este mes',
      icon: CheckCircle2,
      tone: 'emerald',
    },
    {
      title: 'Pendiente de pago',
      value: money(pendingPayment),
      detail: `${safeRequests.filter((request) => request.status === 'APROBADA').length} solicitud(es) listas para SPEI`,
      icon: WalletCards,
      tone: 'amber',
    },
    {
      title: 'Rechazado este mes',
      value: money(rejectedThisMonth),
      detail: `${currentMonthRequests.filter((request) => request.status === 'RECHAZADA').length} solicitud(es) rechazadas`,
      icon: XCircle,
      tone: 'rose',
    },
  ];

  const toneClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 sm:p-6 text-white shadow-lg border border-slate-800">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <TrendingUp className="w-3.5 h-3.5" /> Control financiero
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-black tracking-tight">CONTROL DE VIÁTICOS</h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-300">
              Visión ejecutiva del gasto de viajes, autorizaciones, pagos y principales centros de consumo.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <CalendarDays className="w-4 h-4 text-indigo-300" />
            <span>Periodo actual: <strong className="text-white">{now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</strong></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">{card.title}</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900 truncate" title={card.value}>{card.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${toneClasses[card.tone]}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400 truncate" title={card.detail}>{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><BuildingIcon /></div>
            <div><h2 className="text-sm font-bold text-slate-900">Viáticos por departamento</h2><p className="text-[10px] text-slate-400">Monto acumulado de solicitudes</p></div>
          </div>
          <RankedBars items={departmentData} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><UserRound className="w-4 h-4" /></div>
            <div><h2 className="text-sm font-bold text-slate-900">Viáticos por empleado</h2><p className="text-[10px] text-slate-400">Principales beneficiarios por monto</p></div>
          </div>
          <RankedBars items={employeeData} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><BarChart3 className="w-4 h-4" /></div>
            <div><h2 className="text-sm font-bold text-slate-900">Viáticos por mes</h2><p className="text-[10px] text-slate-400">Solicitado durante los últimos 6 meses</p></div>
          </div>
          <div className="h-48 flex items-end gap-2 sm:gap-4 border-b border-slate-100 px-1 pt-4">
            {monthlyData.map((item) => (
              <div key={item.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5">
                <span className="text-[9px] font-mono text-slate-500 truncate max-w-full" title={money(item.value)}>{money(item.value)}</span>
                <div className="w-full max-w-12 h-32 flex items-end rounded-t-md bg-slate-50 overflow-hidden">
                  <div className="w-full rounded-t-md bg-indigo-500 transition-all duration-500" style={{ height: `${item.value > 0 ? Math.max((item.value / maxMonth) * 100, 4) : 0}%` }} />
                </div>
                <span className="text-[9px] font-bold text-slate-500 capitalize">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><MapPin className="w-4 h-4" /></div>
            <div><h2 className="text-sm font-bold text-slate-900">Principales destinos</h2><p className="text-[10px] text-slate-400">Destinos con mayor gasto acumulado</p></div>
          </div>
          <RankedBars items={destinationData} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">Solicitudes totales</p><p className="text-2xl font-black text-slate-900 mt-1">{safeRequests.length}</p><p className="text-[10px] text-slate-400 mt-1">En el histórico disponible</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">Pagado / dispersado</p><p className="text-2xl font-black text-slate-900 mt-1">{money(safeRequests.filter((r) => r.status === 'PAGADA' || r.status === 'FINALIZADA').reduce((s, r) => s + amountOf(r), 0))}</p><p className="text-[10px] text-slate-400 mt-1">Incluye expedientes finalizados</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">Solicitudes pendientes</p><p className="text-2xl font-black text-slate-900 mt-1">{safeRequests.filter((r) => r.status === 'PENDIENTE_APROBACION').length}</p><p className="text-[10px] text-slate-400 mt-1">En espera de autorización</p></div>
      </div>
    </section>
  );
}

function BuildingIcon() {
  return <BriefcaseBusiness className="w-4 h-4" />;
}
