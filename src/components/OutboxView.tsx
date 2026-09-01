import React, { useState, useEffect } from 'react';
import { Mail, Zap, AlertCircle, CheckCircle2, Info, ShieldAlert, Server, Send } from 'lucide-react';
import type { EmailLog } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

export default function OutboxView() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [targetEmail, setTargetEmail] = useState('sistemas@dimer.com.mx');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchStatusAndEmails = async () => {
    setLoading(true);
    try {
      const [dataOutbox, dataStatus] = await Promise.all([
        safeFetchJson<EmailLog[]>('/api/outbox').catch(() => []),
        safeFetchJson<any>('/api/smtp/status').catch(() => ({})),
      ]);
      const safeOutbox: EmailLog[] = Array.isArray(dataOutbox) ? dataOutbox : [];
      setEmails(safeOutbox);
      setSmtpStatus(dataStatus && typeof dataStatus === 'object' ? dataStatus : {});
      if (safeOutbox.length > 0 && !selectedEmail) setSelectedEmail(safeOutbox[0]);
    } catch (e) {
      console.error('Error cargando Bandeja SMTP:', e);
      setEmails([]);
      setSmtpStatus({});
    } finally {
      setLoading(false);
    }
  };

  const handleTestSend = async () => {
    if (!targetEmail.trim()) return;
    setTestingSmtp(true);
    setTestResult(null);
    try {
      const data = await safeFetchJson('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: targetEmail.trim() }),
      });
      setTestResult(data);
      const outboxData = await safeFetchJson<EmailLog[]>('/api/outbox').catch(() => []);
      if (Array.isArray(outboxData)) {
        setEmails(outboxData);
        if (outboxData.length > 0) setSelectedEmail(outboxData[0]);
      }
    } catch (err: any) {
      setTestResult({ success: false, status: 'FALLIDO', error: err?.message || 'Error de conexión' });
    } finally {
      setTestingSmtp(false);
    }
  };

  useEffect(() => { void fetchStatusAndEmails(); }, []);

  const configured = Boolean(smtpStatus?.configured);
  const details = smtpStatus?.details || {};
  const host = details?.host || 'smtp.gmail.com';
  const port = details?.port || '465';
  const user = details?.user || 'No configurado';
  const from = details?.from || 'No configurado';
  const hasPassword = Boolean(details?.hasPassword);
  const instructions = smtpStatus?.instructions || (configured ? 'SMTP configurado y listo para salida de correos.' : 'Configure SMTP_USER y SMTP_PASS en el entorno del servidor.');

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500 text-sm">Cargando Bandeja SMTP...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-800">Conexión Servidor SMTP (Salida Real)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${configured ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                  {configured ? '● CONFIGURADO' : '○ NO CONFIGURADO'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{instructions}</p>
            </div>
          </div>
          
          {/* Quick test box */}
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="correo@dimer.com.mx"
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono w-56"
            />
            <button
              onClick={handleTestSend}
              disabled={testingSmtp || !targetEmail.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${testingSmtp ? 'animate-bounce' : ''}`} />
              <span>{testingSmtp ? 'Enviando...' : 'Enviar Prueba'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div><span className="text-[10px] font-bold text-slate-400 block uppercase">Remitente (FROM):</span><span className="font-mono text-indigo-700 font-bold truncate block" title={from}>{from}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 block uppercase">Host / Servidor:</span><span className="font-mono text-slate-700 font-medium">{host}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 block uppercase">Puerto:</span><span className="font-mono text-slate-700 font-medium">{port}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 block uppercase">Usuario Auth:</span><span className="font-mono text-slate-700 font-medium truncate block">{user}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 block uppercase">Contraseña:</span><span className="font-mono text-slate-700 font-medium">{hasPassword ? '•••••••• (Cargada)' : 'No configurada'}</span></div>
        </div>

        {testResult && (
          <div className="space-y-2">
            <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${testResult.status === 'ENVIADO' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : testResult.status === 'SIMULADO' ? 'bg-blue-50 text-blue-900 border-blue-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>
              <div className="flex items-center gap-2">
                {testResult.status === 'ENVIADO' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : testResult.status === 'SIMULADO' ? <Info className="w-4 h-4 text-blue-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{testResult.status === 'ENVIADO' ? `¡Correo de prueba enviado con éxito vía SMTP a ${testResult.targetEmail || targetEmail}!` : testResult.status === 'SIMULADO' ? 'Correo guardado en modo simulación.' : `Error al enviar vía SMTP: ${testResult.error || 'Error SMTP desconocido'}`}</span>
              </div>
              <span className="font-mono font-bold text-[10px] uppercase shrink-0">{testResult.status || 'FALLIDO'}</span>
            </div>
            {testResult.status === 'FALLIDO' && testResult.error?.includes('535') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-900 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div><p className="font-bold text-[11px]">Google rechazó la autenticación SMTP (535).</p><p className="text-[11px] text-amber-800 mt-0.5">La aplicación usa exclusivamente <strong>SMTP_USER</strong> y <strong>SMTP_PASS</strong>. Verifique que SMTP_PASS sea la contraseña de aplicación vigente de sistemas@dimer.com.mx.</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {emails.length === 0 ? (
        <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-12 text-center text-slate-400 text-xs">
          <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <h3 className="text-slate-700 font-bold">Aún no se han generado correos</h3>
          <p className="text-[11px] text-slate-500 mt-1">Crea una nueva solicitud de viáticos para ver el correo disparado al jefe en esta bandeja.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-2">
            <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-3">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between"><span>Historial de Envíos</span><span className="bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded text-[9px]">{emails.length}</span></div>
              <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
                {emails.map((m) => {
                  const isSelected = selectedEmail?.id === m.id;
                  return <button key={m.id} onClick={() => setSelectedEmail(m)} className={`w-full text-left p-2.5 rounded-lg border transition-all ${isSelected ? 'bg-indigo-50/90 border-indigo-500 shadow-xs ring-1 ring-indigo-500/20' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-bold text-slate-800 truncate max-w-[200px] font-mono">{m.to}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${m.status === 'ENVIADO' ? 'bg-emerald-100 text-emerald-800' : m.status === 'SIMULADO' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>{m.status}</span></div>
                    <div className="text-xs font-medium text-indigo-950 truncate">{m.subject}</div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono"><span>{m.folio ? `Folio: ${m.folio}` : 'N/A'}</span><span>{new Date(m.createdAt).toLocaleTimeString('es-MX')}</span></div>
                  </button>;
                })}
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            {selectedEmail ? <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
              <div className="bg-[#0f172a] p-3 text-white"><div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5 mb-1.5"><div><span>Para: </span><strong className="text-white font-mono">{selectedEmail.to}</strong></div><div className="font-mono text-[10px]">{new Date(selectedEmail.createdAt).toLocaleString('es-MX')}</div></div><h3 className="text-xs font-bold text-white truncate">{selectedEmail.subject}</h3></div>
              <div className="p-3 bg-slate-100 max-h-[600px] overflow-y-auto"><div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden" dangerouslySetInnerHTML={{ __html: selectedEmail.html || '<p>Sin contenido HTML.</p>' }} /></div>
            </div> : <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-10 text-center text-slate-400 text-xs">Selecciona un correo para previsualizar su plantilla HTML.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

