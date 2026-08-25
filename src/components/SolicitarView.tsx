import React, { useState, useEffect } from 'react';
import {
  Send,
  Calendar,
  MapPin,
  DollarSign,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Calculator,
  ShieldCheck,
  Building,
  ArrowRight,
  UserCheck,
  Clock,
  Layers,
  Flame,
  Check,
  Copy,
  Code,
  LogOut,
} from 'lucide-react';
import EmailAutocompleteInput from './EmailAutocompleteInput';
import { safeFetchJson } from '../utils/apiHelper';
import type { CompanyEmployee } from '../data/companyDirectory';
import type { User, TravelRequest, Boss, Department } from '../types';

interface SolicitarViewProps {
  currentUser: User | null;
  onRequestCreated: (newRequest: TravelRequest) => void;
  onNavigateToApprovals: (requestId: string) => void;
  onLogout?: () => void;
}

export default function SolicitarView({
  currentUser,
  onRequestCreated,
  onNavigateToApprovals,
  onLogout,
}: SolicitarViewProps) {
  // Catalogs
  const [bosses, setBosses] = useState<Boss[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // 1. Nombre del solicitante
  const [requesterName, setRequesterName] = useState(currentUser?.name || '');

  // 2. Área o departamento
  const [department, setDepartment] = useState(currentUser?.department || 'Ventas');

  // 3. Tipo de solicitud
  const requestTypes = [
    'Viáticos y Gastos de Viaje',
    'Equipo de Cómputo / Hardware',
    'Licencias de Software y Sistemas',
    'Servicios Externos y Consultoría',
    'Insumos, Papelería y Oficina',
    'Transporte, Combustible y Logística',
    'Mantenimiento e Instalaciones',
    'Capacitación y Cursos',
    'Otra Solicitud Especial',
  ];
  const [requestType, setRequestType] = useState('Viáticos y Gastos de Viaje');

  // 4. Descripción / detalle de lo solicitado
  const [detail, setDetail] = useState('');

  // 5. Fecha de la solicitud
  const todayStr = new Date().toISOString().split('T')[0];
  const [requestDate, setRequestDate] = useState(todayStr);

  // 6. Urgencia (baja / media / alta)
  const [urgency, setUrgency] = useState<'baja' | 'media' | 'alta'>('media');

  // Boss selection from Catalog
  const [selectedBossId, setSelectedBossId] = useState<string>('boss_003');
  const [bossEmail, setBossEmail] = useState('sistemas@dimer.com.mx');
  const [bossName, setBossName] = useState('Ing. Roberto Flores / Autorizaciones TI');

  // Complementary travel fields (when relevant)
  const [directorySearch, setDirectorySearch] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [destination, setDestination] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const [comments, setComments] = useState('');

  // Breakdown calculator state
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcHotel, setCalcHotel] = useState(6000);
  const [calcTransport, setCalcTransport] = useState(5000);
  const [calcFood, setCalcFood] = useState(3000);
  const [calcMisc, setCalcMisc] = useState(850);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    request: TravelRequest;
    approvalToken?: string;
    mailResult?: any;
    automationJson?: any;
  } | null>(null);

  // Load Bosses & Departments Catalog
  useEffect(() => {
    fetch('/api/bosses')
      .then((res) => res.json())
      .then((data: Boss[]) => {
        const active = data.filter((b) => b.active);
        setBosses(active);
        if (active.length > 0) {
          const first = active[0];
          setSelectedBossId(first.id);
          setBossEmail(first.email);
          setBossName(first.name);
        }
      })
      .catch((err) => console.error('Error cargando jefes:', err));

    fetch('/api/departments')
      .then((res) => res.json())
      .then((data: Department[]) => {
        if (Array.isArray(data)) setDepartments(data.filter((d) => d.active));
      })
      .catch((err) => console.error('Error cargando departamentos:', err));
  }, []);

  // Sync user values if current user updates
  useEffect(() => {
    if (currentUser) {
      if (!requesterName) setRequesterName(currentUser.name);
      if (!department && currentUser.department) setDepartment(currentUser.department);
    }
  }, [currentUser]);

  const handleBossChange = (bossId: string) => {
    setSelectedBossId(bossId);
    const found = bosses.find((b) => b.id === bossId);
    if (found) {
      setBossEmail(found.email);
      setBossName(found.name);
    }
  };

  // Popular destination presets
  const popularDestinations = [
    'Monterrey, N.L. - Planta Industrial',
    'Guadalajara, Jal. - Parque Tecnológico',
    'Querétaro, Qro. - Parque Logístico',
    'Ciudad de México (CDMX) - Corporativo',
    'Toluca, Edo. Méx. - Centro de Distribución',
    'Oficinas Centrales Dimer',
  ];

  // Calculate days
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return -1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const travelDays = calculateDays();

  // Apply breakdown to total
  const applyCalculatorTotal = () => {
    const total = (calcHotel || 0) + (calcTransport || 0) + (calcFood || 0) + (calcMisc || 0);
    setAmountRequested(String(total));
    const breakdownText = `Desglose estimado: Hospedaje ($${calcHotel}), Transporte ($${calcTransport}), Alimentos ($${calcFood}), Imprevistos/Taxis ($${calcMisc}).`;
    setComments((prev) => (prev ? `${prev}\n${breakdownText}` : breakdownText));
    setShowCalculator(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validar Nombre
    if (!requesterName.trim()) {
      setError('Por favor ingrese el Nombre del solicitante.');
      return;
    }
    // 2. Validar Área/Departamento
    if (!department.trim()) {
      setError('Por favor seleccione o ingrese el Área o departamento.');
      return;
    }
    // 3. Validar Tipo de Solicitud
    if (!requestType.trim()) {
      setError('Por favor seleccione el Tipo de solicitud.');
      return;
    }
    // 4. Validar Descripción/Detalle
    if (!detail.trim()) {
      setError('Por favor proporcione la Descripción/detalle de lo solicitado.');
      return;
    }
    // 5. Validar Fecha
    if (!requestDate.trim()) {
      setError('Por favor indique la Fecha de la solicitud.');
      return;
    }
    // 6. Validar Urgencia
    if (!urgency) {
      setError('Por favor seleccione el nivel de Urgencia (baja / media / alta).');
      return;
    }

    if (!bossEmail.trim()) {
      setError('Por favor seleccione el jefe o líder que autoriza.');
      return;
    }

    const isTravelType = requestType.toLowerCase().includes('viático') || requestType.toLowerCase().includes('viaje');
    if (isTravelType && travelDays < 0) {
      setError('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
      return;
    }

    const numAmount = amountRequested ? parseFloat(amountRequested) : 0;
    if (isNaN(numAmount) || numAmount < 0) {
      setError('Por favor ingrese un monto estimado válido.');
      return;
    }

    setLoading(true);

    try {
      const data = await safeFetchJson('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName: requesterName.trim(),
          department: department.trim(),
          requestType: requestType.trim(),
          detail: detail.trim(),
          requestDate: requestDate.trim(),
          urgency,
          bossId: selectedBossId || undefined,
          bossEmail: bossEmail.trim(),
          startDate: isTravelType ? new Date(startDate).toISOString() : new Date(requestDate).toISOString(),
          endDate: isTravelType ? new Date(endDate).toISOString() : new Date(requestDate).toISOString(),
          destination: destination.trim() || (isTravelType ? 'No especificado' : 'Sede Central Dimer'),
          reason: detail.trim(),
          amountRequested: numAmount,
          transportCost: isTravelType ? calcTransport : 0,
          hotelCost: isTravelType ? calcHotel : 0,
          foodCost: isTravelType ? calcFood : 0,
          miscCost: isTravelType ? calcMisc : 0,
          comments: comments.trim(),
        }),
      });

      if (!data.request) {
        throw new Error(data.error || 'Error al procesar la solicitud.');
      }

      // Generate the standard JSON Automation payload for systems@dimer.com.mx
      const automationPayload = {
        estado: 'pendiente_autorizacion',
        correo_autorizacion: 'sistemas@dimer.com.mx',
        asunto: `Nueva solicitud por autorizar - ${requestType.trim()}`,
        cuerpo: `Se ha registrado una nueva solicitud en la plataforma Dimer.\n\n` +
          `• Solicitante: ${requesterName.trim()}\n` +
          `• Área/Departamento: ${department.trim()}\n` +
          `• Tipo de Solicitud: ${requestType.trim()}\n` +
          `• Fecha: ${requestDate.trim()}\n` +
          `• Urgencia: ${urgency.toUpperCase()}\n` +
          `• Detalle de lo solicitado:\n${detail.trim()}\n` +
          (numAmount > 0 ? `• Monto Estimado: $${numAmount.toLocaleString('es-MX')} MXN\n` : '') +
          `• Jefe que Autoriza: ${bossName} (${bossEmail.trim()})\n` +
          `• Folio Oficial: ${data.request.folio}`,
        solicitud: {
          nombre: requesterName.trim(),
          area: department.trim(),
          tipo: requestType.trim(),
          detalle: detail.trim(),
          fecha: requestDate.trim(),
          urgency: urgency,
        }
      };

      setSuccessResult({
        ...data,
        automationJson: automationPayload,
      });
      onRequestCreated(data.request);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (successResult?.automationJson) {
      navigator.clipboard.writeText(JSON.stringify(successResult.automationJson, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Success Modal / Confirmation State */}
      {successResult ? (
        <div className="bg-white rounded-xl shadow-md border border-emerald-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0f172a] p-5 text-white border-b border-emerald-500/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 font-mono">
                  SOLICITUD ESTRUCTURADA Y REGISTRADA
                </span>
                <h2 className="text-xl font-black font-mono">FOLIO: {successResult.request.folio}</h2>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                urgency === 'alta' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                urgency === 'baja' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                Urgencia: {urgency.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Structured 6 Mandatory Fields Summary */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Datos Obligatorios Registrados
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Estado: pendiente_autorizacion</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">1. Nombre del Solicitante:</span>
                  <span className="font-semibold text-slate-900">{successResult.request.requesterName || requesterName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">2. Área o Departamento:</span>
                  <span className="font-semibold text-slate-900">{successResult.request.department || department}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">3. Tipo de Solicitud:</span>
                  <span className="font-semibold text-indigo-700">{successResult.request.requestType || requestType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">4. Fecha de la Solicitud:</span>
                  <span className="font-semibold text-slate-900">{successResult.request.requestDate || requestDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">5. Urgencia:</span>
                  <span className={`inline-block font-bold text-[11px] px-2 py-0.5 rounded capitalize ${
                    urgency === 'alta' ? 'bg-rose-100 text-rose-800' :
                    urgency === 'baja' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {successResult.request.urgency || urgency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Jefe que Autoriza:</span>
                  <span className="font-mono text-indigo-800 font-semibold">{successResult.request.bossEmail}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase mb-1">6. Descripción / Detalle:</span>
                <p className="bg-white p-2.5 rounded border border-slate-200 text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                  {successResult.request.detail || successResult.request.reason || detail}
                </p>
              </div>

              {successResult.request.amountRequested > 0 && (
                <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                  <span className="text-slate-600 font-medium">Monto Total Estimado:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatCurrency(successResult.request.amountRequested)} MXN
                  </span>
                </div>
              )}
            </div>

            {/* Email Dispatch Info */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-1 text-xs text-indigo-950">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Notificación Despachada para Autorización</p>
                  <p className="text-[11px] text-indigo-700">
                    Se envió la solicitud a <strong>{successResult.request.bossEmail}</strong> y se notificó a <strong>sistemas@dimer.com.mx</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSuccessResult(null);
                  setDetail('');
                  setDestination('');
                  setAmountRequested('');
                  setComments('');
                }}
                className="flex-1 py-2 px-3 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 text-xs text-center transition cursor-pointer"
              >
                Crear Otra Solicitud
              </button>
              {currentUser && onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Cerrar sesión al finalizar mi solicitud"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateToApprovals(successResult.request.id)}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Ver Módulo de Autorización</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* High Density Structured Request Form */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-[#0f172a] p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 uppercase font-mono">
                  Dimer Viáticos
                </span>
                <span className="text-[10px] text-slate-400 font-mono">SOLICITUD & AUTORIZACIÓN</span>
              </div>
              <h1 className="text-lg font-bold text-white mt-1">Solicitud de Viáticos</h1>
              <p className="text-xs text-slate-300">
                Complete los 6 datos obligatorios para estructurar la solicitud y despachar el correo de autorización.
              </p>
            </div>

            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div className="text-[10px]">
                    <div className="text-slate-400">Usuario Autenticado</div>
                    <div className="font-bold text-white truncate max-w-[140px]">{currentUser.name}</div>
                  </div>
                </div>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-bold rounded-lg border border-rose-700/60 transition flex items-center gap-1.5 cursor-pointer"
                    title="Cerrar sesión activa"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cerrar Sesión</span>
                    <span className="sm:hidden">Salir</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            {/* SECCIÓN 1: DATOS OBLIGATORIOS PRINCIPALES */}
            <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 uppercase tracking-wide">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  1. Información Obligatoria de la Solicitud
                </span>
                <span className="text-[10px] text-indigo-700 font-medium">Requeridos para Autorización</span>
              </div>

              {/* Helper for directory auto-fill */}
              <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-100 mb-1">
                <EmailAutocompleteInput
                  id="requester-directory-search"
                  label="Buscar Empleado en Directorio Dimer (Opcional para autollenado)"
                  value={directorySearch}
                  onChange={(val, emp) => {
                    setDirectorySearch(val);
                    if (emp) {
                      setRequesterName(emp.name);
                      setDepartment(emp.department);
                    }
                  }}
                  onSelectEmployee={(emp: CompanyEmployee) => {
                    setDirectorySearch(`${emp.name} (${emp.email})`);
                    setRequesterName(emp.name);
                    setDepartment(emp.department);
                  }}
                  placeholder="Escribe nombre o correo para autollenar (ej. Carlos, Brenda, Javier)..."
                  hint="Al escribir o seleccionar un empleado se rellenarán automáticamente su Nombre y Departamento"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Nombre del Solicitante */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    Nombre del Solicitante *
                  </label>
                  <input
                    type="text"
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white font-medium"
                  />
                </div>

                {/* 2. Área o Departamento */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    Área o Departamento *
                  </label>
                  <input
                    type="text"
                    required
                    list="dept-list"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej. Ventas, Sistemas, Operaciones..."
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white font-medium"
                  />
                  <datalist id="dept-list">
                    {departments.map((d) => (
                      <option key={d.id} value={d.name} />
                    ))}
                    <option value="Sistemas" />
                    <option value="Ventas" />
                    <option value="Operaciones" />
                    <option value="Finanzas" />
                    <option value="Recursos Humanos" />
                    <option value="Dirección General" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 3. Tipo de Solicitud */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    Tipo de Solicitud *
                  </label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white font-semibold text-slate-800"
                  >
                    {requestTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Fecha de la Solicitud */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Fecha de la Solicitud *
                  </label>
                  <input
                    type="date"
                    required
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white"
                  />
                </div>
              </div>

              {/* 6. Urgencia (Baja / Media / Alta) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-slate-400" />
                  Urgencia * (Seleccione nivel de prioridad)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgency('baja')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      urgency === 'baja'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Baja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('media')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      urgency === 'media'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Media</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('alta')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      urgency === 'alta'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Alta</span>
                  </button>
                </div>
              </div>

              {/* 4. Descripción / Detalle de lo solicitado */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  Descripción / Detalle de lo Solicitado *
                </label>
                <textarea
                  required
                  rows={3}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Escriba de forma clara y detallada el motivo, especificaciones técnicas, cantidades, justificación de negocio o requerimientos..."
                  className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white leading-relaxed"
                />
              </div>
            </div>

            {/* SECCIÓN 2: AUTORIZACIÓN & JEFE DIRECTO */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Jefe Directo o Aprobador *
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Notificación Directa</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Seleccionar Responsable:</span>
                  <select
                    value={selectedBossId}
                    onChange={(e) => handleBossChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-semibold bg-white"
                  >
                    {bosses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Correo para Notificación:</span>
                  <div className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-slate-100 text-xs font-mono font-medium text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{bossEmail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: DATOS COMPLEMENTARIOS (VIÁTICOS / MONTOS / DESTINO) */}
            <div className="space-y-3 pt-1">
              {/* Fechas de ejecución si es viaje o periodo */}
              {requestType.toLowerCase().includes('viático') || requestType.toLowerCase().includes('viaje') ? (
                <div className="space-y-3 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Fecha de Inicio de Viaje *
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Fecha de Fin de Viaje *
                      </label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white"
                      />
                    </div>
                  </div>

                  {travelDays > 0 ? (
                    <div className="bg-white border border-indigo-200 rounded-md px-3 py-1.5 text-[11px] text-indigo-900 flex items-center justify-between">
                      <span>
                        Duración calculada: <strong>{travelDays} día(s)</strong>
                      </span>
                      <span className="text-indigo-600 font-mono text-[10px]">Tabulador sugerido: $3,500/día</span>
                    </div>
                  ) : null}

                  {/* Destino */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      Destino / Planta / Cliente
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Ej. Monterrey, N.L. - Planta Industrial"
                      className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {popularDestinations.slice(0, 4).map((dest) => (
                        <button
                          key={dest}
                          type="button"
                          onClick={() => setDestination(dest)}
                          className="text-[10px] bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded transition"
                        >
                          + {dest.split(' - ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Monto Solicitado & Calculadora */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-slate-400" />
                    Monto Estimado / Solicitado (MXN)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition"
                  >
                    <Calculator className="w-3 h-3" />
                    {showCalculator ? 'Ocultar Desglose' : 'Calcular con Desglose'}
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1.5 text-slate-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountRequested}
                    onChange={(e) => setAmountRequested(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm font-bold text-slate-900 bg-white"
                  />
                </div>

                {/* Interactive Breakdown Calculator */}
                {showCalculator && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 animate-in fade-in duration-150">
                    <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Estimador por Conceptos
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-600 block mb-0.5">🏨 Hospedaje</span>
                        <input
                          type="number"
                          value={calcHotel}
                          onChange={(e) => setCalcHotel(Number(e.target.value))}
                          className="w-full p-1 text-[11px] border rounded bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-600 block mb-0.5">✈️ Transporte</span>
                        <input
                          type="number"
                          value={calcTransport}
                          onChange={(e) => setCalcTransport(Number(e.target.value))}
                          className="w-full p-1 text-[11px] border rounded bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-600 block mb-0.5">🍽️ Alimentos</span>
                        <input
                          type="number"
                          value={calcFood}
                          onChange={(e) => setCalcFood(Number(e.target.value))}
                          className="w-full p-1 text-[11px] border rounded bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-600 block mb-0.5">🚕 Taxis/Otros</span>
                        <input
                          type="number"
                          value={calcMisc}
                          onChange={(e) => setCalcMisc(Number(e.target.value))}
                          className="w-full p-1 text-[11px] border rounded bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-700">
                        Total Calculado: ${((calcHotel || 0) + (calcTransport || 0) + (calcFood || 0) + (calcMisc || 0)).toLocaleString('es-MX')} MXN
                      </span>
                      <button
                        type="button"
                        onClick={applyCalculatorTotal}
                        className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded font-bold hover:bg-indigo-500 transition"
                      >
                        Aplicar Monto
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comentarios Adicionales */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observaciones Adicionales / Cotizaciones
                </label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enlaces a cotizaciones, números de proveedor o notas específicas..."
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs bg-white"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Generará Folio Oficial, estructura JSON y enviará correo a {bossEmail}.</span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition text-xs"
              >
                {loading ? (
                  <span>Procesando...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Solicitud para Autorización</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
