import React, { useState } from 'react';
import {
  PlusCircle,
  FolderClock,
  CheckCircle2,
  DollarSign,
  History,
  Mail,
  Code2,
  UserCheck,
  ChevronDown,
  Building2,
  Menu,
  X,
  Sparkles,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Settings,
  Users,
  LogIn,
  LogOut,
  UserPlus,
  Eye,
  PanelLeftClose,
  PanelLeft,
  CheckCircle,
  Lock,
  Zap,
} from 'lucide-react';
import DimerLogo from './DimerLogo';
import type { User, Role } from '../types';

interface NavbarProps {
  currentUser: User | null;
  allUsers: User[];
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSwitchUser: (emailOrId: string) => void;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  pendingApprovalsCount: number;
  approvedForFinanceCount: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Navbar({
  currentUser,
  allUsers,
  activeTab,
  onSelectTab,
  onSwitchUser,
  onOpenAuthModal,
  onLogout,
  pendingApprovalsCount,
  approvedForFinanceCount,
  mobileOpen,
  setMobileOpen,
  sidebarCollapsed = false,
  onToggleSidebar,
}: NavbarProps) {
  const [showAdminSwitcher, setShowAdminSwitcher] = useState(false);

  const userRole = currentUser?.role || 'SOLICITANTE';
  const isAdmin = userRole === 'ADMIN';
  const isSoloLectura = userRole === 'SOLO_LECTURA_APROBADAS';
  const isSolicitante = userRole === 'SOLICITANTE' || userRole === 'EMPLEADO';
  const isJefe = userRole === 'JEFE';
  const isFinanzas = userRole === 'FINANZAS';

  const getRoleDisplayName = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'SOLO_LECTURA_APROBADAS':
        return 'Solo Lectura (Aprobadas)';
      case 'SOLICITANTE':
      case 'EMPLEADO':
        return 'Solicitante';
      case 'JEFE':
        return 'Jefe / Aprobador';
      case 'FINANZAS':
        return 'Finanzas';
      default:
        return role;
    }
  };

  // Build items dynamically based on RBAC & session state
  const loggedInNavItems = [
    {
      id: 'mis-solicitudes',
      label: isSoloLectura
        ? 'Solicitudes Aprobadas'
        : isSolicitante
        ? 'Mis Solicitudes'
        : 'Monitor General',
      icon: FolderClock,
      badge: null,
      visible: true,
    },
    {
      id: 'solicitar',
      label: 'Nueva Solicitud',
      icon: PlusCircle,
      badge: null,
      visible: !isSoloLectura,
    },
    {
      id: 'aprobar',
      label: 'Aprobaciones',
      icon: CheckCircle2,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeColor: 'bg-amber-500',
      visible: isAdmin || isJefe,
    },
    {
      id: 'finanzas',
      label: 'Finanzas y Pagos',
      icon: DollarSign,
      badge: approvedForFinanceCount > 0 ? approvedForFinanceCount : null,
      badgeColor: 'bg-emerald-500',
      visible: isAdmin || isFinanzas,
    },
    {
      id: 'administracion',
      label: 'Administración (RBAC)',
      icon: Users,
      badge: 'Admin',
      badgeColor: 'bg-purple-600',
      visible: isAdmin,
    },
    {
      id: 'auditoria',
      label: 'Log de Auditoría',
      icon: History,
      badge: null,
      visible: isAdmin,
    },
    {
      id: 'outbox',
      label: 'Bandeja SMTP',
      icon: Mail,
      badge: null,
      visible: isAdmin,
    },
    {
      id: 'nextjs-code',
      label: 'Código Next.js 14',
      icon: Code2,
      badge: null,
      visible: isAdmin,
    },
  ];

  const visibleNavItems = currentUser ? loggedInNavItems.filter((i) => i.visible) : [];

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* High Density Dark Slate Sidebar with Rich Ambient Texture */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-950 via-[#0b1329] to-slate-950 text-white flex flex-col shrink-0 border-r border-slate-800/80 shadow-2xl transition-all duration-200 ease-in-out relative overflow-hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl" />

        {/* Brand Header with Official DIMER Logo */}
        <div className="p-4 border-b border-slate-800/90 bg-slate-950/60 backdrop-blur-xs flex items-center justify-between z-10">
          {currentUser ? (
            <div>
              <div className="flex items-center gap-2">
                <DimerLogo variant="dark" size="sm" />
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-white">
                  Viáticos Dimer
                </span>
              </div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5 font-mono">
                PORTAL CORPORATIVO &bull; DIMER
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center justify-center text-center py-1">
              <DimerLogo variant="dark" size="md" />
              <h2 className="mt-2 text-sm font-bold text-white tracking-tight">
                Viáticos Dimer
              </h2>
              <span className="text-[9px] text-indigo-400 font-mono font-bold tracking-wider uppercase mt-0.5">
                Portal Empresarial
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="hidden lg:flex text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Ocultar barra lateral"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Active User Status Bar (Only shown when logged in) */}
        {currentUser && (
          <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 z-10">
            <div className="overflow-hidden">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{getRoleDisplayName(userRole)}</span>
              </div>
              <p className="text-xs font-semibold text-white truncate mt-0.5">
                {currentUser.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white text-[10px] font-bold rounded border border-rose-800/60 transition shrink-0 cursor-pointer flex items-center gap-1"
              title="Cerrar sesión activa"
            >
              <LogOut className="w-3 h-3" />
              <span>Salir</span>
            </button>
          </div>
        )}

        {/* Navigation Area or Rich Corporate Welcome Hub */}
        {currentUser ? (
          /* Logged In Nav List */
          <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto z-10">
            {visibleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-colors cursor-pointer group ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 font-semibold'
                      : 'hover:bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {isActive ? (
                    <div className="w-2 h-2 rounded-full bg-white shrink-0 shadow-xs" />
                  ) : (
                    <div className="w-2 h-2 rounded-full border border-slate-500 group-hover:border-white shrink-0" />
                  )}

                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>

                  {item.badge !== null && (
                    <span
                      className={`ml-auto ${
                        item.badgeColor || 'bg-indigo-500'
                      } text-[9px] font-black px-1.5 py-0.5 rounded text-white shadow-xs uppercase`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          /* Central area before login: Rich Corporate Showcase for Diseños y Mercadotecnia */
          <div className="flex-1 flex flex-col justify-between p-4 z-10 overflow-y-auto">
            {/* Corporate Badge & Company Statement */}
            <div className="space-y-3 mt-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-lg text-center backdrop-blur-xs">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                  Diseños y Mercadotecnia
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Sistema corporativo de administración de viáticos, anticipos y comprobaciones de gastos.
                </p>
                <div className="w-10 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto mt-3 rounded-full" />
              </div>

              {/* Corporate Capabilities Highlights */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Aprobación directa en 1 clic</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span>Verificación por correo SMTP</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span>Bitácora inmutable de auditoría</span>
                </div>
              </div>
            </div>

            {/* System Status Pill */}
            <div className="mt-4 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Servidor Seguro</span>
              </span>
              <span className="text-slate-500">DIMER TI</span>
            </div>
          </div>
        )}

        {/* Footer Area */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 z-10 space-y-2">
          {currentUser ? (
            /* Logged in state */
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-xs font-black shrink-0">
                  {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'UD'}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-bold text-white truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              {/* Prominent Cerrar Sesión Button */}
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-rose-950/80 text-rose-300 hover:text-rose-100 text-xs font-bold rounded-lg border border-slate-800 hover:border-rose-700/60 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                title="Cerrar sesión activa"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>

              {/* Admin quick switch helper */}
              {isAdmin && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdminSwitcher(!showAdminSwitcher)}
                    className="w-full text-[10px] text-slate-400 hover:text-slate-200 py-1 flex items-center justify-between px-1 cursor-pointer"
                  >
                    <span>Cambiar Perfil (Admin)</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showAdminSwitcher && (
                    <div className="mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg space-y-1 max-h-36 overflow-y-auto">
                      {allUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            onSwitchUser(u.id);
                            setShowAdminSwitcher(false);
                          }}
                          className="w-full text-left px-2 py-1 rounded text-[10px] text-slate-300 hover:bg-slate-800 truncate block cursor-pointer"
                        >
                          {u.name} ({u.role})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Logged OUT state */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Iniciar sesión</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuthModal('register')}
                  className="py-2 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Registrarse</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
