import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
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

const excelXmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const crc32 = (input: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (value: number) => {
  const a = new Uint8Array(2);
  new DataView(a.buffer).setUint16(0, value, true);
  return a;
};

const u32 = (value: number) => {
  const a = new Uint8Array(4);
  new DataView(a.buffer).setUint32(0, value >>> 0, true);
  return a;
};

const concatBytes = (...parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
};

const zipStore = (files: Array<{ name: string; data: Uint8Array }>) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const localHeader = concatBytes(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), nameBytes,
    );
    localParts.push(localHeader, data);

    const centralHeader = concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    );
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes(...centralParts);
  const localDirectory = concatBytes(...localParts);
  const end = concatBytes(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralDirectory.length), u32(localDirectory.length), u16(0),
  );
  return concatBytes(localDirectory, centralDirectory, end);
};

const createXlsxBlob = (rows: Array<Array<string | number>>) => {
  const encoder = new TextEncoder();
  const columnName = (index: number) => {
    let n = index + 1;
    let result = '';
    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };

  const cells = rows.map((row, rowIndex) => {
    const cellsXml = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      const isNumber = typeof value === 'number' && Number.isFinite(value);
      const style = rowIndex === 0 ? '1' : (colIndex === 6 || colIndex === 7 ? '2' : '0');
      if (isNumber) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${excelXmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
  }).join('');

  const lastColumn = columnName((rows[0]?.length || 1) - 1);
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${rows.length || 1}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${cells}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length || 1}"/><sheetFormatPr defaultRowHeight="15"/></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Solicitudes" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="E2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const bytes = zipStore([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
    { name: 'xl/styles.xml', data: encoder.encode(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(worksheet) },
  ]);
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX');
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

  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportStatus, setReportStatus] = useState('TODOS');
  const [reportDepartment, setReportDepartment] = useState('TODOS');
  const [reportRequester, setReportRequester] = useState('TODOS');

  const departments = useMemo(() => Array.from(new Set(safeRequests.map((r) => r.department || r.user?.department || 'Sin departamento'))).sort(), [safeRequests]);
  const requesters = useMemo(() => Array.from(new Set(safeRequests.map((r) => r.requesterName || r.user?.name || 'Colaborador'))).sort(), [safeRequests]);

  const reportRequests = useMemo(() => safeRequests.filter((request) => {
    const requestDate = new Date(request.requestDate || request.createdAt);
    const requestDateOnly = Number.isNaN(requestDate.getTime()) ? '' : requestDate.toISOString().slice(0, 10);
    const requester = request.requesterName || request.user?.name || 'Colaborador';
    const department = request.department || request.user?.department || 'Sin departamento';
    const matchesStart = !reportStartDate || requestDateOnly >= reportStartDate;
    const matchesEnd = !reportEndDate || requestDateOnly <= reportEndDate;
    const matchesStatus = reportStatus === 'TODOS' || request.status === reportStatus;
    const matchesDepartment = reportDepartment === 'TODOS' || department === reportDepartment;
    const matchesRequester = reportRequester === 'TODOS' || requester === reportRequester;
    return matchesStart && matchesEnd && matchesStatus && matchesDepartment && matchesRequester;
  }), [safeRequests, reportStartDate, reportEndDate, reportStatus, reportDepartment, reportRequester]);

  const downloadReport = () => {
    const rows: Array<Array<string | number>> = [
      ['Folio', 'Solicitante', 'Departamento', 'Fecha de solicitud', 'Fecha de salida', 'Fecha de regreso', 'Monto solicitado', 'Monto autorizado', 'Estado'],
      ...reportRequests.map((request) => [
        request.folio,
        request.requesterName || request.user?.name || 'Colaborador',
        request.department || request.user?.department || 'Sin departamento',
        formatDate(request.requestDate || request.createdAt),
        formatDate(request.startDate),
        formatDate(request.endDate),
        Number(request.amountRequested || 0),
        Number(request.amountAuthorized ?? request.amountRequested ?? 0),
        request.status,
      ]),
    ];
    const blob = createXlsxBlob(rows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-viaticos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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
      value: monthRequests.reduce((sum, request) => sum + amountOf(request), 0),
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
      detail: `${safeRequests.filter((request) => request.status === 'APROBADA').length} solicitud(es) listas para pago`,
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

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileSpreadsheet className="w-4 h-4" /></div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Reporte de solicitudes</h2>
                <p className="text-[10px] text-slate-400">Filtra las solicitudes y descarga el reporte para Finanzas.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadReport}
            disabled={reportRequests.length === 0}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            DESCARGAR REPORTE EXCEL
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-slate-100">
          <label className="text-[10px] font-bold text-slate-500">Fecha de solicitud desde
            <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </label>
          <label className="text-[10px] font-bold text-slate-500">Fecha de solicitud hasta
            <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </label>
          <label className="text-[10px] font-bold text-slate-500">Estado
            <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE_APROBACION">Pendiente de aprobación</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="PAGADA">Pagada</option>
              <option value="COMPROBADA">Comprobada</option>
              <option value="FINALIZADA">Finalizada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500">Departamento
            <select value={reportDepartment} onChange={(e) => setReportDepartment(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="TODOS">Todos</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500">Solicitante
            <select value={reportRequester} onChange={(e) => setReportRequester(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="TODOS">Todos</option>
              {requesters.map((requester) => <option key={requester} value={requester}>{requester}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span><strong className="text-slate-800">{reportRequests.length}</strong> solicitud(es) coinciden con los filtros.</span>
          <span>Monto solicitado: <strong className="text-slate-800">{money(reportRequests.reduce((sum, request) => sum + Number(request.amountRequested || 0), 0))}</strong></span>
          <span>Monto autorizado: <strong className="text-slate-800">{money(reportRequests.reduce((sum, request) => sum + amountOf(request), 0))}</strong></span>
        </div>
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
            <div><h2 className="text-sm font-bold text-slate-900">Viáticos por mes</h2><p className="text-[10px] text-slate-400">Monto autorizado durante los últimos 6 meses</p></div>
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
