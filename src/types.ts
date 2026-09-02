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
  permissions?: Permission[];
  status: UserStatus;
  isVerified?: boolean;
  avatar?: string;
  createdAt?: string;
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

