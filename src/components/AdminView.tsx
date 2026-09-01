import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Building2,
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Mail,
  Key,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  FolderLock
} from 'lucide-react';
import type { User, RoleDefinition, Department, Boss, Permission, SystemStats } from '../types';

interface AdminViewProps {
  currentUser: User | null;
  onRefreshData: () => void;
}

// Helper to safely parse JSON responses or extract server error message
async function safeParseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText || 'Error en el servidor'}`);
    }
    return { success: true };
  }
}

export default function AdminView({ currentUser, onRefreshData }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'departments' | 'bosses' | 'overview'>('users');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data states
  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<RoleDefinition[]>([]);
  const [deptList, setDeptList] = useState<Department[]>([]);
  const [bossList, setBossList] = useState<Boss[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Search filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & form states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDept, setUserDept] = useState('');
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [customDeptName, setCustomDeptName] = useState('');
  const [userRoleId, setUserRoleId] = useState('role_empleado');
  const [userStatus, setUserStatus] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');

  // Role Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDescription, setDeptDescription] = useState('');

  // Boss Modal State
  const [showBossModal, setShowBossModal] = useState(false);
  const [editingBoss, setEditingBoss] = useState<Boss | null>(null);
  const [bossName, setBossName] = useState('');
  const [bossEmail, setBossEmail] = useState('');
  const [bossDept, setBossDept] = useState('');

  // Load all administrative data
  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, permRes, deptRes, bossRes, statsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/roles'),
        fetch('/api/permissions'),
        fetch('/api/departments'),
        fetch('/api/bosses'),
        fetch('/api/stats'),
      ]);

      if (usersRes.ok) {
        const u = await usersRes.json();
        if (Array.isArray(u)) setUsersList(u);
      }
      if (rolesRes.ok) {
        const r = await rolesRes.json();
        if (Array.isArray(r)) setRolesList(r);
      }
      if (permRes.ok) {
        const p = await permRes.json();
        if (Array.isArray(p)) setAllPermissions(p);
      }
      if (deptRes.ok) {
        const d = await deptRes.json();
        if (Array.isArray(d)) setDeptList(d);
      }
      if (bossRes.ok) {
        const b = await bossRes.json();
        if (Array.isArray(b)) setBossList(b);
      }
      if (statsRes.ok) {
        const s = await statsRes.json();
        if (s && typeof s === 'object') setStats(s);
      }
    } catch (err: any) {
      console.error('Error cargando catálogos de administración:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ================= USERS HANDLERS =================
  const handleOpenNewUserModal = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserDept(deptList[0]?.name || 'Ventas');
    setIsCustomDept(false);
    setCustomDeptName('');
    setUserRoleId(rolesList[3]?.id || 'role_empleado');
    setUserStatus('ACTIVO');
    setShowUserModal(true);
  };

  const handleOpenEditUserModal = (user: User) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPassword(''); // Leave blank if keeping current password
    setUserDept(user.department);
    setIsCustomDept(false);
    setCustomDeptName('');
    setUserRoleId(user.roleId || (rolesList.find(r => r.name.toUpperCase() === String(user.role).toUpperCase())?.id || 'role_empleado'));
    setUserStatus(user.status || 'ACTIVO');
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDept = isCustomDept ? customDeptName.trim() : userDept;

    if (!userName.trim() || !userEmail.trim()) {
      showNotification('error', 'El nombre y correo son obligatorios.');
      return;
    }
    if (!editingUser && !userPassword.trim()) {
      showNotification('error', 'La contraseña es obligatoria para nuevos usuarios.');
      return;
    }
    if (!finalDept) {
      showNotification('error', 'Por favor especifique un departamento.');
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName.trim(),
            email: userEmail.trim(),
            department: finalDept,
            roleId: userRoleId,
            status: userStatus,
            password: userPassword.trim() ? userPassword.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
        showNotification('success', `Usuario ${data.user.name} actualizado con éxito.`);
      } else {
        // Create user
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName.trim(),
            email: userEmail.trim(),
            password: userPassword.trim(),
            department: finalDept,
            roleId: userRoleId,
            status: userStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar usuario');
        showNotification('success', `Usuario ${data.user.name} registrado con contraseña encriptada.`);
      }

      setShowUserModal(false);
      loadAllAdminData();
      onRefreshData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al cambiar estado');
      }
      showNotification('success', `Estado de ${user.name} cambiado a ${newStatus}`);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.email.toLowerCase() === 'sistemas@dimer.com.mx') {
      showNotification('error', 'No se puede eliminar la cuenta principal de administración (sistemas@dimer.com.mx).');
      return;
    }

    const confirmMsg = `¿Está seguro de que desea eliminar la cuenta de "${user.name}" (${user.email})?\n\nEsta acción eliminará permanentemente la cuenta de la base de datos persistente.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');

      showNotification('success', `Cuenta de ${user.name} eliminada permanentemente del sistema.`);
      loadAllAdminData();
      onRefreshData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // ================= ROLES HANDLERS =================
  const handleOpenNewRoleModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRolePermissions(['ver_solicitudes', 'crear_solicitudes']);
    setShowRoleModal(true);
  };

  const handleOpenEditRoleModal = (role: RoleDefinition) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setRolePermissions([...role.permissions]);
    setShowRoleModal(true);
  };

  const handleTogglePermission = (permId: Permission) => {
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      showNotification('error', 'El nombre del rol es obligatorio.');
      return;
    }

    try {
      if (editingRole) {
        const res = await fetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: roleName.trim(),
            description: roleDescription.trim(),
            permissions: rolePermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar rol');
        showNotification('success', `Rol ${data.role.name} actualizado exitosamente.`);
      } else {
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: roleName.trim(),
            description: roleDescription.trim(),
            permissions: rolePermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear rol');
        showNotification('success', `Nuevo rol ${data.role.name} creado exitosamente.`);
      }

      setShowRoleModal(false);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleToggleRoleActive = async (role: RoleDefinition) => {
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !role.active }),
      });
      if (!res.ok) throw new Error('Error al actualizar estado del rol');
      showNotification('success', `Rol ${role.name} ${!role.active ? 'activado' : 'desactivado'}.`);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // ================= DEPARTMENTS HANDLERS =================
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) {
      showNotification('error', 'El nombre del departamento es obligatorio.');
      return;
    }

    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptName.trim(),
          description: deptDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar departamento');
      showNotification('success', `Departamento ${data.department.name} registrado con éxito.`);
      setDeptName('');
      setDeptDescription('');
      setShowDeptModal(false);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // ================= BOSSES HANDLERS =================
  const handleOpenNewBossModal = () => {
    setEditingBoss(null);
    setBossName('');
    setBossEmail('');
    setBossDept(deptList[0]?.name || 'Ventas');
    setShowBossModal(true);
  };

  const handleOpenEditBossModal = (boss: Boss) => {
    setEditingBoss(boss);
    setBossName(boss.name);
    setBossEmail(boss.email);
    setBossDept(boss.department);
    setShowBossModal(true);
  };

  const handleSaveBoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bossName.trim() || !bossEmail.trim() || !bossDept) {
      showNotification('error', 'Nombre, correo y departamento son requeridos.');
      return;
    }

    try {
      if (editingBoss) {
        const res = await fetch(`/api/bosses/${encodeURIComponent(editingBoss.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: bossName.trim(),
            email: bossEmail.trim().toLowerCase(),
            department: bossDept,
          }),
        });
        const data = await safeParseJson(res);
        if (!res.ok) throw new Error(data.error || 'Error al actualizar jefe');
        showNotification('success', `Jefe ${data.boss?.name || bossName} actualizado con éxito.`);
      } else {
        const res = await fetch('/api/bosses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: bossName.trim(),
            email: bossEmail.trim().toLowerCase(),
            department: bossDept,
          }),
        });
        const data = await safeParseJson(res);
        if (!res.ok) throw new Error(data.error || 'Error al registrar jefe');
        showNotification('success', `Jefe ${data.boss?.name || bossName} añadido al catálogo de aprobadores.`);
      }

      setShowBossModal(false);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message || 'Error al procesar jefe');
    }
  };

  const handleToggleBossActive = async (boss: Boss) => {
    try {
      const res = await fetch(`/api/bosses/${encodeURIComponent(boss.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !boss.active }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.error || 'Error al actualizar estado del jefe');
      showNotification('success', `Jefe ${boss.name} ${!boss.active ? 'activado' : 'inactivado'}.`);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message || 'Error al actualizar estado');
    }
  };

  const handleDeleteBoss = async (boss: Boss) => {
    if (!window.confirm(`¿Está seguro de eliminar a "${boss.name}" del catálogo de jefes aprobadores?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/bosses/${encodeURIComponent(boss.id)}`, {
        method: 'DELETE',
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.error || 'Error al eliminar jefe');
      showNotification('success', `Jefe ${boss.name} eliminado del catálogo.`);
      loadAllAdminData();
    } catch (err: any) {
      showNotification('error', err.message || 'Error al eliminar jefe');
    }
  };

  // Filtered lists
  const safeUsersList = Array.isArray(usersList) ? usersList : [];
  const safeBossList = Array.isArray(bossList) ? bossList : [];

  const filteredUsers = safeUsersList.filter(
    (u) =>
      u &&
      (String(u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(u.department || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredBosses = safeBossList.filter(
    (b) =>
      b &&
      (String(b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(b.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(b.department || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-[#0f172a] text-white p-4 rounded-xl border border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 uppercase font-mono">
              Módulo de Administración
            </span>
            <span className="text-[10px] text-slate-400 font-mono">RBAC & Catálogos</span>
          </div>
          <h1 className="text-base font-bold text-white mt-0.5">Gestión de Usuarios, Roles, Departamentos y Jefes</h1>
          <p className="text-xs text-slate-400">
            Control de accesos con hashing de contraseñas, asignación de permisos granulares y catálogo de aprobadores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllAdminData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 p-1 flex flex-wrap gap-1 shadow-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
            activeTab === 'users' ? 'bg-[#0f172a] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Usuarios ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
            activeTab === 'roles' ? 'bg-[#0f172a] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Roles & Permisos ({rolesList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
            activeTab === 'departments' ? 'bg-[#0f172a] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Departamentos ({deptList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bosses')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
            activeTab === 'bosses' ? 'bg-[#0f172a] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Jefes / Aprobadores ({bossList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
            activeTab === 'overview' ? 'bg-[#0f172a] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Control Global</span>
        </button>
      </div>

      {/* ================= TAB 1: USUARIOS ================= */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo o área..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleOpenNewUserModal}
              className="w-full sm:w-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Nuevo Usuario</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Colaborador / Correo</th>
                  <th className="py-2.5 px-3">Departamento</th>
                  <th className="py-2.5 px-3">Rol Asignado</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{user.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {user.department || 'Sin área'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : user.role === 'JEFE'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : user.role === 'FINANZAS'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleUserStatus(user)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                          user.status === 'ACTIVO'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVO' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        <span>{user.status || 'ACTIVO'}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditUserModal(user)}
                          className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition inline-flex items-center gap-1 font-semibold text-[11px]"
                          title="Editar usuario o modificar rol"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        {user.email.toLowerCase() !== 'sistemas@dimer.com.mx' && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition inline-flex items-center"
                            title="Eliminar cuenta de usuario permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ROLES & PERMISOS ================= */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Configura los perfiles de acceso empresarial y los permisos independientes de cada rol.
            </p>
            <button
              onClick={handleOpenNewRoleModal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Nuevo Rol</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rolesList.map((role) => (
              <div key={role.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{role.name}</h3>
                    {role.isSystem && (
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        Sistema
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleRoleActive(role)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                        role.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {role.active ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => handleOpenEditRoleModal(role)}
                      className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">{role.description || 'Sin descripción'}</p>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                    Permisos Asignados ({role.permissions.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.5 rounded border border-indigo-100"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: DEPARTAMENTOS ================= */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Catálogo de Departamentos</h2>
              <p className="text-[11px] text-slate-500">
                Los departamentos registrados aparecen automáticamente en los menús de selección de solicitudes y usuarios.
              </p>
            </div>
            <button
              onClick={() => setShowDeptModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Departamento</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {deptList.map((dept) => {
              const membersCount = safeUsersList.filter((u) => u?.department === dept.name).length;
              return (
                <div key={dept.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{dept.name}</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono">
                      {membersCount} usuario(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{dept.description || 'Área corporativa'}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 4: JEFES / APROBADORES ================= */}
      {activeTab === 'bosses' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar jefe o aprobador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleOpenNewBossModal}
              className="w-full sm:w-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Jefe / Aprobador</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Nombre del Jefe</th>
                  <th className="py-2.5 px-3">Correo Notificaciones</th>
                  <th className="py-2.5 px-3">Departamento</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBosses.map((boss) => (
                  <tr key={boss.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{boss.name}</td>
                    <td className="py-2.5 px-3 text-indigo-600 font-mono text-[11px]">{boss.email}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {boss.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleBossActive(boss)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                          boss.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {boss.active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditBossModal(boss)}
                          className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition inline-flex items-center gap-1 font-semibold text-[11px]"
                          title="Editar información de jefe"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBoss(boss)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition inline-flex items-center"
                          title="Eliminar jefe del catálogo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: CONTROL GLOBAL ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Usuarios Totales</span>
              <div className="text-xl font-black text-slate-900 mt-1">{usersList.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Departamentos</span>
              <div className="text-xl font-black text-slate-900 mt-1">{deptList.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Jefes Aprobadores</span>
              <div className="text-xl font-black text-slate-900 mt-1">{bossList.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Roles Activos</span>
              <div className="text-xl font-black text-slate-900 mt-1">{rolesList.length}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Políticas de Seguridad y Cifrado
            </h3>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
              <li>
                <strong>Hashing Criptográfico de Contraseñas:</strong> Implementado con SHA-512 + Salt aleatorio de 16 bytes mediante PBKDF2 (10,000 iteraciones). Las contraseñas nunca se almacenan ni se transmiten en texto plano.
              </li>
              <li>
                <strong>Enlaces Tokenizados de Un Solo Uso:</strong> Cada solicitud genera un token criptográfico de 64 caracteres hex con expiración a 7 días. Al ser dictaminada la solicitud, el token se invalida permanentemente.
              </li>
              <li>
                <strong>Notificación Automática a Sistemas:</strong> Las aprobaciones de jefatura disparan una alerta por correo a <code className="font-mono text-indigo-600">sistemas@dimer.com.mx</code> y al área de Finanzas.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ================= MODAL: USUARIO ================= */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden">
            <div className="bg-[#0f172a] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingUser ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
                </h3>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ej. Ing. Roberto Flores"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="roberto.flores@dimer.com.mx"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Contraseña {editingUser && '(Dejar vacío para conservar actual)'} *
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
                <span className="text-[10px] text-slate-500">Se encriptará con SHA-512 + Salt.</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Departamento *</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomDept(!isCustomDept)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold"
                  >
                    {isCustomDept ? 'Elegir existente' : '+ Nuevo Departamento'}
                  </button>
                </div>

                {isCustomDept ? (
                  <input
                    type="text"
                    required
                    value={customDeptName}
                    onChange={(e) => setCustomDeptName(e.target.value)}
                    placeholder="Escriba el nombre del nuevo departamento..."
                    className="w-full px-3 py-1.5 border border-indigo-300 bg-indigo-50/50 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                ) : (
                  <select
                    value={userDept}
                    onChange={(e) => setUserDept(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {deptList.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rol Asignado *</label>
                  <select
                    value={userRoleId}
                    onChange={(e) => setUserRoleId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estado *</label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold shadow-xs"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ROL Y PERMISOS ================= */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-lg w-full overflow-hidden">
            <div className="bg-[#0f172a] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingRole ? `Editar Rol: ${editingRole.name}` : 'Crear Nuevo Rol'}
                </h3>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Ej. Auditor de Calidad"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Descripción de responsabilidades y alcance..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Permisos del Sistema ({rolePermissions.length} seleccionados):
                </label>
                <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                  {allPermissions.map((perm) => {
                    const isChecked = rolePermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition ${
                          isChecked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-[11px]">{perm.label}</div>
                          <div className="text-[10px] text-slate-500">{perm.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold shadow-xs"
                >
                  Guardar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DEPARTAMENTO ================= */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-sm w-full overflow-hidden">
            <div className="bg-[#0f172a] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">Nuevo Departamento</h3>
              </div>
              <button
                onClick={() => setShowDeptModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Departamento *</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Ej. Logística y Distribución"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={deptDescription}
                  onChange={(e) => setDeptDescription(e.target.value)}
                  placeholder="Funciones del área..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold shadow-xs"
                >
                  Crear Departamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: JEFE / APROBADOR ================= */}
      {showBossModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden">
            <div className="bg-[#0f172a] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingBoss ? 'Editar Jefe / Aprobador' : 'Registrar Jefe / Aprobador'}
                </h3>
              </div>
              <button
                onClick={() => setShowBossModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveBoss} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={bossName}
                  onChange={(e) => setBossName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={bossEmail}
                  onChange={(e) => setBossEmail(e.target.value)}
                  placeholder="juan.perez@dimer.com.mx"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Departamento Asociado *</label>
                <select
                  value={bossDept}
                  onChange={(e) => setBossDept(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  {deptList.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBossModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold shadow-xs"
                >
                  Guardar Jefe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
