export type Role = 
  | 'ADMIN' 
  | 'SOLICITANTE' 
  | 'SOLO_LECTURA_APROBADAS' 
  | 'JEFE' 
  | 'FINANZAS' 
  | 'EMPLEADO' 
  | string;

export type Status = 
  | 'BORRADOR' 
  | 'PENDIENTE_APROBACION' 
  | 'APROBADA' 
  | 'RECHAZADA' 
  | 'CANCELADA'
  | 'CORRECCION_SOLICITADA' 
  | 'PAGADA' 
  | 'FINALIZADA';

export type UserStatus = 'ACTIVO' | 'INACTIVO';

export type Permission =
  | 'ver_solicitudes'
  | 'crear_solicitudes'
  | 'editar_solicitudes'
  | 'cancelar_solicitudes'
  | 'aprobar_solicitudes'
  | 'ver_todas_solicitudes'
  | 'administrar_usuarios'
  | 'administrar_departamentos'
  | 'administrar_jefes'
  | 'administrar_roles'
  | 'ver_reportes'
  | 'administrar_configuracion';

export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  active: boolean;
  isSystem?: boolean;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt?: string;
}

export interface Boss {
  id: string;
  name: string;
  email: string;
  department: string;
  active: boolean;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: Role;
  roleId?: string;
  /** IDs de todos los roles asignados al usuario. roleId se conserva por compatibilidad. */
  roleIds?: string[];
  /** Definiciones de roles asignados, cuando están disponibles. */
  roles?: RoleDefinition[];
  permissions?: Permission[];
  status: UserStatus;
  isVerified?: boolean;
  avatar?: string;
  createdAt?: string;
}

const LEGACY_ROLE_IDS: Record<string, string> = {
  ADMIN: 'role_admin',
  JEFE: 'role_jefe',
  FINANZAS: 'role_finanzas',
  SOLO_LECTURA_APROBADAS: 'role_solo_lectura',
  SOLICITANTE: 'role_solicitante',
  EMPLEADO: 'role_empleado',
};

/** Devuelve todos los identificadores de rol conocidos del usuario, con compatibilidad legacy. */
export function getUserRoleIds(user?: User | null): string[] {
  if (!user) return [];
  const ids = [
    ...(Array.isArray(user.roleIds) ? user.roleIds : []),
    ...(Array.isArray(user.roles) ? user.roles.map(role => role.id) : []),
    user.roleId,
    LEGACY_ROLE_IDS[String(user.role || '').toUpperCase()],
  ];
  return Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)));
}

/** Comprueba un rol por nombre o por su ID, sin depender del role primario legacy. */
export function userHasRole(user: User | null | undefined, role: Role): boolean {
  if (!user) return false;
  const wantedName = String(role || '').trim().toUpperCase();
  const wantedId = LEGACY_ROLE_IDS[wantedName] || String(role || '').trim();
  if (String(user.role || '').toUpperCase() === wantedName) return true;
  if (getUserRoleIds(user).includes(wantedId)) return true;
  return Boolean(user.roles?.some(r => String(r.name || '').trim().toUpperCase() === wantedName));
}

/** Comprueba si el usuario tiene al menos uno de los roles indicados. */
export function userHasAnyRole(user: User | null | undefined, roles: Role[]): boolean {
  return roles.some(role => userHasRole(user, role));
}

export interface StoredUserRecord extends User {
  passwordHash?: string;
  salt?: string;
}

export interface VerificationRecord {
  email: string;
  code: string;
  name: string;
  department: string;
  roleId: string;
  passwordHash: string;
  salt: string;
  expiresAt: number; // timestamp in ms
  attempts: number;
}

export interface ApprovalToken {
  id: string;
  token: string;
  requestId: string;
  bossId?: string;
  bossEmail: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  action?: 'APROBADA' | 'RECHAZADA';
  createdAt: string;
}

export interface TravelRequest {
  id: string;
  folio: string;
  status: Status;
  userId: string;
  user?: User;
  requesterName?: string;
  department?: string;
  requestType?: string;
  detail?: string;
  requestDate?: string;
  urgency?: 'baja' | 'media' | 'alta' | string;
  bossId?: string;
  bossEmail: string;
  bossName?: string;
  startDate: string;
  endDate: string;
  destination: string;
  reason: string;
  amountRequested: number;
  amountAuthorized?: number | null;
  transportCost?: number;
  hotelCost?: number;
  foodCost?: number;
  miscCost?: number;
  comments?: string | null;
  approvalToken?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  requestId?: string | null;
  userId: string;
  userEmail?: string;
  userName?: string;
  action: string;
  details?: Record<string, any> | null;
  createdAt: string;
}

export interface EmailLog {
  id: string;
  requestId?: string;
  folio?: string;
  to: string;
  subject: string;
  html: string;
  status: 'ENVIADO' | 'SIMULADO' | 'FALLIDO';
  error?: string;
  createdAt: string;
}

export interface SystemStats {
  totalRequests: number;
  pendingApproval: number;
  approved: number;
  paid: number;
  rejected: number;
  correctionRequested: number;
  totalAmountRequested: number;
  totalAmountAuthorized: number;
  totalUsers?: number;
  totalDepartments?: number;
  totalBosses?: number;
  totalRoles?: number;
}
