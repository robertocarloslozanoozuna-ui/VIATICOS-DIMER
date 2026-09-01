import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  User,
  MapPin,
  Calendar,
  FileText,
  Mail,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Send,
  MessageSquare,
  Lock,
  Key,
  ChevronRight,
  Building2,
  ExternalLink,
  History,
  AlertCircle
} from 'lucide-react';
import type { TravelRequest, User as UserType } from '../types';

interface AprobarViewProps {
  currentUser: UserType | null;
  selectedRequestId?: string | null;
  onClearSelectedRequest: () => void;
  onSwitchUser: (email: string) => void;
  onRefreshData: () => void;
}

export default function AprobarView({
  currentUser,
  selectedRequestId,
  onClearSelectedRequest,
  onSwitchUser,
  onRefreshData,
}: AprobarViewProps) {
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<TravelRequest | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Token Approval Mode
  const [tokenInput, setTokenInput] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenResult, setTokenResult] = useState<{ valid: boolean; error?: string; request?: TravelRequest; tokenRecord?: any } | null>(null);

  // Approval Form State
  const [amountAuthorized, setAmountAuthorized] = useState<number>(0);
  const [comments, setComments] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Read URL query params if any (e.g. ?token=...&folio=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setTokenInput(tokenParam);
      validateToken(tokenParam);
    }
  }, []);

  // Fetch pending requests for approval
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests');
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) {
        setRequests(data);

        if (selectedRequestId) {
          const found = data.find((r) => r.id === selectedRequestId || r.folio === selectedRequestId);
          if (found) {
            selectRequestForReview(found);
          }
        } else if (data.length > 0 && !activeRequest) {
          const pending = data.find((r) => r.status === 'PENDIENTE_APROBACION') || data[0];
          selectRequestForReview(pending);
        }
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedRequestId]);

  const selectRequestForReview = async (req: TravelRequest) => {
    setActiveRequest(req);
    setAmountAuthorized(req.amountAuthorized || req.amountRequested);
    setComments(req.comments || '');
    setActionSuccess(null);
    setErrorMessage(null);

    // Fetch audit history for this request
    try {
      const res = await fetch(`/api/requests/${req.id}`);
      const detail = await res.json();
      if (detail.auditLogs) {
        setAuditLogs(detail.auditLogs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Validate Token Endpoint
  const validateToken = async (tokenStr: string) => {
    if (!tokenStr.trim()) return;
    setTokenLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/approval-tokens/${tokenStr.trim()}`);
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setTokenResult({ valid: false, error: data.error || 'Token inválido o expirado' });
      } else {
        setTokenResult(data);
        if (data.request) {
          selectRequestForReview(data.request);
        }
      }
    } catch (err: any) {
      setTokenResult({ valid: false, error: err.message });
    } finally {
      setTokenLoading(false);
    }
  };

  // Execute token-based approval
  const handleTokenAction = async (action: 'APROBADA' | 'RECHAZADA') => {
    if (!tokenInput.trim()) return;
    if (action === 'RECHAZADA' && !comments.trim()) {
      setErrorMessage('Por favor ingrese el motivo del rechazo.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/approval-tokens/${tokenInput.trim()}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          amountAuthorized: Number(amountAuthorized),
          comments: comments.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar acción');

      setActionSuccess(data.message || `Solicitud ${action.toLowerCase()} con éxito.`);
      onRefreshData();
      fetchRequests();
      // Re-validate token to show it has been used
      validateToken(tokenInput.trim());
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isUserAuthorized =
    currentUser &&
    activeRequest &&
    (currentUser.email.toLowerCase() === activeRequest.bossEmail.toLowerCase() ||
      currentUser.role === 'ADMIN' ||
      currentUser.permissions?.includes('aprobar_solicitudes'));

  const handleApprove = async () => {
    if (!activeRequest) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/requests/${activeRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountAuthorized: Number(amountAuthorized),
          comments: comments.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al autorizar la solicitud.');

      setActionSuccess(
        `¡Solicitud ${activeRequest.folio} APROBADA! Se envió correo de notificación automática a sistemas@dimer.com.mx y Finanzas.`
      );
      onRefreshData();
      fetchRequests();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeRequest) return;
    if (!comments.trim()) {
      setErrorMessage('Por favor ingrese el motivo del rechazo en el campo de comentarios.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/requests/${activeRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: comments.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar la solicitud.');

      setActionSuccess(`Solicitud ${activeRequest.folio} RECHAZADA. Se ha registrado en la bitácora.`);
      onRefreshData();
      fetchRequests();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestCorrection = async () => {
    if (!activeRequest) return;
    if (!comments.trim()) {
      setErrorMessage('Por favor especifique qué correcciones o comprobantes adicionales requiere el colaborador.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/requests/${activeRequest.id}/request-correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: comments.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar corrección.');

      setActionSuccess(`Se ha marcado la solicitud ${activeRequest.folio} en estado CORRECCIÓN SOLICITADA.`);
      onRefreshData();
      fetchRequests();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const safeRequests = Array.isArray(requests) ? requests : [];

  return (
    <div className="space-y-4">
      {/* Top Header / Security Banner */}
      <div className="bg-[#0f172a] text-white p-4 rounded-xl border border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 uppercase font-mono">
              Aprobación Jerárquica & Token Seguro
            </span>
            <span className="text-[10px] text-slate-400 font-mono">DIMER RBAC</span>
          </div>
          <h1 className="text-base font-bold text-white mt-0.5">Dictamen de Solicitudes de Viáticos</h1>
          <p className="text-xs text-slate-400">
            Autorización directa en plataforma o mediante enlaces seguros de un solo uso recibidos por correo.
          </p>
        </div>

        {/* Security Rule Badge */}
        <div className="bg-slate-900/90 text-slate-300 px-3 py-2 rounded-lg border border-slate-800 flex items-center gap-2 text-xs">
          <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="text-[11px]">
            <span className="font-bold text-slate-200">Notificación Automática:</span> Al aprobar, se notifica a{' '}
            <span className="text-indigo-300 font-mono">sistemas@dimer.com.mx</span>.
          </div>
        </div>
      </div>

      {/* Token Fast Validator Box */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
          <Key className="w-4 h-4 text-indigo-600" />
          <span>Validar Enlace / Token de Correo:</span>
        </div>
        <div className="flex-1 flex gap-1.5 w-full">
          <input
            type="text"
            placeholder="Pegue aquí el token recibido en el correo (ej. tok_...)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => validateToken(tokenInput)}
            disabled={tokenLoading || !tokenInput.trim()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-bold disabled:opacity-50 transition"
          >
            {tokenLoading ? 'Validando...' : 'Verificar'}
          </button>
        </div>
      </div>

      {/* Token status banner if checked */}
      {tokenResult && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
            tokenResult.valid
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {tokenResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <div>
              {tokenResult.valid ? (
                <div>
                  <strong>Token de Aprobación Válido:</strong> Solicitud <strong>{tokenResult.request?.folio}</strong>{' '}
                  asignada al jefe <strong className="font-mono">{tokenResult.tokenRecord?.bossEmail}</strong>.
                </div>
              ) : (
                <div>
                  <strong>Alerta de Seguridad:</strong> {tokenResult.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: List of Requests */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-3">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Bandeja de Solicitudes</span>
              <span className="bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded text-[9px]">
                {safeRequests.length}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-6 text-slate-400 text-xs">Cargando solicitudes...</div>
            ) : safeRequests.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No hay solicitudes registradas.</div>
            ) : (
              <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
                {safeRequests.map((r) => {
                  const isSelected = activeRequest?.id === r.id;
                  const isPending = r.status === 'PENDIENTE_APROBACION';
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectRequestForReview(r)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 shadow-xs ring-1 ring-indigo-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-xs text-indigo-600">{r.folio}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : r.status === 'APROBADA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'PAGADA'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 truncate">{r.destination}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span>{r.user?.name || 'Solicitante'}</span>
                        <span className="font-bold text-slate-800">{formatCurrency(r.amountRequested)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Request Review & Decision */}
        <div className="lg:col-span-8">
          {activeRequest ? (
            <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-[#0f172a] p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-indigo-400 font-bold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                      FOLIO OFICIAL
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(activeRequest.createdAt).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-white mt-1 font-mono">{activeRequest.folio}</h2>
                  <p className="text-xs text-slate-300">
                    Jefe que Autoriza: <strong className="text-indigo-300 font-mono">{activeRequest.bossEmail}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-md uppercase border ${
                      activeRequest.status === 'PENDIENTE_APROBACION'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                        : activeRequest.status === 'APROBADA'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {activeRequest.status}
                  </span>
                </div>
              </div>

              {/* Feedback messages */}
              {actionSuccess && (
                <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{actionSuccess}</span>
                </div>
              )}
              {errorMessage && (
                <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{errorMessage}</span>
                </div>
              )}

              {/* Request Details Grid */}
              <div className="p-4 space-y-4 text-xs">
                {/* Structured Request 6 Mandatory Fields */}
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                      Datos de la Solicitud
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      activeRequest.urgency === 'alta' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      activeRequest.urgency === 'baja' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      Urgencia: {activeRequest.urgency?.toUpperCase() || 'MEDIA'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">1. Solicitante:</span>
                      <span className="font-bold text-slate-900">{activeRequest.requesterName || activeRequest.user?.name || activeRequest.userId}</span>
                      <div className="text-slate-500 text-[10px] font-mono">{activeRequest.user?.email}</div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">2. Área / Departamento:</span>
                      <span className="font-semibold text-slate-900">{activeRequest.department || activeRequest.user?.department || 'DIMER'}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">3. Tipo de Solicitud:</span>
                      <span className="font-bold text-indigo-700">{activeRequest.requestType || 'Viáticos y Gastos de Viaje'}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">4. Fecha de Solicitud:</span>
                      <span className="font-medium text-slate-800">
                        {activeRequest.requestDate || new Date(activeRequest.createdAt).toLocaleDateString('es-MX')}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">Jefe Asignado:</span>
                      <span className="font-mono text-indigo-800 font-semibold text-[11px] truncate block">{activeRequest.bossEmail}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">Destino / Ubicación:</span>
                      <span className="font-medium text-slate-800">{activeRequest.destination || 'Oficinas Centrales'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-bold uppercase text-[10px] block mb-1">
                      5. Descripción / Detalle de lo Solicitado:
                    </span>
                    <p className="bg-white p-2.5 rounded border border-slate-200 text-slate-800 text-[11px] whitespace-pre-line leading-relaxed">
                      {activeRequest.detail || activeRequest.reason}
                    </p>
                  </div>
                </div>

                {/* Justification & Comments */}
                <div className="space-y-2">
                  {activeRequest.comments && (
                    <div>
                      <span className="text-slate-500 font-bold uppercase text-[10px] block">Observaciones / Desglose:</span>
                      <p className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 text-[11px] mt-0.5 whitespace-pre-line">
                        {activeRequest.comments}
                      </p>
                    </div>
                  )}

                  {activeRequest.rejectionReason && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[11px]">
                      <strong className="block text-rose-950 font-bold">Motivo de Rechazo registrado:</strong>
                      {activeRequest.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-900 text-white p-3.5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Monto Solicitado</span>
                    <span className="text-lg font-black text-white">{formatCurrency(activeRequest.amountRequested)}</span>
                  </div>
                  {activeRequest.amountAuthorized && (
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase block">Monto Autorizado</span>
                      <span className="text-lg font-black text-emerald-400">
                        {formatCurrency(activeRequest.amountAuthorized)}
                      </span>
                    </div>
                  )}
                </div>

                {/* APPROVAL / REJECTION CONTROLS */}
                {activeRequest.status === 'PENDIENTE_APROBACION' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Dictamen del Jefe Aprobador
                    </h3>

                    {/* Check if user matches or is token-validated */}
                    {!isUserAuthorized && !tokenResult?.valid && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Su usuario actual es <strong>{currentUser?.email}</strong>. El jefe asignado es{' '}
                            <strong>{activeRequest.bossEmail}</strong>.
                          </span>
                        </div>
                        <button
                          onClick={() => onSwitchUser(activeRequest.bossEmail)}
                          className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold"
                        >
                          Simular como {activeRequest.bossEmail.split('@')[0]}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Monto Autorizado (MXN) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={amountAuthorized}
                          onChange={(e) => setAmountAuthorized(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">Puede ajustarse si se autoriza un monto menor.</span>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Observaciones / Motivo (Requerido para rechazo)
                        </label>
                        <input
                          type="text"
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="Comentarios de dictamen o motivo de rechazo..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {tokenResult?.valid ? (
                        /* Tokenized Action Buttons */
                        <>
                          <button
                            onClick={() => handleTokenAction('APROBADA')}
                            disabled={actionLoading}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-1.5 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirmar Aprobación (Vía Token Seguro)</span>
                          </button>
                          <button
                            onClick={() => handleTokenAction('RECHAZADA')}
                            disabled={actionLoading}
                            className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-1.5 transition"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rechazar</span>
                          </button>
                        </>
                      ) : (
                        /* In-App Direct Action Buttons */
                        <>
                          <button
                            onClick={handleApprove}
                            disabled={actionLoading || (!isUserAuthorized && currentUser?.role !== 'ADMIN')}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Aprobar Solicitud (Notifica a Sistemas)</span>
                          </button>

                          <button
                            onClick={handleRequestCorrection}
                            disabled={actionLoading || (!isUserAuthorized && currentUser?.role !== 'ADMIN')}
                            className="py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Solicitar Corrección</span>
                          </button>

                          <button
                            onClick={handleReject}
                            disabled={actionLoading || (!isUserAuthorized && currentUser?.role !== 'ADMIN')}
                            className="py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rechazar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Audit Logs for this request */}
                {auditLogs.length > 0 && (
                  <div className="pt-3 border-t border-slate-200">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <History className="w-3 h-3 text-slate-400" />
                      Historial Inmutable de Auditoría ({auditLogs.length})
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] flex justify-between items-center">
                          <div>
                            <span className="font-bold text-indigo-700 font-mono mr-2">{log.action}</span>
                            <span className="text-slate-600">{JSON.stringify(log.details)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                            {new Date(log.timestamp).toLocaleTimeString('es-MX')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Seleccione una solicitud de la lista para evaluarla.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
