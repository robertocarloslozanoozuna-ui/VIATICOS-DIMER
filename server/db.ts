import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  User,
  TravelRequest,
  AuditLog,
  Role,
  RoleDefinition,
  Department,
  Boss,
  ApprovalToken,
  Permission,
  UserStatus,
  Status,
} from '../src/types';

// ================= DISK PERSISTENCE STORAGE =================
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Notice: data directory creation handled:', e);
}

// ================= PASSWORD HASHING UTILITY =================
export interface StoredUserRecord extends User {
  passwordHash?: string;
  salt?: string;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
}

// Generate secure random token
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ================= 1. DEPARTMENTS STORE =================
export const DEPARTMENTS: Department[] = [
  { id: 'dept_sistemas', name: 'Sistemas', description: 'Tecnología, Infraestructura y Soporte TI', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dept_finanzas', name: 'Finanzas', description: 'Tesorería, Contabilidad y Pólizas', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dept_rh', name: 'Recursos Humanos', description: 'Gestión de Talento y Desarrollo Organizacional', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dept_produccion', name: 'Producción', description: 'Manufactura, Operaciones y Planta', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dept_compras', name: 'Compras', description: 'Adquisiciones y Proveedores', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dept_ventas', name: 'Ventas', description: 'Comercialización, Proyectos y Cuentas Clave', active: true, createdAt: '2026-01-01T00:00:00.000Z' },
];

export function getOrCreateDepartment(rawName: string): Department {
  const trimmed = rawName.trim();
  const existing = DEPARTMENTS.find(d => d.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    return existing;
  }
  const newDept: Department = {
    id: `dept_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: trimmed,
    description: `Departamento registrado automáticamente`,
    active: true,
    createdAt: new Date().toISOString(),
  };
  DEPARTMENTS.push(newDept);
  saveToDisk();
  return newDept;
}

// ================= 2. ROLES & PERMISSIONS STORE =================
export const ALL_SYSTEM_PERMISSIONS: { id: Permission; label: string; description: string; category: string }[] = [
  { id: 'ver_solicitudes', label: 'Ver mis solicitudes', description: 'Consultar solicitudes de viáticos creadas por el usuario', category: 'Viáticos' },
  { id: 'crear_solicitudes', label: 'Crear solicitudes', description: 'Generar nuevos folios de viáticos y enviarlos a autorización', category: 'Viáticos' },
  { id: 'editar_solicitudes', label: 'Editar solicitudes', description: 'Modificar solicitudes en borrador o corrección', category: 'Viáticos' },
  { id: 'cancelar_solicitudes', label: 'Cancelar solicitudes', description: 'Cancelar folios propios antes de que sean dispersados', category: 'Viáticos' },
  { id: 'aprobar_solicitudes', label: 'Aprobar solicitudes', description: 'Dictaminar, ajustar montos y autorizar viáticos como jefe', category: 'Aprobaciones' },
  { id: 'ver_todas_solicitudes', label: 'Ver todas las solicitudes', description: 'Consultar el catálogo global de solicitudes corporativas', category: 'Aprobaciones' },
  { id: 'administrar_usuarios', label: 'Administrar usuarios', description: 'Crear, editar, activar/desactivar y resetear contraseñas', category: 'Administración' },
  { id: 'administrar_departamentos', label: 'Administrar departamentos', description: 'Crear y configurar el catálogo de departamentos', category: 'Administración' },
  { id: 'administrar_jefes', label: 'Administrar jefes', description: 'Administrar el catálogo de responsables de aprobación', category: 'Administración' },
  { id: 'administrar_roles', label: 'Administrar roles', description: 'Crear roles y configurar permisos granulares', category: 'Administración' },
  { id: 'ver_reportes', label: 'Ver reportes y Finanzas', description: 'Acceder al módulo de tesorería, pólizas y dispersión SPEI', category: 'Finanzas' },
  { id: 'administrar_configuracion', label: 'Administrar configuración', description: 'Bitácora inmutable, outbox SMTP y esquemas de sistema', category: 'Administración' },
];

export const ROLES: RoleDefinition[] = [
  {
    id: 'role_admin',
    name: 'Administrador',
    description: 'Acceso total al sistema, gestión de usuarios, roles, departamentos y auditoría.',
    active: true,
    isSystem: true,
    permissions: [
      'ver_solicitudes',
      'crear_solicitudes',
      'editar_solicitudes',
      'cancelar_solicitudes',
      'aprobar_solicitudes',
      'ver_todas_solicitudes',
      'administrar_usuarios',
      'administrar_departamentos',
      'administrar_jefes',
      'administrar_roles',
      'ver_reportes',
      'administrar_configuracion',
    ],
  },
  {
    id: 'role_solicitante',
    name: 'Solicitante',
    description: 'Puede crear nuevas solicitudes y consultar exclusivamente sus propias solicitudes y su estatus.',
    active: true,
    isSystem: true,
    permissions: [
      'ver_solicitudes',
      'crear_solicitudes',
      'editar_solicitudes',
      'cancelar_solicitudes',
    ],
  },
  {
    id: 'role_solo_lectura',
    name: 'Solo Lectura de Aprobadas',
    description: 'Acceso de consulta exclusivo para visualizar solicitudes que ya fueron aprobadas en la empresa.',
    active: true,
    isSystem: true,
    permissions: [
      'ver_solicitudes',
      'ver_todas_solicitudes',
    ],
  },
  {
    id: 'role_jefe',
    name: 'Jefe / Aprobador',
    description: 'Autorización y dictamen de solicitudes de colaboradores a su cargo.',
    active: true,
    isSystem: true,
    permissions: [
      'ver_solicitudes',
      'crear_solicitudes',
      'editar_solicitudes',
      'aprobar_solicitudes',
      'ver_todas_solicitudes',
    ],
  },
  {
    id: 'role_finanzas',
    name: 'Finanzas / Tesorería',
    description: 'Revisión de solicitudes aprobadas, dispersión de transferencias SPEI y emisión de pólizas.',
    active: true,
    isSystem: true,
    permissions: [
      'ver_solicitudes',
      'ver_todas_solicitudes',
      'ver_reportes',
    ],
  },
];

// ================= 3. BOSSES CATALOG STORE =================
// Only sistemas@dimer.com.mx is the approver by default
export const BOSSES: Boss[] = [
  {
    id: 'boss_sistemas',
    name: 'Ing. Roberto Flores / Autorizaciones TI',
    email: 'sistemas@dimer.com.mx',
    department: 'Sistemas',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

// ================= 4. USERS STORE (WITH HASHED PASSWORDS) =================
const defaultSeedHash = hashPassword('password123');
const adminCustomHash = hashPassword('Carlos15');

export const USERS: StoredUserRecord[] = [
  {
    id: 'usr_adm_1',
    name: 'Ing. Sistemas Admin',
    email: 'sistemas@dimer.com.mx',
    role: 'ADMIN',
    roleId: 'role_admin',
    department: 'Sistemas',
    status: 'ACTIVO',
    isVerified: true,
    passwordHash: adminCustomHash.hash,
    salt: adminCustomHash.salt,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_sol_1',
    name: 'Roberto Lozano (Solicitante)',
    email: 'roberto.lozano@dimer.com.mx',
    role: 'SOLICITANTE',
    roleId: 'role_solicitante',
    department: 'Sistemas',
    status: 'ACTIVO',
    isVerified: true,
    passwordHash: defaultSeedHash.hash,
    salt: defaultSeedHash.salt,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_fin_1',
    name: 'CP. Laura Finanzas (Tesorería)',
    email: 'finanzas@dimer.com.mx',
    role: 'FINANZAS',
    roleId: 'role_finanzas',
    department: 'Finanzas',
    status: 'ACTIVO',
    isVerified: true,
    passwordHash: defaultSeedHash.hash,
    salt: defaultSeedHash.salt,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_lec_1',
    name: 'Lic. Auditoria (Solo Lectura Aprobadas)',
    email: 'auditoria@dimer.com.mx',
    role: 'SOLO_LECTURA_APROBADAS',
    roleId: 'role_solo_lectura',
    department: 'Dirección',
    status: 'ACTIVO',
    isVerified: true,
    passwordHash: defaultSeedHash.hash,
    salt: defaultSeedHash.salt,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

// In-Memory Verification Codes Map for New Registrations
export interface PendingVerification {
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

export const VERIFICATION_CODES = new Map<string, PendingVerification>();

// Generates a 6-digit numeric verification code (valid for 15 minutes)
export function createVerificationCode(params: {
  email: string;
  name: string;
  department: string;
  roleId?: string;
  passwordHash: string;
  salt: string;
}): { code: string; expiresAt: number } {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const cleanEmail = params.email.trim().toLowerCase();

  VERIFICATION_CODES.set(cleanEmail, {
    email: cleanEmail,
    code,
    name: params.name.trim(),
    department: params.department.trim(),
    roleId: params.roleId || 'role_solicitante',
    passwordHash: params.passwordHash,
    salt: params.salt,
    expiresAt,
    attempts: 0,
  });

  return { code, expiresAt };
}

export function verifyCodeAndActivateUser(email: string, code: string): { success: boolean; user?: StoredUserRecord; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const pending = VERIFICATION_CODES.get(cleanEmail);

  if (!pending) {
    return { success: false, error: 'No hay un código de verificación pendiente para este correo. Por favor regístrese nuevamente.' };
  }

  if (Date.now() > pending.expiresAt) {
    VERIFICATION_CODES.delete(cleanEmail);
    return { success: false, error: 'El código de verificación ha expirado (límite 15 minutos). Solicite uno nuevo.' };
  }

  if (pending.code.trim() !== code.trim()) {
    pending.attempts += 1;
    if (pending.attempts >= 5) {
      VERIFICATION_CODES.delete(cleanEmail);
      return { success: false, error: 'Demasiados intentos fallidos. Código invalidado por seguridad.' };
    }
    return { success: false, error: `Código incorrecto. Te quedan ${5 - pending.attempts} intentos.` };
  }

  // Determine role
  const isSistemas = cleanEmail.toLowerCase() === 'sistemas@dimer.com.mx';
  const roleDef = ROLES.find(r => r.id === pending.roleId) || ROLES[1]; // default solicitante
  const role: Role = isSistemas ? 'ADMIN' : (roleDef.id === 'role_admin' ? 'ADMIN' : roleDef.id === 'role_solo_lectura' ? 'SOLO_LECTURA_APROBADAS' : 'SOLICITANTE');

  // Activate & Create User in DB
  const newUser: StoredUserRecord = {
    id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: pending.name,
    email: cleanEmail,
    role,
    roleId: roleDef.id,
    department: pending.department,
    status: 'ACTIVO',
    isVerified: true,
    passwordHash: pending.passwordHash,
    salt: pending.salt,
    createdAt: new Date().toISOString(),
  };

  USERS.push(newUser);
  VERIFICATION_CODES.delete(cleanEmail);
  saveToDisk();

  return { success: true, user: newUser };
}

export function sanitizeUser(user: StoredUserRecord): User {
  const isSistemasAdmin = user.email.toLowerCase() === 'sistemas@dimer.com.mx';
  const role: Role = isSistemasAdmin ? 'ADMIN' : user.role;
  const roleId = isSistemasAdmin ? 'role_admin' : (user.roleId || (role === 'ADMIN' ? 'role_admin' : role === 'SOLO_LECTURA_APROBADAS' ? 'role_solo_lectura' : 'role_solicitante'));
  const roleDef = ROLES.find(r => r.id === roleId || r.name.toUpperCase() === String(role).toUpperCase());
  const permissions = (isSistemasAdmin || role === 'ADMIN') ? [...ROLES[0].permissions] : (roleDef ? roleDef.permissions : ROLES[1].permissions);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    department: user.department,
    role,
    roleId,
    permissions,
    status: user.status || 'ACTIVO',
    isVerified: user.isVerified ?? true,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };
}

export function hasPermission(user: User | StoredUserRecord | null | undefined, permission: Permission): boolean {
  if (!user || user.status === 'INACTIVO') return false;
  if (user.role === 'ADMIN' || user.email?.toLowerCase() === 'sistemas@dimer.com.mx') return true;
  const roleDef = ROLES.find(r => r.id === user.roleId || r.name.toUpperCase() === String(user.role).toUpperCase());
  if (!roleDef || !roleDef.active) return false;
  return roleDef.permissions.includes(permission);
}

// ================= 5. APPROVAL TOKENS STORE =================
export const APPROVAL_TOKENS: ApprovalToken[] = [
  {
    id: 'tok_init_1',
    token: 'tok_seed_req_001_carlos_director',
    requestId: 'req_001',
    bossId: 'boss_001',
    bossEmail: 'carlos.director@dimer.com.mx',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    used: false,
    createdAt: '2026-08-21T09:30:00.000Z',
  },
];

export function createApprovalToken(requestId: string, bossEmail: string, bossId?: string): ApprovalToken {
  // Expiración a 7 días
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tokenString = generateSecureToken();
  const tokenRecord: ApprovalToken = {
    id: `tok_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    token: tokenString,
    requestId,
    bossId,
    bossEmail: bossEmail.toLowerCase(),
    expiresAt,
    used: false,
    createdAt: new Date().toISOString(),
  };
  APPROVAL_TOKENS.push(tokenRecord);
  saveToDisk();
  return tokenRecord;
}

export function validateApprovalToken(tokenString: string): { valid: boolean; error?: string; tokenRecord?: ApprovalToken; request?: TravelRequest } {
  if (!tokenString) {
    return { valid: false, error: 'Token de aprobación no proporcionado' };
  }

  const tokenRecord = APPROVAL_TOKENS.find(t => t.token === tokenString);
  if (!tokenRecord) {
    return { valid: false, error: 'Token de aprobación no encontrado o inválido' };
  }

  if (tokenRecord.used) {
    return {
      valid: false,
      error: `Este enlace ya fue utilizado previamente el ${new Date(tokenRecord.usedAt || '').toLocaleString('es-MX')} (${tokenRecord.action || 'PROCESADO'}). Por seguridad, cada token solo puede emplearse una vez.`,
      tokenRecord,
    };
  }

  if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
    return { valid: false, error: 'El enlace de aprobación ha expirado. Contacte al solicitante para emitir una revalidación.', tokenRecord };
  }

  const request = TRAVEL_REQUESTS.find(r => r.id === tokenRecord.requestId);
  if (!request) {
    return { valid: false, error: 'La solicitud asociada a este token ya no existe', tokenRecord };
  }

  return { valid: true, tokenRecord, request };
}

export function consumeApprovalToken(tokenString: string, action: 'APROBADA' | 'RECHAZADA'): boolean {
  const tokenRecord = APPROVAL_TOKENS.find(t => t.token === tokenString);
  if (!tokenRecord || tokenRecord.used) return false;
  tokenRecord.used = true;
  tokenRecord.usedAt = new Date().toISOString();
  tokenRecord.action = action;
  saveToDisk();
  return true;
}

// ================= 6. TRAVEL REQUESTS STORE =================
let folioSequence = 4;

export const TRAVEL_REQUESTS: TravelRequest[] = [
  {
    id: 'req_001',
    folio: 'VIAT-2026-000001',
    status: 'PENDIENTE_APROBACION',
    userId: 'usr_sol_1',
    requesterName: 'Roberto Lozano',
    department: 'Sistemas',
    requestType: 'Viáticos y Gastos de Viaje',
    detail: 'Reunión de cierre con cliente industrial para proyecto de automatización y auditoría en planta.',
    requestDate: '2026-08-21',
    urgency: 'alta',
    bossId: 'boss_sistemas',
    bossEmail: 'sistemas@dimer.com.mx',
    bossName: 'Ing. Roberto Flores / Autorizaciones TI',
    startDate: '2026-08-25T00:00:00.000Z',
    endDate: '2026-08-28T00:00:00.000Z',
    destination: 'Monterrey, N.L.',
    reason: 'Reunión de cierre con cliente industrial para proyecto de automatización y auditoría en planta.',
    amountRequested: 14850.00,
    amountAuthorized: null,
    transportCost: 5000,
    hotelCost: 6000,
    foodCost: 3000,
    miscCost: 850,
    comments: 'Incluye vuelos, 3 noches de hospedaje en zona San Pedro y viáticos diarios según tabulador.',
    approvalToken: 'tok_seed_req_001_sistemas',
    createdAt: '2026-08-21T09:30:00.000Z',
  },
  {
    id: 'req_002',
    folio: 'VIAT-2026-000002',
    status: 'APROBADA',
    userId: 'usr_sol_1',
    requesterName: 'Roberto Lozano',
    department: 'Sistemas',
    requestType: 'Viáticos y Gastos de Viaje',
    detail: 'Participación en Expo Industrial 2026 y visitas técnicas a socios estratégicos.',
    requestDate: '2026-08-20',
    urgency: 'media',
    bossId: 'boss_sistemas',
    bossEmail: 'sistemas@dimer.com.mx',
    bossName: 'Ing. Roberto Flores / Autorizaciones TI',
    startDate: '2026-09-02T00:00:00.000Z',
    endDate: '2026-09-04T00:00:00.000Z',
    destination: 'Guadalajara, Jal.',
    reason: 'Participación en Expo Industrial 2026 y visitas técnicas a socios estratégicos.',
    amountRequested: 12000.00,
    amountAuthorized: 11000.00,
    transportCost: 4000,
    hotelCost: 4500,
    foodCost: 2500,
    miscCost: 1000,
    comments: 'Aprobado con ajuste de $1,000 en hotel corporativo con convenio.',
    approvedBy: 'sistemas@dimer.com.mx',
    approvedAt: '2026-08-20T16:45:00.000Z',
    createdAt: '2026-08-20T14:15:00.000Z',
  },
  {
    id: 'req_003',
    folio: 'VIAT-2026-000003',
    status: 'PAGADA',
    userId: 'usr_sol_1',
    requesterName: 'Roberto Lozano',
    department: 'Sistemas',
    requestType: 'Servicios y Mantenimiento',
    detail: 'Instalación de servidores y entrega de infraestructura en nuevo centro logístico.',
    requestDate: '2026-08-08',
    urgency: 'baja',
    bossId: 'boss_sistemas',
    bossEmail: 'sistemas@dimer.com.mx',
    bossName: 'Ing. Roberto Flores / Autorizaciones TI',
    startDate: '2026-08-10T00:00:00.000Z',
    endDate: '2026-08-12T00:00:00.000Z',
    destination: 'Querétaro, Qro.',
    reason: 'Instalación de servidores y entrega de infraestructura en nuevo centro logístico.',
    amountRequested: 8500.00,
    amountAuthorized: 8500.00,
    comments: 'Dispersado vía transferencia SPEI folio 89123.',
    approvedBy: 'sistemas@dimer.com.mx',
    approvedAt: '2026-08-08T15:20:00.000Z',
    createdAt: '2026-08-08T11:00:00.000Z',
  },
];

// ================= 7. AUDIT LOGS STORE =================
export const AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_001',
    requestId: 'req_003',
    userId: 'usr_sol_1',
    userName: 'Roberto Lozano (Solicitante)',
    userEmail: 'roberto.lozano@dimer.com.mx',
    action: 'CREACION_SOLICITUD',
    details: { folio: 'VIAT-2026-000003', amountRequested: 8500, destination: 'Querétaro, Qro.', bossEmail: 'sistemas@dimer.com.mx' },
    createdAt: '2026-08-08T11:00:00.000Z',
  },
  {
    id: 'aud_002',
    requestId: 'req_003',
    userId: 'usr_adm_1',
    userName: 'Ing. Roberto Flores / Autorizaciones TI',
    userEmail: 'sistemas@dimer.com.mx',
    action: 'APROBACION_JEFE',
    details: { folio: 'VIAT-2026-000003', amountAuthorized: 8500, comments: 'Aprobado sin observaciones' },
    createdAt: '2026-08-08T15:20:00.000Z',
  },
  {
    id: 'aud_003',
    requestId: 'req_003',
    userId: 'usr_fin_1',
    userName: 'CP. Laura Finanzas (Tesorería)',
    userEmail: 'finanzas@dimer.com.mx',
    action: 'DISPERSION_PAGO',
    details: { folio: 'VIAT-2026-000003', amountPaid: 8500, reference: 'SPEI-89123' },
    createdAt: '2026-08-09T10:00:00.000Z',
  },
  {
    id: 'aud_004',
    requestId: 'req_002',
    userId: 'usr_sol_1',
    userName: 'Roberto Lozano (Solicitante)',
    userEmail: 'roberto.lozano@dimer.com.mx',
    action: 'CREACION_SOLICITUD',
    details: { folio: 'VIAT-2026-000002', amountRequested: 12000, destination: 'Guadalajara, Jal.', bossEmail: 'sistemas@dimer.com.mx' },
    createdAt: '2026-08-20T14:15:00.000Z',
  },
  {
    id: 'aud_005',
    requestId: 'req_002',
    userId: 'usr_adm_1',
    userName: 'Ing. Roberto Flores / Autorizaciones TI',
    userEmail: 'sistemas@dimer.com.mx',
    action: 'APROBACION_JEFE',
    details: { folio: 'VIAT-2026-000002', amountRequested: 12000, amountAuthorized: 11000, adjustment: -1000 },
    createdAt: '2026-08-20T16:45:00.000Z',
  },
  {
    id: 'aud_006',
    requestId: 'req_001',
    userId: 'usr_sol_1',
    userName: 'Roberto Lozano (Solicitante)',
    userEmail: 'roberto.lozano@dimer.com.mx',
    action: 'CREACION_SOLICITUD',
    details: { folio: 'VIAT-2026-000001', amountRequested: 14850, bossEmail: 'sistemas@dimer.com.mx' },
    createdAt: '2026-08-21T09:30:00.000Z',
  },
];

// ================= DISK PERSISTENCE ENGINE =================
export function saveToDisk(): void {
  try {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      folioSequence,
      users: USERS,
      departments: DEPARTMENTS,
      roles: ROLES,
      bosses: BOSSES,
      travelRequests: TRAVEL_REQUESTS,
      approvalTokens: APPROVAL_TOKENS,
      auditLogs: AUDIT_LOGS,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data store to disk:', err);
  }
}

export function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      // First boot: create initial persistent file
      saveToDisk();
      return;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);

    if (data.users && Array.isArray(data.users)) {
      USERS.length = 0;
      USERS.push(...data.users);

      // Ensure root admin account always exists and has ADMIN role
      const adminIdx = USERS.findIndex(u => u.email.toLowerCase() === 'sistemas@dimer.com.mx');
      if (adminIdx >= 0) {
        USERS[adminIdx].role = 'ADMIN';
        USERS[adminIdx].roleId = 'role_admin';
        USERS[adminIdx].status = 'ACTIVO';
        USERS[adminIdx].isVerified = true;
      } else {
        USERS.unshift({
          id: 'usr_adm_1',
          name: 'Ing. Sistemas Admin',
          email: 'sistemas@dimer.com.mx',
          role: 'ADMIN',
          roleId: 'role_admin',
          department: 'Sistemas',
          status: 'ACTIVO',
          isVerified: true,
          passwordHash: adminCustomHash.hash,
          salt: adminCustomHash.salt,
          createdAt: '2026-01-01T00:00:00.000Z',
        });
      }
    }
    if (data.departments && Array.isArray(data.departments)) {
      DEPARTMENTS.length = 0;
      DEPARTMENTS.push(...data.departments);
    }
    if (data.roles && Array.isArray(data.roles)) {
      ROLES.length = 0;
      ROLES.push(...data.roles);
    }
    if (data.bosses && Array.isArray(data.bosses)) {
      BOSSES.length = 0;
      BOSSES.push(...data.bosses);
    }
    if (data.travelRequests && Array.isArray(data.travelRequests)) {
      TRAVEL_REQUESTS.length = 0;
      TRAVEL_REQUESTS.push(...data.travelRequests);
    }
    if (data.approvalTokens && Array.isArray(data.approvalTokens)) {
      APPROVAL_TOKENS.length = 0;
      APPROVAL_TOKENS.push(...data.approvalTokens);
    }
    if (data.auditLogs && Array.isArray(data.auditLogs)) {
      AUDIT_LOGS.length = 0;
      AUDIT_LOGS.push(...data.auditLogs);
    }
    if (typeof data.folioSequence === 'number') {
      folioSequence = data.folioSequence;
    }
    console.log(`[DIMER DB] Successfully loaded persistent store from ${DATA_FILE} (${USERS.length} users, ${TRAVEL_REQUESTS.length} requests)`);
  } catch (err) {
    console.error('Error loading persistent store from disk:', err);
  }
}

// Load on module initialization
loadFromDisk();

// ================= SESSION & HELPER FUNCTIONS =================
let currentSessionUserId: string | null = null; // Unauthenticated by default: user must log in

export function getCurrentUser(): User | null {
  if (!currentSessionUserId) {
    return null;
  }
  const found = USERS.find(u => u.id === currentSessionUserId);
  return found ? sanitizeUser(found) : null;
}

export function clearCurrentUser(): void {
  currentSessionUserId = null;
}

export function setCurrentUser(userOrEmail: string | User | null): User | null {
  if (userOrEmail === null) {
    currentSessionUserId = null;
    return null;
  }
  if (typeof userOrEmail === 'string') {
    const clean = userOrEmail.trim().toLowerCase();
    const found = USERS.find(u => u.email.toLowerCase() === clean || u.id === userOrEmail);
    if (found) {
      currentSessionUserId = found.id;
      return sanitizeUser(found);
    }
    // Si no existe, crear usuario con rol adecuado
    const isBoss = clean.includes('jefe') || clean.includes('director');
    const isFin = clean.includes('finanzas');
    const isAdmin = clean.includes('admin') || clean.includes('sistemas');
    const role: Role = isAdmin ? 'ADMIN' : isBoss ? 'JEFE' : isFin ? 'FINANZAS' : 'SOLICITANTE';
    const roleId = isAdmin ? 'role_admin' : isBoss ? 'role_jefe' : isFin ? 'role_finanzas' : 'role_solicitante';
    const defaultDept = isBoss ? 'Ventas' : isFin ? 'Finanzas' : isAdmin ? 'Sistemas' : 'Ventas';

    const newHashed = hashPassword('password123');
    const newUser: StoredUserRecord = {
      id: `usr_${Date.now()}`,
      name: userOrEmail.split('@')[0],
      email: clean,
      role,
      roleId,
      department: defaultDept,
      status: 'ACTIVO',
      passwordHash: newHashed.hash,
      salt: newHashed.salt,
      createdAt: new Date().toISOString(),
    };
    USERS.push(newUser);
    saveToDisk();
    currentSessionUserId = newUser.id;
    return sanitizeUser(newUser);
  }
  currentSessionUserId = userOrEmail.id;
  return sanitizeUser(USERS.find(u => u.id === userOrEmail.id) || USERS[0]);
}

export function generateNextFolio(): string {
  const currentYear = new Date().getFullYear();
  const sequenceStr = String(folioSequence++).padStart(6, '0');
  saveToDisk();
  return `VIAT-${currentYear}-${sequenceStr}`;
}

export function recordAuditLog(params: {
  requestId?: string | null;
  userId: string;
  action: string;
  details?: Record<string, any>;
}): AuditLog {
  const user = USERS.find(u => u.id === params.userId);
  const newLog: AuditLog = {
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    requestId: params.requestId || null,
    userId: params.userId,
    userName: user?.name || 'Sistema / Token Seguro',
    userEmail: user?.email || params.details?.userEmail || 'N/A',
    action: params.action,
    details: params.details || null,
    createdAt: new Date().toISOString(),
  };
  AUDIT_LOGS.unshift(newLog);
  saveToDisk();
  return newLog;
}

export function getPopulatedRequests(): TravelRequest[] {
  return TRAVEL_REQUESTS.map(req => {
    const userRecord = USERS.find(u => u.id === req.userId);
    return {
      ...req,
      user: userRecord ? sanitizeUser(userRecord) : undefined,
    };
  });
}
