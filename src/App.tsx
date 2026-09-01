import React, { useState, useEffect } from 'react';
import { Menu, Plus, ShieldCheck, LogIn, LogOut, AlertTriangle, PanelLeft, PanelLeftClose, ToggleLeft, ToggleRight } from 'lucide-react';
import Navbar from './components/Navbar';
import SolicitarView from './components/SolicitarView';
import AprobarView from './components/AprobarView';
import MisSolicitudesView from './components/MisSolicitudesView';
import FinanzasView from './components/FinanzasView';
import FinanzasDashboard from './components/FinanzasDashboard';
import AdminView from './components/AdminView';
import AdminRequestManagement from './components/AdminRequestManagement';
import AuditoriaView from './components/AuditoriaView';
import OutboxView from './components/OutboxView';
import NextjsCodeView from './components/NextjsCodeView';
import PrintVoucherModal from './components/PrintVoucherModal';
import AuthModal from './components/AuthModal';
import LoginView from './components/LoginView';
import type { User, TravelRequest, Role } from './types';
import { safeFetchJson, setAuthToken } from './utils/apiHelper';

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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const fetchData = async () => {
    try {
      const [meData, reqData] = await Promise.all([
        safeFetchJson<any>('/api/me').catch(() => null),
        safeFetchJson<TravelRequest[]>('/api/requests').catch(() => null),
      ]);
      if (meData?.user) {
        setCurrentUser(meData.user);
        setAllUsers(meData.allUsers || []);
        if (meData.token) setAuthToken(meData.token);
      }
      if (Array.isArray(reqData)) {
        setRequests(reqData);
        if (reqData.length > 0) setLastEventText(`EVENT: TravelRequest #${reqData[0].folio} | STATUS: ${reqData[0].status}`);
      }
    } catch (e) {
      console.error('Error loading initial data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSwitchUser = async (emailOrId: string) => {
    try {
      const data = await safeFetchJson<any>('/api/switch-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailOrId }),
      });
      if (data?.user) {
        if (data.token) setAuthToken(data.token);
        handleUserChanged(data.user);
      }
    } catch (e) { console.error(e); }
  };

  const handleLogout = async () => {
    try { await safeFetchJson('/api/auth/logout', { method: 'POST' }); } catch (e) { console.error('Error logging out:', e); }
    setAuthToken(null);
    setCurrentUser(null);
    setLastEventText('AUTH: Sesión cerrada correctamente');
  };

  const handleUserChanged = async (user: User, token?: string) => {
    if (token) setAuthToken(token);
    setCurrentUser(user);
    setLastEventText(`AUTH_SWITCH: ${user.email} (${user.role})`);
    if (user.role === 'SOLO_LECTURA_APROBADAS') setActiveTab('mis-solicitudes');
    else if (user.role === 'SOLICITANTE' || user.role === 'EMPLEADO') setActiveTab('solicitar');
    else if (user.role === 'JEFE') setActiveTab('aprobar');
    else if (user.role === 'FINANZAS') setActiveTab('finanzas');
    else if (user.role === 'ADMIN') setActiveTab('mis-solicitudes');
    try {
      const data = await safeFetchJson<TravelRequest[]>('/api/requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); setRequests([]); }
  };

  const handleRequestCreated = (newReq: TravelRequest) => {
    setRequests((prev) => [newReq, ...(Array.isArray(prev) ? prev : [])]);
    setLastEventText(`EVENT: TravelRequest Created #${newReq.folio} | DISPATCH: Tokenized Email to Boss`);
  };

  const handleNavigateToApprovals = (requestId: string) => {
    setSelectedRequestIdForApproval(requestId);
    setActiveTab('aprobar');
  };

  const safeRequests = Array.isArray(requests) ? requests : [];
  const pendingApprovalsCount = safeRequests.filter((r) => r.status === 'PENDIENTE_APROBACION').length;
  const approvedForFinanceCount = safeRequests.filter((r) => r.status === 'APROBADA').length;
  const userRole = currentUser?.role || 'SOLICITANTE';
  const isSoloLectura = userRole === 'SOLO_LECTURA_APROBADAS';
  const isAdmin = userRole === 'ADMIN';

  const getTabTitle = () => {
    if (!currentUser) return 'Portal Corporativo - Iniciar Sesión';
    switch (activeTab) {
      case 'solicitar': return 'Registro Oficial de Nueva Solicitud de Viáticos';
      case 'mis-solicitudes': return isSoloLectura ? 'Consulta Exclusiva de Solicitudes Aprobadas' : userRole === 'SOLICITANTE' ? 'Mis Solicitudes de Viáticos' : 'Monitor y Control General de Viáticos';
      case 'aprobar': return 'Panel de Aprobación Jerárquica Directa';
      case 'finanzas': return 'Módulo de Finanzas, Dispersión y Pólizas';
      case 'administracion-solicitudes': return 'Control Administrativo de Solicitudes';
      case 'administracion-rbac': return 'Gestión de Usuarios, Roles, Departamentos y Jefes';
      case 'auditoria': return 'Bitácora Inmutable de Auditoría (AuditLog)';
      case 'outbox': return 'Bandeja de Salida SMTP & Plantillas HTML';
      case 'nextjs-code': return 'Esquema de Producción Next.js 14 App Router';
      default: return 'Gestión de Viáticos';
    }
  };

  const isTabAllowed = (tab: string, role: Role): boolean => {
    if (role === 'ADMIN') return true;
    if (role === 'SOLO_LECTURA_APROBADAS') return tab === 'mis-solicitudes';
    if (role === 'SOLICITANTE' || role === 'EMPLEADO') return tab === 'mis-solicitudes' || tab === 'solicitar';
    if (role === 'JEFE') return tab === 'mis-solicitudes' || tab === 'solicitar' || tab === 'aprobar';
    if (role === 'FINANZAS') return tab === 'mis-solicitudes' || tab === 'solicitar' || tab === 'finanzas';
    return true;
  };
  const allowed = isTabAllowed(activeTab, userRole);

  return (
    <div className="flex h-screen min-h-0 min-w-0 w-full bg-[#f8fafc] font-sans text-[#1e293b] overflow-hidden">
      <Navbar
        currentUser={currentUser} allUsers={allUsers} activeTab={activeTab}
        onSelectTab={(tab) => { setActiveTab(tab); if (tab !== 'aprobar') setSelectedRequestIdForApproval(null); }}
        onSwitchUser={handleSwitchUser}
        onOpenAuthModal={(mode) => { setAuthModalMode(mode); setAuthModalOpen(true); }}
        onLogout={handleLogout} pendingApprovalsCount={pendingApprovalsCount} approvedForFinanceCount={approvedForFinanceCount}
        mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} sidebarCollapsed={!sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((prev) => !prev)}
      />

      <div className={`flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden ${currentUser ? 'bg-slate-100/90' : 'bg-gradient-to-br from-slate-950 via-[#0b1329] to-slate-950'}`}>
        <header className={`h-14 min-w-0 border-b flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 ${currentUser ? 'bg-white border-slate-200' : 'bg-slate-950/80 backdrop-blur-md border-slate-800 text-white'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setSidebarVisible((v) => !v)} className={`hidden lg:flex p-1.5 rounded-lg transition cursor-pointer ${currentUser ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title={sidebarVisible ? 'Ocultar barra de menú lateral' : 'Mostrar barra de menú lateral'}>
              {sidebarVisible ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5 text-indigo-400" />}
            </button>
            <button type="button" onClick={() => setMobileOpen(true)} className={`lg:hidden p-1.5 rounded-lg shrink-0 ${currentUser ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'}`}><Menu className="w-5 h-5" /></button>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <h2 className={`text-xs sm:text-sm font-bold truncate min-w-0 ${currentUser ? 'text-slate-800' : 'text-white'}`}>{getTabTitle()}</h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className={`hidden md:flex items-center gap-1.5 border px-2 py-1 rounded-lg text-[10px] ${currentUser ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
              <span className="font-semibold text-slate-400">Vista:</span>
              <button type="button" onClick={() => currentUser ? handleLogout() : handleSwitchUser('sistemas@dimer.com.mx')} className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer ${currentUser ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
                {currentUser ? <><ToggleRight className="w-3.5 h-3.5 text-white" /><span>Con Sesión</span></> : <><ToggleLeft className="w-3.5 h-3.5 text-slate-500" /><span>Sin Sesión</span></>}
              </button>
            </div>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /><span>Usuario:</span>
                  <strong className="text-slate-800 font-mono truncate max-w-[140px]">{currentUser.email || currentUser.name}</strong>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase font-mono ${userRole === 'ADMIN' ? 'bg-purple-100 text-purple-800' : userRole === 'SOLO_LECTURA_APROBADAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{userRole === 'SOLO_LECTURA_APROBADAS' ? 'SOLO LECTURA' : userRole}</span>
                </div>
                <button type="button" onClick={handleLogout} className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs" title="Cerrar sesión activa"><LogOut className="w-3.5 h-3.5 text-rose-600" /><span className="hidden sm:inline">Cerrar Sesión</span><span className="sm:hidden">Salir</span></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true); }} className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"><LogIn className="w-3.5 h-3.5 text-indigo-400" /><span>Iniciar Sesión</span></button>
                <button type="button" onClick={() => { setAuthModalMode('register'); setAuthModalOpen(true); }} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer">Registrarse</button>
              </div>
            )}

            {currentUser && activeTab !== 'solicitar' && !isSoloLectura && (
              <button type="button" onClick={() => setActiveTab('solicitar')} className="bg-[#0f172a] hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"><Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">NUEVA SOLICITUD</span><span className="sm:hidden">NUEVA</span></button>
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
          ) : !currentUser ? (
            <LoginView onLoginSuccess={handleUserChanged} onOpenRegisterModal={() => { setAuthModalMode('register'); setAuthModalOpen(true); }} />
          ) : !allowed ? (
            <div className="max-w-lg mx-auto my-12 bg-white p-6 rounded-2xl border border-amber-200 shadow-lg text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
              <div><h3 className="text-base font-bold text-slate-800">Acceso Restringido para este Rol</h3><p className="text-xs text-slate-600 mt-1">Tu perfil actual tiene el rol <strong>{userRole}</strong>, el cual no cuenta con permisos para ver este módulo.</p></div>
              <button onClick={() => setActiveTab('mis-solicitudes')} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition">Ir a Panel Principal</button>
            </div>
          ) : (
            <>
              {isSoloLectura && <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between text-xs text-emerald-900"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /><span><strong>Modo de Consulta Autorizada:</strong> Tienes acceso de solo lectura a las solicitudes aprobadas, pagadas y finalizadas por Dirección.</span></div><span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded font-mono">SOLO_LECTURA_APROBADAS</span></div>}
              {activeTab === 'solicitar' && <SolicitarView currentUser={currentUser} onRequestCreated={handleRequestCreated} onNavigateToApprovals={handleNavigateToApprovals} onLogout={handleLogout} />}
              {activeTab === 'mis-solicitudes' && <MisSolicitudesView currentUser={currentUser} requests={requests} onNavigateToCreate={() => setActiveTab('solicitar')} onNavigateToApprove={handleNavigateToApprovals} onOpenPrintVoucher={(req) => setPrintRequest(req)} />}
              {activeTab === 'aprobar' && <AprobarView currentUser={currentUser} selectedRequestId={selectedRequestIdForApproval} onClearSelectedRequest={() => setSelectedRequestIdForApproval(null)} onSwitchUser={handleSwitchUser} onRefreshData={fetchData} />}
              {activeTab === 'finanzas' && (
                <>
                  <FinanzasDashboard requests={safeRequests} />
                  <FinanzasView currentUser={currentUser} requests={requests} onRefreshData={fetchData} onOpenPrintVoucher={(req) => setPrintRequest(req)} />
                </>
              )}
              {activeTab === 'administracion-solicitudes' && isAdmin && (
                <AdminRequestManagement requests={safeRequests} onRefreshData={fetchData} />
              )}
              {activeTab === 'administracion-rbac' && isAdmin && (
                <AdminView currentUser={currentUser} onRefreshData={fetchData} />
              )}
              {activeTab === 'auditoria' && <AuditoriaView />}
              {activeTab === 'outbox' && <OutboxView />}
              {activeTab === 'nextjs-code' && <NextjsCodeView />}
            </>
          )}

          <footer className={`mt-6 p-2.5 rounded-lg border flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono gap-1.5 ${currentUser ? 'bg-slate-100/80 border-slate-200 text-slate-500' : 'bg-slate-950/70 border-slate-800 text-slate-400 backdrop-blur-xs'}`}>
            <div className="flex items-center gap-2 truncate"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /><span className={`font-semibold truncate ${currentUser ? 'text-slate-700' : 'text-slate-200'}`}>{lastEventText}</span></div>
            <div className="flex items-center gap-3 shrink-0 text-slate-400"><span>SMTP: ONLINE (sistemas@dimer.com.mx)</span><span>•</span><span className="text-indigo-400 font-bold">SEGURIDAD: SHA-512 + PBKDF2</span></div>
          </footer>
        </main>
      </div>

      {printRequest && <PrintVoucherModal request={printRequest} onClose={() => setPrintRequest(null)} />}
      <AuthModal isOpen={authModalOpen} initialMode={authModalMode} onClose={() => setAuthModalOpen(false)} onSuccess={(user) => handleUserChanged(user)} />
    </div>
  );
}
