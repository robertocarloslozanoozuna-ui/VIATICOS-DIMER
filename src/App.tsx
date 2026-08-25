/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Menu,
  Plus,
  ShieldCheck,
  Activity,
  Terminal,
  LogIn,
  LogOut,
  UserPlus,
  Lock,
  Eye,
  AlertTriangle,
  ArrowRight,
  PanelLeft,
  PanelLeftClose,
  ToggleLeft,
  ToggleRight,
  UserCheck,
} from 'lucide-react';
import Navbar from './components/Navbar';
import SolicitarView from './components/SolicitarView';
import AprobarView from './components/AprobarView';
import MisSolicitudesView from './components/MisSolicitudesView';
import FinanzasView from './components/FinanzasView';
import AdminView from './components/AdminView';
import AuditoriaView from './components/AuditoriaView';
import OutboxView from './components/OutboxView';
import NextjsCodeView from './components/NextjsCodeView';
import PrintVoucherModal from './components/PrintVoucherModal';
import AuthModal from './components/AuthModal';
import LoginView from './components/LoginView';
import type { User, TravelRequest, Role } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [activeTab, setActiveTab] = useState<string>('mis-solicitudes');
  const [selectedRequestIdForApproval, setSelectedRequestIdForApproval] = useState<string | null>(null);
  const [printRequest, setPrintRequest] = useState<TravelRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [lastEventText, setLastEventText] = useState('EVENT: SystemInitialized | STATUS: OK');

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Fetch initial session and data
  const fetchData = async () => {
    try {
      const [meRes, reqRes] = await Promise.all([
        fetch('/api/me'),
        fetch('/api/requests'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
        setAllUsers(meData.allUsers || []);
      }

      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData);
        if (reqData.length > 0) {
          setLastEventText(`EVENT: TravelRequest #${reqData[0].folio} | STATUS: ${reqData[0].status}`);
        }
      }
    } catch (e) {
      console.error('Error loading initial data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle switching simulated Google Account / Registered user
  const handleSwitchUser = async (emailOrId: string) => {
    try {
      const res = await fetch('/api/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrId }),
      });
      const data = await res.json();
      if (data.user) {
        handleUserChanged(data.user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error logging out:', e);
    }
    setCurrentUser(null);
    setLastEventText('AUTH: Sesión cerrada correctamente');
  };

  // When user signs in or switches role
  const handleUserChanged = async (user: User) => {
    setCurrentUser(user);
    setLastEventText(`AUTH_SWITCH: ${user.email} (${user.role})`);

    // Role-based initial redirection
    if (user.role === 'SOLO_LECTURA_APROBADAS') {
      setActiveTab('mis-solicitudes');
    } else if (user.role === 'SOLICITANTE' || user.role === 'EMPLEADO') {
      setActiveTab('solicitar');
    } else if (user.role === 'JEFE') {
      setActiveTab('aprobar');
    } else if (user.role === 'FINANZAS') {
      setActiveTab('finanzas');
    } else if (user.role === 'ADMIN') {
      setActiveTab('mis-solicitudes');
    }

    // Refresh requests list for the active user's permissions
    try {
      const reqRes = await fetch('/api/requests');
      if (reqRes.ok) {
        setRequests(await reqRes.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestCreated = (newReq: TravelRequest) => {
    setRequests((prev) => [newReq, ...prev]);
    setLastEventText(`EVENT: TravelRequest Created #${newReq.folio} | DISPATCH: Tokenized Email to Boss`);
  };

  const handleNavigateToApprovals = (requestId: string) => {
    setSelectedRequestIdForApproval(requestId);
    setActiveTab('aprobar');
  };

  const pendingApprovalsCount = requests.filter((r) => r.status === 'PENDIENTE_APROBACION').length;
  const approvedForFinanceCount = requests.filter((r) => r.status === 'APROBADA').length;

  const userRole = currentUser?.role || 'SOLICITANTE';
  const isSoloLectura = userRole === 'SOLO_LECTURA_APROBADAS';
  const isAdmin = userRole === 'ADMIN';

  const getTabTitle = () => {
    if (!currentUser) {
      return 'Portal Corporativo - Iniciar Sesión';
    }
    switch (activeTab) {
      case 'solicitar':
        return 'Registro Oficial de Nueva Solicitud de Viáticos';
      case 'mis-solicitudes':
        return isSoloLectura
          ? 'Consulta Exclusiva de Solicitudes Aprobadas'
          : userRole === 'SOLICITANTE'
          ? 'Mis Solicitudes de Viáticos'
          : 'Monitor y Control General de Viáticos';
      case 'aprobar':
        return 'Panel de Aprobación Jerárquica Directa';
      case 'finanzas':
        return 'Módulo de Finanzas, Dispersión y Pólizas';
      case 'administracion':
        return 'Administración de Usuarios, Roles, Departamentos y Jefes (RBAC)';
      case 'auditoria':
        return 'Bitácora Inmutable de Auditoría (AuditLog)';
      case 'outbox':
        return 'Bandeja de Salida SMTP & Plantillas HTML';
      case 'nextjs-code':
        return 'Esquema de Producción Next.js 14 App Router';
      default:
        return 'Gestión de Viáticos';
    }
  };

  // Permission Check for current tab
  const isTabAllowed = (tab: string, role: Role): boolean => {
    if (role === 'ADMIN') return true;
    if (role === 'SOLO_LECTURA_APROBADAS') {
      return tab === 'mis-solicitudes';
    }
    if (role === 'SOLICITANTE' || role === 'EMPLEADO') {
      return tab === 'mis-solicitudes' || tab === 'solicitar';
    }
    if (role === 'JEFE') {
      return tab === 'mis-solicitudes' || tab === 'solicitar' || tab === 'aprobar';
    }
    if (role === 'FINANZAS') {
      return tab === 'mis-solicitudes' || tab === 'solicitar' || tab === 'finanzas';
    }
    return true;
  };

  const allowed = isTabAllowed(activeTab, userRole);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] font-sans text-[#1e293b] overflow-hidden">
      {/* High Density Dark Slate Sidebar */}
      <Navbar
        currentUser={currentUser}
        allUsers={allUsers}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'aprobar') {
            setSelectedRequestIdForApproval(null);
          }
        }}
        onSwitchUser={handleSwitchUser}
        onOpenAuthModal={(mode) => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        pendingApprovalsCount={pendingApprovalsCount}
        approvedForFinanceCount={approvedForFinanceCount}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        sidebarCollapsed={!sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc]">
        {/* High Density Top Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Desktop Toggle Sidebar Button */}
            <button
              type="button"
              onClick={() => setSidebarVisible((v) => !v)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title={sidebarVisible ? 'Ocultar barra de menú lateral' : 'Mostrar barra de menú lateral'}
            >
              {sidebarVisible ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5 text-indigo-600" />
              )}
            </button>

            {/* Mobile Drawer Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {getTabTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Testing Switch: Toggle between Logged In / Logged Out simulation */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-[10px] text-slate-600">
              <span className="font-semibold text-slate-500">Vista:</span>
              <button
                type="button"
                onClick={() => {
                  if (currentUser) {
                    handleLogout();
                  } else {
                    // Quick login as admin systems or first user
                    handleSwitchUser('sistemas@dimer.com.mx');
                  }
                }}
                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                  currentUser
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
                title="Alternar rápidamente entre vista con sesión activa y vista sin sesión"
              >
                {currentUser ? (
                  <>
                    <ToggleRight className="w-3.5 h-3.5 text-white" />
                    <span>Con Sesión</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sin Sesión</span>
                  </>
                )}
              </button>
            </div>

            {/* Real-time auth tag and Logout / Login buttons */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Usuario:</span>
                  <strong className="text-slate-800 font-mono truncate max-w-[140px]">
                    {currentUser.email || currentUser.name}
                  </strong>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase font-mono ${
                      userRole === 'ADMIN'
                        ? 'bg-purple-100 text-purple-800'
                        : userRole === 'SOLO_LECTURA_APROBADAS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {userRole === 'SOLO_LECTURA_APROBADAS' ? 'SOLO LECTURA' : userRole}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Cerrar sesión activa"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                  <span className="sm:hidden">Salir</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Iniciar Sesión</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Registrarse</span>
                </button>
              </div>
            )}

            {currentUser && activeTab !== 'solicitar' && !isSoloLectura && (
              <button
                onClick={() => setActiveTab('solicitar')}
                className="bg-[#0f172a] hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">NUEVA SOLICITUD</span>
                <span className="sm:hidden">NUEVA</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Work View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : !currentUser ? (
            /* Direct Main-Screen Corporate Login View */
            <LoginView
              onLoginSuccess={handleUserChanged}
              onOpenRegisterModal={() => {
                setAuthModalMode('register');
                setAuthModalOpen(true);
              }}
            />
          ) : !allowed ? (
            /* Restricted Access Notice */
            <div className="max-w-lg mx-auto my-12 bg-white p-6 rounded-2xl border border-amber-200 shadow-lg text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Acceso Restringido para este Rol
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tu perfil actual tiene el rol <strong>{userRole}</strong>, el cual no cuenta con permisos para ver este módulo.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('mis-solicitudes')}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition"
              >
                Ir a Panel Principal
              </button>
            </div>
          ) : (
            <>
              {/* Special Banner for Solo Lectura Aprobadas */}
              {isSoloLectura && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Modo de Consulta Autorizada:</strong> Tienes acceso de solo lectura a las solicitudes aprobadas, pagadas y finalizadas por Dirección.
                    </span>
                  </div>
                  <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                    SOLO_LECTURA_APROBADAS
                  </span>
                </div>
              )}

              {activeTab === 'solicitar' && (
                <SolicitarView
                  currentUser={currentUser}
                  onRequestCreated={handleRequestCreated}
                  onNavigateToApprovals={handleNavigateToApprovals}
                  onLogout={handleLogout}
                />
              )}

              {activeTab === 'mis-solicitudes' && (
                <MisSolicitudesView
                  currentUser={currentUser}
                  requests={requests}
                  onNavigateToCreate={() => setActiveTab('solicitar')}
                  onNavigateToApprove={handleNavigateToApprovals}
                  onOpenPrintVoucher={(req) => setPrintRequest(req)}
                />
              )}

              {activeTab === 'aprobar' && (
                <AprobarView
                  currentUser={currentUser}
                  selectedRequestId={selectedRequestIdForApproval}
                  onClearSelectedRequest={() => setSelectedRequestIdForApproval(null)}
                  onSwitchUser={handleSwitchUser}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'finanzas' && (
                <FinanzasView
                  currentUser={currentUser}
                  requests={requests}
                  onRefreshData={fetchData}
                  onOpenPrintVoucher={(req) => setPrintRequest(req)}
                />
              )}

              {activeTab === 'administracion' && (
                <AdminView
                  currentUser={currentUser}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'auditoria' && <AuditoriaView />}

              {activeTab === 'outbox' && <OutboxView />}

              {activeTab === 'nextjs-code' && <NextjsCodeView />}
            </>
          )}

          {/* High Density Bottom Status Ticker */}
          <footer className="mt-6 bg-[#f1f5f9] p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono text-slate-500 gap-1.5">
            <div className="flex items-center gap-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-700 font-semibold truncate">{lastEventText}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-slate-400">
              <span>SMTP: ONLINE (sistemas@dimer.com.mx)</span>
              <span>•</span>
              <span className="text-indigo-600 font-bold">SEGURIDAD: SHA-512 + PBKDF2</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Printable Voucher Modal */}
      {printRequest && (
        <PrintVoucherModal
          request={printRequest}
          onClose={() => setPrintRequest(null)}
        />
      )}

      {/* Auth Modal (Login / Register / 6-Digit Email Verification) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => handleUserChanged(user)}
      />
    </div>
  );
}
