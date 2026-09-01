import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  UserPlus,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import DimerLogo from './DimerLogo';
import { safeFetchJson, setAuthToken } from '../utils/apiHelper';
import type { User } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  onOpenRegisterModal: () => void;
}

export default function LoginView({
  onLoginSuccess,
  onOpenRegisterModal,
}: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await safeFetchJson<any>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Error al iniciar sesión');
      }

      if (data.token) {
        setAuthToken(data.token);
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
      {/* Dynamic Background Ambient Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/10 via-blue-500/10 to-purple-500/5 rounded-full blur-3xl transform -translate-y-12" />
        <div className="w-[450px] h-[450px] bg-gradient-to-br from-indigo-600/10 to-emerald-500/5 rounded-full blur-2xl transform translate-x-48 translate-y-36" />
      </div>

      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden relative z-10 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Corporate Brand Showcase */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-[#0f172a] to-slate-900 p-6 sm:p-8 text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          {/* Subtle Ambient Ring */}
          <div className="absolute -top-12 -left-12 w-44 h-44 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <DimerLogo variant="dark" size="md" />
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold border border-indigo-500/30 uppercase tracking-widest font-mono">
                EMPRESARIAL
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                Diseños y Mercadotecnia
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
                Portal de Viáticos
              </h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Plataforma oficial para la emisión, dictamen de autorización y dispersión de recursos para viajes corporativos.
              </p>
            </div>

            {/* Corporate Value Pillars */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span>Aprobación directa en 1 clic por correo</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>Auditoría inmutable y roles protegidos</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span>Control de presupuestos y tesorería SPEI</span>
              </div>
            </div>
          </div>

          {/* Footer Security Badge */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono relative z-10">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>DIMER TI • En Línea</span>
            </span>
            <span className="text-slate-500">v2.6 Enterprise</span>
          </div>
        </div>

        {/* Right Column: Authentication Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center space-y-6 bg-white">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Ingresa tus credenciales corporativas para acceder a tu panel de control.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="login-email-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Correo Institucional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. sistemas@dimer.com.mx"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce tu contraseña..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Registration Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-600">
              ¿No tienes una cuenta de usuario?
            </span>
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Registrarse aquí</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
