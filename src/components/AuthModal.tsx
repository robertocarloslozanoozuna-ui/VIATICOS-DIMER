import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  Building,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
  HelpCircle,
} from 'lucide-react';
import EmailAutocompleteInput from './EmailAutocompleteInput';
import DimerLogo from './DimerLogo';
import { safeFetchJson, setAuthToken } from '../utils/apiHelper';
import type { CompanyEmployee } from '../data/companyDirectory';
import type { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState('Ventas');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRoleId, setRegRoleId] = useState('role_solicitante');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setSuccessMsg(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      if (!data?.success) throw new Error(data?.error || 'Credenciales inválidas');
      if (data.token) setAuthToken(data.token);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : (typeof err === 'string' ? err : String(err?.message || err?.error || 'Error al iniciar sesión')));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirmPassword) {
      setError('Las contraseñas no coinciden. Verifica que sean idénticas.');
      return;
    }
    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/auth/register-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          department: regDepartment.trim(),
          password: regPassword,
          roleId: regRoleId,
        }),
      });
      if (!data.success) throw new Error(data.error || 'Error al procesar el registro');
      setVerificationEmail(data.email);
      if (data.simulatedCode) setSimulatedCode(data.simulatedCode);
      setSuccessMsg(data.message || 'Código de verificación enviado');
      setResendCooldown(60);
      setMode('verify');
    } catch (err: any) {
      setError(err.message || 'Error al enviar código de verificación');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail.trim(), code: verificationCode.trim() }),
      });
      if (!data?.success) throw new Error(data?.error || 'Código incorrecto o expirado');
      if (data.token) setAuthToken(data.token);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al validar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail.trim() }),
      });
      if (!data.success) throw new Error(data.error || 'Error al reenviar código');
      if (data.simulatedCode) setSimulatedCode(data.simulatedCode);
      setSuccessMsg('Nuevo código enviado a tu correo');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'No se pudo reenviar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDirectoryEmployee = (emp: CompanyEmployee) => {
    setRegName(emp.name);
    setRegDepartment(emp.department);
    if (emp.suggestedRole === 'ADMIN') setRegRoleId('role_admin');
    else if (emp.suggestedRole === 'SOLO_LECTURA_APROBADAS') setRegRoleId('role_solo_lectura');
    else setRegRoleId('role_solicitante');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2"><DimerLogo variant="dark" size="sm" /></div>
            <div className="mt-1 flex items-center gap-1"><span className="text-sm font-bold text-white">Solicitud de Viáticos</span></div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {mode === 'login' ? 'Inicio de Sesión Seguro' : mode === 'register' ? 'Registro de Nuevo Usuario Corporativo' : 'Verificación de Código por Correo'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition text-xl cursor-pointer">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span>{error}</span></div>}
          {successMsg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>{successMsg}</span></div>}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <EmailAutocompleteInput id="login-email" label="Correo Electrónico Corporativo" value={loginEmail} onChange={(val) => setLoginEmail(val)} placeholder="ej. roberto.lozano@dimer.com.mx" required autoFocus hint="Escribe para autocompletar desde el Directorio Dimer" />
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Contraseña <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Lock className="w-4 h-4" /></div>
                  <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                <div className="flex justify-between items-center mt-1"><span className="text-[10px] text-slate-400">Contraseña por defecto de cuentas demo: <code className="text-indigo-600 font-mono font-bold">password123</code></span></div>
              </div>
              <button type="submit" disabled={loading} className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Iniciar Sesión</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="mt-4 pt-4 border-t border-slate-100 text-center"><p className="text-xs text-slate-600">¿Eres un usuario nuevo?{' '}<button type="button" onClick={() => { setError(null); setSuccessMsg(null); setMode('register'); }} className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer">Registrarme con mi correo Dimer</button></p></div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterInit} className="space-y-3.5">
              <EmailAutocompleteInput id="reg-email" label="1. Correo Corporativo Dimer" value={regEmail} onChange={(val) => setRegEmail(val)} onSelectEmployee={handleSelectDirectoryEmployee} placeholder="ej. tu.nombre@dimer.com.mx" required autoFocus hint="Selecciona tu nombre del directorio para autollenar datos" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">2. Nombre Completo <span className="text-red-500">*</span></label>
                  <div className="relative"><div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><User className="w-3.5 h-3.5" /></div><input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nombre y Apellido" required className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">3. Departamento <span className="text-red-500">*</span></label>
                  <div className="relative"><div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><Building className="w-3.5 h-3.5" /></div><input type="text" value={regDepartment} onChange={(e) => setRegDepartment(e.target.value)} placeholder="ej. Ventas, Calidad" required className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs text-indigo-950 flex items-start gap-2.5"><Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" /><div><span className="font-bold text-indigo-900 block text-[11px]">Asignación de Rol por Administración</span><span className="text-[11px] text-indigo-700 leading-relaxed">Tu cuenta se registrará como usuario inicial. El Administrador del Sistema (<strong>sistemas@dimer.com.mx</strong>) recibirá una notificación para validar tu acceso.</span></div></div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">4. Contraseña <span className="text-red-500">*</span></label>
                  <div className="relative"><div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><Lock className="w-3.5 h-3.5" /></div><input type={showPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-2.5 text-slate-400">{showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">5. Confirmar <span className="text-red-500">*</span></label>
                  <input type={showPassword ? 'text' : 'password'} value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Repite contraseña" required minLength={6} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Crear cuenta y enviar código</span><ArrowRight className="w-4 h-4" /></>}</button>
              <div className="pt-3 border-t border-slate-100 text-center"><p className="text-xs text-slate-600">¿Ya tienes cuenta?{' '}<button type="button" onClick={() => { setError(null); setSuccessMsg(null); setMode('login'); }} className="font-bold text-indigo-600 hover:underline">Iniciar sesión</button></p></div>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center py-2"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50"><KeyRound className="h-7 w-7 text-indigo-600" /></div><h3 className="text-base font-black text-slate-900">Verifica tu correo</h3><p className="mt-1 text-xs text-slate-500">Ingresa el código de 6 dígitos enviado a <strong>{verificationEmail}</strong>.</p></div>
              {simulatedCode && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800">Código de prueba: <strong className="font-mono tracking-widest">{simulatedCode}</strong></div>}
              <input autoFocus inputMode="numeric" maxLength={6} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black tracking-[0.4em] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Verificar y entrar</span><ShieldCheck className="w-4 h-4" /></>}</button>
              <button type="button" onClick={handleResendCode} disabled={loading || resendCooldown > 0} className="w-full py-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400">{resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
