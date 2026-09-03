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
  ArrowRight,
  FileCheck2,
  BarChart3,
  Plane,
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
  const [loginOpen, setLoginOpen] = useState(false);

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
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Error al iniciar sesión');
      }

      if (data.token) setAuthToken(data.token);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : (typeof err === 'string' ? err : String(err?.message || err?.error || 'Error de conexión con el servidor')));
    } finally {
      setLoading(false);
    }
  };

  const openLogin = () => {
    setError(null);
    setLoginOpen(true);
  };

  return (
    <div className="fixed inset-0 z-[100] min-h-screen overflow-y-auto bg-white text-slate-900">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -right-40 h-[620px] w-[620px] rounded-full bg-indigo-100/70 blur-3xl" />
        <div className="absolute top-[45%] -left-56 h-[520px] w-[520px] rounded-full bg-blue-50 blur-3xl" />
        <div className="absolute bottom-[-260px] right-[20%] h-[500px] w-[500px] rounded-full bg-violet-50 blur-3xl" />
      </div>

      {/* Public navigation */}
      <header className="relative z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 cursor-pointer">
            <DimerLogo variant="light" size="md" />
            <div className="hidden sm:block text-left">
              <div className="text-sm font-black tracking-tight text-slate-900">Viáticos Dimer</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-600">Portal Empresarial</div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#inicio" className="hover:text-indigo-600 transition">Inicio</a>
            <a href="#caracteristicas" className="hover:text-indigo-600 transition">Características</a>
            <a href="#proceso" className="hover:text-indigo-600 transition">Cómo funciona</a>
            <a href="#contacto" className="hover:text-indigo-600 transition">Contacto</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Crear cuenta
            </button>
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main id="inicio" className="relative z-10">
        <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-16">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Plataforma corporativa DIMER · Sistema en línea
            </div>

            <h1 className="text-4xl font-black leading-[1.06] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Gestiona tus viáticos
              <span className="block text-indigo-600">de forma simple y eficiente.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Solicita, autoriza y administra los recursos de viaje de DIMER desde un solo lugar, con trazabilidad y control en cada etapa.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openLogin}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
              >
                Iniciar sesión
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-black text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Crear cuenta
              </button>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" />Acceso seguro</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-500" />Aprobaciones por correo</span>
              <span className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-blue-500" />Trazabilidad completa</span>
            </div>
          </div>

          {/* Product visual */}
          <div className="relative mx-auto w-full max-w-xl lg:justify-self-end">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-indigo-200/60 via-blue-100/40 to-violet-200/50 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/40 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">DIMER · VIÁTICOS</div>
                  <div className="mt-1 text-xl font-black text-slate-900">Tu viaje, bajo control</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Plane className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><FileCheck2 className="h-4 w-4 text-indigo-500" />Solicitudes</div>
                  <div className="mt-3 text-2xl font-black text-slate-900">100%</div>
                  <div className="mt-1 text-[10px] font-semibold text-emerald-600">Digitalizadas</div>
                </div>
                <div className="rounded-2xl bg-indigo-600 p-4 text-white shadow-lg shadow-indigo-600/20">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-100"><Zap className="h-4 w-4" />Aprobación</div>
                  <div className="mt-3 text-2xl font-black">1 clic</div>
                  <div className="mt-1 text-[10px] font-semibold text-indigo-100">Desde el correo</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Flujo de autorización</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">ACTIVO</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-indigo-600" />
                  <div className="h-2 flex-1 rounded-full bg-indigo-600" />
                  <div className="h-2 flex-1 rounded-full bg-slate-200" />
                  <div className="h-2 flex-1 rounded-full bg-slate-200" />
                </div>
                <div className="mt-3 flex justify-between text-[9px] font-bold text-slate-400">
                  <span>Solicitud</span><span>Jefe</span><span>Finanzas</span><span>Completado</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs font-black text-slate-800">Seguridad y trazabilidad</div>
                  <div className="text-[10px] font-medium text-slate-500">Roles, auditoría y control de accesos</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="caracteristicas" className="border-y border-slate-200/80 bg-slate-50/70 py-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Todo en un solo lugar</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Un proceso más claro para todos.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Cada área trabaja con la información que necesita, manteniendo el control del proceso completo.</p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <Feature icon={<Zap className="h-5 w-5" />} title="Solicitudes rápidas" text="Captura la información del viaje y envía tu solicitud sin procesos innecesarios." />
              <Feature icon={<CheckCircle2 className="h-5 w-5" />} title="Aprobaciones sencillas" text="Los responsables pueden revisar y autorizar directamente desde su correo." />
              <Feature icon={<BarChart3 className="h-5 w-5" />} title="Control total" text="Consulta estados, movimientos y trazabilidad para una administración ordenada." />
            </div>
          </div>
        </section>

        <section id="proceso" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Cómo funciona</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Del viaje a la comprobación, sin perder el control.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Viáticos Dimer centraliza las etapas del proceso y aplica los permisos correspondientes según cada rol.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Step n="01" title="Solicita" text="Registra tu viaje." />
              <Step n="02" title="Autoriza" text="El responsable revisa." />
              <Step n="03" title="Controla" text="Finanzas da seguimiento." />
            </div>
          </div>
        </section>
      </main>

      <footer id="contacto" className="relative z-10 border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <div className="text-sm font-black text-white">Viáticos Dimer</div>
            <div className="mt-1 text-xs text-slate-500">Diseños y Mercadotecnia · Portal Corporativo</div>
          </div>
          <div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-400">
            <span>Acceso protegido</span>
            <span>Control administrativo</span>
            <span>Auditoría</span>
          </div>
        </div>
      </footer>

      {/* Login modal */}
      {loginOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-slate-950 to-[#111c36] p-6 text-white">
              <div className="flex items-center justify-between">
                <DimerLogo variant="dark" size="sm" />
                <button type="button" onClick={() => setLoginOpen(false)} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer" aria-label="Cerrar">×</button>
              </div>
              <div className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Portal Corporativo</div>
              <h2 className="mt-1 text-2xl font-black">Iniciar sesión</h2>
              <p className="mt-1 text-xs text-slate-300">Ingresa tus credenciales corporativas para continuar.</p>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email-input" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Correo institucional</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input id="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ej. sistemas@dimer.com.mx" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password-input" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input id="login-password-input" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Introduce tu contraseña..." className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-11 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><LogIn className="h-4 w-4" /><span>Ingresar al sistema</span></>}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs">
                <span className="text-slate-500">¿No tienes cuenta?</span>
                <button type="button" onClick={onOpenRegisterModal} className="flex items-center gap-1.5 font-black text-indigo-600 hover:text-indigo-800 cursor-pointer">
                  <UserPlus className="h-3.5 w-3.5" /> Registrarse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</div>
      <h3 className="mt-5 text-base font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black text-indigo-600">{n}</div>
      <div className="mt-3 text-sm font-black text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{text}</div>
    </div>
  );
}
