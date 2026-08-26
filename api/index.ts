// @ts-nocheck
// Auto-bundled standalone Serverless Function for Vercel (@vercel/node)
// server/app.ts
import express from "express";
import cors from "cors";

// server/db.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
var DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
var DATA_FILE = path.join(DATA_DIR, "db.json");
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Notice: data directory creation handled:", e);
}
function hashPassword(password, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  const calculated = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
}
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}
var DEPARTMENTS = [
  { id: "dept_sistemas", name: "Sistemas", description: "Tecnolog\xEDa, Infraestructura y Soporte TI", active: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "dept_finanzas", name: "Finanzas", description: "Tesorer\xEDa, Contabilidad y P\xF3lizas", active: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "dept_rh", name: "Recursos Humanos", description: "Gesti\xF3n de Talento y Desarrollo Organizacional", active: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "dept_produccion", name: "Producci\xF3n", description: "Manufactura, Operaciones y Planta", active: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "dept_compras", name: "Compras", description: "Adquisiciones y Proveedores", active: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "dept_ventas", name: "Ventas", description: "Comercializaci\xF3n, Proyectos y Cuentas Clave", active: true, createdAt: "2026-01-01T00:00:00.000Z" }
];
function getOrCreateDepartment(rawName) {
  const trimmed = rawName.trim();
  const existing = DEPARTMENTS.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    return existing;
  }
  const newDept = {
    id: `dept_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    name: trimmed,
    description: `Departamento registrado autom\xE1ticamente`,
    active: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  DEPARTMENTS.push(newDept);
  saveToDisk();
  return newDept;
}
var ALL_SYSTEM_PERMISSIONS = [
  { id: "ver_solicitudes", label: "Ver mis solicitudes", description: "Consultar solicitudes de vi\xE1ticos creadas por el usuario", category: "Vi\xE1ticos" },
  { id: "crear_solicitudes", label: "Crear solicitudes", description: "Generar nuevos folios de vi\xE1ticos y enviarlos a autorizaci\xF3n", category: "Vi\xE1ticos" },
  { id: "editar_solicitudes", label: "Editar solicitudes", description: "Modificar solicitudes en borrador o correcci\xF3n", category: "Vi\xE1ticos" },
  { id: "cancelar_solicitudes", label: "Cancelar solicitudes", description: "Cancelar folios propios antes de que sean dispersados", category: "Vi\xE1ticos" },
  { id: "aprobar_solicitudes", label: "Aprobar solicitudes", description: "Dictaminar, ajustar montos y autorizar vi\xE1ticos como jefe", category: "Aprobaciones" },
  { id: "ver_todas_solicitudes", label: "Ver todas las solicitudes", description: "Consultar el cat\xE1logo global de solicitudes corporativas", category: "Aprobaciones" },
  { id: "administrar_usuarios", label: "Administrar usuarios", description: "Crear, editar, activar/desactivar y resetear contrase\xF1as", category: "Administraci\xF3n" },
  { id: "administrar_departamentos", label: "Administrar departamentos", description: "Crear y configurar el cat\xE1logo de departamentos", category: "Administraci\xF3n" },
  { id: "administrar_jefes", label: "Administrar jefes", description: "Administrar el cat\xE1logo de responsables de aprobaci\xF3n", category: "Administraci\xF3n" },
  { id: "administrar_roles", label: "Administrar roles", description: "Crear roles y configurar permisos granulares", category: "Administraci\xF3n" },
  { id: "ver_reportes", label: "Ver reportes y Finanzas", description: "Acceder al m\xF3dulo de tesorer\xEDa, p\xF3lizas y dispersi\xF3n SPEI", category: "Finanzas" },
  { id: "administrar_configuracion", label: "Administrar configuraci\xF3n", description: "Bit\xE1cora inmutable, outbox SMTP y esquemas de sistema", category: "Administraci\xF3n" }
];
var ROLES = [
  {
    id: "role_admin",
    name: "Administrador",
    description: "Acceso total al sistema, gesti\xF3n de usuarios, roles, departamentos y auditor\xEDa.",
    active: true,
    isSystem: true,
    permissions: [
      "ver_solicitudes",
      "crear_solicitudes",
      "editar_solicitudes",
      "cancelar_solicitudes",
      "aprobar_solicitudes",
      "ver_todas_solicitudes",
      "administrar_usuarios",
      "administrar_departamentos",
      "administrar_jefes",
      "administrar_roles",
      "ver_reportes",
      "administrar_configuracion"
    ]
  },
  {
    id: "role_solicitante",
    name: "Solicitante",
    description: "Puede crear nuevas solicitudes y consultar exclusivamente sus propias solicitudes y su estatus.",
    active: true,
    isSystem: true,
    permissions: [
      "ver_solicitudes",
      "crear_solicitudes",
      "editar_solicitudes",
      "cancelar_solicitudes"
    ]
  },
  {
    id: "role_solo_lectura",
    name: "Solo Lectura de Aprobadas",
    description: "Acceso de consulta exclusivo para visualizar solicitudes que ya fueron aprobadas en la empresa.",
    active: true,
    isSystem: true,
    permissions: [
      "ver_solicitudes",
      "ver_todas_solicitudes"
    ]
  },
  {
    id: "role_jefe",
    name: "Jefe / Aprobador",
    description: "Autorizaci\xF3n y dictamen de solicitudes de colaboradores a su cargo.",
    active: true,
    isSystem: true,
    permissions: [
      "ver_solicitudes",
      "crear_solicitudes",
      "editar_solicitudes",
      "aprobar_solicitudes",
      "ver_todas_solicitudes"
    ]
  },
  {
    id: "role_finanzas",
    name: "Finanzas / Tesorer\xEDa",
    description: "Revisi\xF3n de solicitudes aprobadas, dispersi\xF3n de transferencias SPEI y emisi\xF3n de p\xF3lizas.",
    active: true,
    isSystem: true,
    permissions: [
      "ver_solicitudes",
      "ver_todas_solicitudes",
      "ver_reportes"
    ]
  }
];
var BOSSES = [
  {
    id: "boss_sistemas",
    name: "Ing. Roberto Flores / Autorizaciones TI",
    email: "sistemas@dimer.com.mx",
    department: "Sistemas",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
var defaultSeedHash = hashPassword("password123");
var adminCustomHash = hashPassword("Carlos15");
var USERS = [
  {
    id: "usr_adm_1",
    name: "Ing. Sistemas Admin",
    email: "sistemas@dimer.com.mx",
    role: "ADMIN",
    roleId: "role_admin",
    department: "Sistemas",
    status: "ACTIVO",
    isVerified: true,
    passwordHash: adminCustomHash.hash,
    salt: adminCustomHash.salt,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "usr_sol_1",
    name: "Roberto Lozano (Solicitante)",
    email: "roberto.lozano@dimer.com.mx",
    role: "SOLICITANTE",
    roleId: "role_solicitante",
    department: "Sistemas",
    status: "ACTIVO",
    isVerified: true,
    passwordHash: defaultSeedHash.hash,
    salt: defaultSeedHash.salt,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "usr_fin_1",
    name: "CP. Laura Finanzas (Tesorer\xEDa)",
    email: "finanzas@dimer.com.mx",
    role: "FINANZAS",
    roleId: "role_finanzas",
    department: "Finanzas",
    status: "ACTIVO",
    isVerified: true,
    passwordHash: defaultSeedHash.hash,
    salt: defaultSeedHash.salt,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "usr_lec_1",
    name: "Lic. Auditoria (Solo Lectura Aprobadas)",
    email: "auditoria@dimer.com.mx",
    role: "SOLO_LECTURA_APROBADAS",
    roleId: "role_solo_lectura",
    department: "Direcci\xF3n",
    status: "ACTIVO",
    isVerified: true,
    passwordHash: defaultSeedHash.hash,
    salt: defaultSeedHash.salt,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
var VERIFICATION_CODES = /* @__PURE__ */ new Map();
function createVerificationCode(params) {
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const expiresAt = Date.now() + 15 * 60 * 1e3;
  const cleanEmail = params.email.trim().toLowerCase();
  VERIFICATION_CODES.set(cleanEmail, {
    email: cleanEmail,
    code,
    name: params.name.trim(),
    department: params.department.trim(),
    roleId: params.roleId || "role_solicitante",
    passwordHash: params.passwordHash,
    salt: params.salt,
    expiresAt,
    attempts: 0
  });
  return { code, expiresAt };
}
function verifyCodeAndActivateUser(email, code) {
  const cleanEmail = email.trim().toLowerCase();
  const pending = VERIFICATION_CODES.get(cleanEmail);
  if (!pending) {
    return { success: false, error: "No hay un c\xF3digo de verificaci\xF3n pendiente para este correo. Por favor reg\xEDstrese nuevamente." };
  }
  if (Date.now() > pending.expiresAt) {
    VERIFICATION_CODES.delete(cleanEmail);
    return { success: false, error: "El c\xF3digo de verificaci\xF3n ha expirado (l\xEDmite 15 minutos). Solicite uno nuevo." };
  }
  if (pending.code.trim() !== code.trim()) {
    pending.attempts += 1;
    if (pending.attempts >= 5) {
      VERIFICATION_CODES.delete(cleanEmail);
      return { success: false, error: "Demasiados intentos fallidos. C\xF3digo invalidado por seguridad." };
    }
    return { success: false, error: `C\xF3digo incorrecto. Te quedan ${5 - pending.attempts} intentos.` };
  }
  const isSistemas = cleanEmail.toLowerCase() === "sistemas@dimer.com.mx";
  const roleDef = ROLES.find((r) => r.id === pending.roleId) || ROLES[1];
  const role = isSistemas ? "ADMIN" : roleDef.id === "role_admin" ? "ADMIN" : roleDef.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : "SOLICITANTE";
  const newUser = {
    id: `usr_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    name: pending.name,
    email: cleanEmail,
    role,
    roleId: roleDef.id,
    department: pending.department,
    status: "ACTIVO",
    isVerified: true,
    passwordHash: pending.passwordHash,
    salt: pending.salt,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  USERS.push(newUser);
  VERIFICATION_CODES.delete(cleanEmail);
  saveToDisk();
  return { success: true, user: newUser };
}
function sanitizeUser(user) {
  const roleDef = ROLES.find((r) => r.id === user.roleId || r.name.toUpperCase() === String(user.role).toUpperCase());
  const permissions = roleDef ? roleDef.permissions : user.role === "ADMIN" ? ROLES[0].permissions : ROLES[1].permissions;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    roleId: user.roleId || (user.role === "ADMIN" ? "role_admin" : user.role === "SOLO_LECTURA_APROBADAS" ? "role_solo_lectura" : "role_solicitante"),
    permissions,
    status: user.status || "ACTIVO",
    isVerified: user.isVerified ?? true,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}
function hasPermission(user, permission) {
  if (!user || user.status === "INACTIVO") return false;
  if (user.role === "ADMIN") return true;
  const roleDef = ROLES.find((r) => r.id === user.roleId || r.name.toUpperCase() === String(user.role).toUpperCase());
  if (!roleDef || !roleDef.active) return false;
  return roleDef.permissions.includes(permission);
}
var APPROVAL_TOKENS = [
  {
    id: "tok_init_1",
    token: "tok_seed_req_001_carlos_director",
    requestId: "req_001",
    bossId: "boss_001",
    bossEmail: "carlos.director@dimer.com.mx",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
    used: false,
    createdAt: "2026-08-21T09:30:00.000Z"
  }
];
function createApprovalToken(requestId, bossEmail, bossId) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  const tokenString = generateSecureToken();
  const tokenRecord = {
    id: `tok_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    token: tokenString,
    requestId,
    bossId,
    bossEmail: bossEmail.toLowerCase(),
    expiresAt,
    used: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  APPROVAL_TOKENS.push(tokenRecord);
  saveToDisk();
  return tokenRecord;
}
function validateApprovalToken(tokenString) {
  if (!tokenString) {
    return { valid: false, error: "Token de aprobaci\xF3n no proporcionado" };
  }
  const tokenRecord = APPROVAL_TOKENS.find((t) => t.token === tokenString);
  if (!tokenRecord) {
    return { valid: false, error: "Token de aprobaci\xF3n no encontrado o inv\xE1lido" };
  }
  if (tokenRecord.used) {
    return {
      valid: false,
      error: `Este enlace ya fue utilizado previamente el ${new Date(tokenRecord.usedAt || "").toLocaleString("es-MX")} (${tokenRecord.action || "PROCESADO"}). Por seguridad, cada token solo puede emplearse una vez.`,
      tokenRecord
    };
  }
  if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
    return { valid: false, error: "El enlace de aprobaci\xF3n ha expirado. Contacte al solicitante para emitir una revalidaci\xF3n.", tokenRecord };
  }
  const request = TRAVEL_REQUESTS.find((r) => r.id === tokenRecord.requestId);
  if (!request) {
    return { valid: false, error: "La solicitud asociada a este token ya no existe", tokenRecord };
  }
  return { valid: true, tokenRecord, request };
}
function consumeApprovalToken(tokenString, action) {
  const tokenRecord = APPROVAL_TOKENS.find((t) => t.token === tokenString);
  if (!tokenRecord || tokenRecord.used) return false;
  tokenRecord.used = true;
  tokenRecord.usedAt = (/* @__PURE__ */ new Date()).toISOString();
  tokenRecord.action = action;
  saveToDisk();
  return true;
}
var folioSequence = 4;
var TRAVEL_REQUESTS = [
  {
    id: "req_001",
    folio: "VIAT-2026-000001",
    status: "PENDIENTE_APROBACION",
    userId: "usr_sol_1",
    requesterName: "Roberto Lozano",
    department: "Sistemas",
    requestType: "Vi\xE1ticos y Gastos de Viaje",
    detail: "Reuni\xF3n de cierre con cliente industrial para proyecto de automatizaci\xF3n y auditor\xEDa en planta.",
    requestDate: "2026-08-21",
    urgency: "alta",
    bossId: "boss_sistemas",
    bossEmail: "sistemas@dimer.com.mx",
    bossName: "Ing. Roberto Flores / Autorizaciones TI",
    startDate: "2026-08-25T00:00:00.000Z",
    endDate: "2026-08-28T00:00:00.000Z",
    destination: "Monterrey, N.L.",
    reason: "Reuni\xF3n de cierre con cliente industrial para proyecto de automatizaci\xF3n y auditor\xEDa en planta.",
    amountRequested: 14850,
    amountAuthorized: null,
    transportCost: 5e3,
    hotelCost: 6e3,
    foodCost: 3e3,
    miscCost: 850,
    comments: "Incluye vuelos, 3 noches de hospedaje en zona San Pedro y vi\xE1ticos diarios seg\xFAn tabulador.",
    approvalToken: "tok_seed_req_001_sistemas",
    createdAt: "2026-08-21T09:30:00.000Z"
  },
  {
    id: "req_002",
    folio: "VIAT-2026-000002",
    status: "APROBADA",
    userId: "usr_sol_1",
    requesterName: "Roberto Lozano",
    department: "Sistemas",
    requestType: "Vi\xE1ticos y Gastos de Viaje",
    detail: "Participaci\xF3n en Expo Industrial 2026 y visitas t\xE9cnicas a socios estrat\xE9gicos.",
    requestDate: "2026-08-20",
    urgency: "media",
    bossId: "boss_sistemas",
    bossEmail: "sistemas@dimer.com.mx",
    bossName: "Ing. Roberto Flores / Autorizaciones TI",
    startDate: "2026-09-02T00:00:00.000Z",
    endDate: "2026-09-04T00:00:00.000Z",
    destination: "Guadalajara, Jal.",
    reason: "Participaci\xF3n en Expo Industrial 2026 y visitas t\xE9cnicas a socios estrat\xE9gicos.",
    amountRequested: 12e3,
    amountAuthorized: 11e3,
    transportCost: 4e3,
    hotelCost: 4500,
    foodCost: 2500,
    miscCost: 1e3,
    comments: "Aprobado con ajuste de $1,000 en hotel corporativo con convenio.",
    approvedBy: "sistemas@dimer.com.mx",
    approvedAt: "2026-08-20T16:45:00.000Z",
    createdAt: "2026-08-20T14:15:00.000Z"
  },
  {
    id: "req_003",
    folio: "VIAT-2026-000003",
    status: "PAGADA",
    userId: "usr_sol_1",
    requesterName: "Roberto Lozano",
    department: "Sistemas",
    requestType: "Servicios y Mantenimiento",
    detail: "Instalaci\xF3n de servidores y entrega de infraestructura en nuevo centro log\xEDstico.",
    requestDate: "2026-08-08",
    urgency: "baja",
    bossId: "boss_sistemas",
    bossEmail: "sistemas@dimer.com.mx",
    bossName: "Ing. Roberto Flores / Autorizaciones TI",
    startDate: "2026-08-10T00:00:00.000Z",
    endDate: "2026-08-12T00:00:00.000Z",
    destination: "Quer\xE9taro, Qro.",
    reason: "Instalaci\xF3n de servidores y entrega de infraestructura en nuevo centro log\xEDstico.",
    amountRequested: 8500,
    amountAuthorized: 8500,
    comments: "Dispersado v\xEDa transferencia SPEI folio 89123.",
    approvedBy: "sistemas@dimer.com.mx",
    approvedAt: "2026-08-08T15:20:00.000Z",
    createdAt: "2026-08-08T11:00:00.000Z"
  }
];
var AUDIT_LOGS = [
  {
    id: "aud_001",
    requestId: "req_003",
    userId: "usr_sol_1",
    userName: "Roberto Lozano (Solicitante)",
    userEmail: "roberto.lozano@dimer.com.mx",
    action: "CREACION_SOLICITUD",
    details: { folio: "VIAT-2026-000003", amountRequested: 8500, destination: "Quer\xE9taro, Qro.", bossEmail: "sistemas@dimer.com.mx" },
    createdAt: "2026-08-08T11:00:00.000Z"
  },
  {
    id: "aud_002",
    requestId: "req_003",
    userId: "usr_adm_1",
    userName: "Ing. Roberto Flores / Autorizaciones TI",
    userEmail: "sistemas@dimer.com.mx",
    action: "APROBACION_JEFE",
    details: { folio: "VIAT-2026-000003", amountAuthorized: 8500, comments: "Aprobado sin observaciones" },
    createdAt: "2026-08-08T15:20:00.000Z"
  },
  {
    id: "aud_003",
    requestId: "req_003",
    userId: "usr_fin_1",
    userName: "CP. Laura Finanzas (Tesorer\xEDa)",
    userEmail: "finanzas@dimer.com.mx",
    action: "DISPERSION_PAGO",
    details: { folio: "VIAT-2026-000003", amountPaid: 8500, reference: "SPEI-89123" },
    createdAt: "2026-08-09T10:00:00.000Z"
  },
  {
    id: "aud_004",
    requestId: "req_002",
    userId: "usr_sol_1",
    userName: "Roberto Lozano (Solicitante)",
    userEmail: "roberto.lozano@dimer.com.mx",
    action: "CREACION_SOLICITUD",
    details: { folio: "VIAT-2026-000002", amountRequested: 12e3, destination: "Guadalajara, Jal.", bossEmail: "sistemas@dimer.com.mx" },
    createdAt: "2026-08-20T14:15:00.000Z"
  },
  {
    id: "aud_005",
    requestId: "req_002",
    userId: "usr_adm_1",
    userName: "Ing. Roberto Flores / Autorizaciones TI",
    userEmail: "sistemas@dimer.com.mx",
    action: "APROBACION_JEFE",
    details: { folio: "VIAT-2026-000002", amountRequested: 12e3, amountAuthorized: 11e3, adjustment: -1e3 },
    createdAt: "2026-08-20T16:45:00.000Z"
  },
  {
    id: "aud_006",
    requestId: "req_001",
    userId: "usr_sol_1",
    userName: "Roberto Lozano (Solicitante)",
    userEmail: "roberto.lozano@dimer.com.mx",
    action: "CREACION_SOLICITUD",
    details: { folio: "VIAT-2026-000001", amountRequested: 14850, bossEmail: "sistemas@dimer.com.mx" },
    createdAt: "2026-08-21T09:30:00.000Z"
  }
];
function saveToDisk() {
  try {
    const payload = {
      version: 1,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      folioSequence,
      users: USERS,
      departments: DEPARTMENTS,
      roles: ROLES,
      bosses: BOSSES,
      travelRequests: TRAVEL_REQUESTS,
      approvalTokens: APPROVAL_TOKENS,
      auditLogs: AUDIT_LOGS
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving data store to disk:", err);
  }
}
function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      saveToDisk();
      return;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data.users && Array.isArray(data.users)) {
      USERS.length = 0;
      USERS.push(...data.users);
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
    if (typeof data.folioSequence === "number") {
      folioSequence = data.folioSequence;
    }
    console.log(`[DIMER DB] Successfully loaded persistent store from ${DATA_FILE} (${USERS.length} users, ${TRAVEL_REQUESTS.length} requests)`);
  } catch (err) {
    console.error("Error loading persistent store from disk:", err);
  }
}
loadFromDisk();
var currentSessionUserId = null;
function getCurrentUser() {
  if (!currentSessionUserId) {
    return null;
  }
  const found = USERS.find((u) => u.id === currentSessionUserId);
  return found ? sanitizeUser(found) : null;
}
function clearCurrentUser() {
  currentSessionUserId = null;
}
function setCurrentUser(userOrEmail) {
  if (userOrEmail === null) {
    currentSessionUserId = null;
    return null;
  }
  if (typeof userOrEmail === "string") {
    const clean = userOrEmail.trim().toLowerCase();
    const found = USERS.find((u) => u.email.toLowerCase() === clean || u.id === userOrEmail);
    if (found) {
      currentSessionUserId = found.id;
      return sanitizeUser(found);
    }
    const isBoss = clean.includes("jefe") || clean.includes("director");
    const isFin = clean.includes("finanzas");
    const isAdmin = clean.includes("admin") || clean.includes("sistemas");
    const role = isAdmin ? "ADMIN" : isBoss ? "JEFE" : isFin ? "FINANZAS" : "SOLICITANTE";
    const roleId = isAdmin ? "role_admin" : isBoss ? "role_jefe" : isFin ? "role_finanzas" : "role_solicitante";
    const defaultDept = isBoss ? "Ventas" : isFin ? "Finanzas" : isAdmin ? "Sistemas" : "Ventas";
    const newHashed = hashPassword("password123");
    const newUser = {
      id: `usr_${Date.now()}`,
      name: userOrEmail.split("@")[0],
      email: clean,
      role,
      roleId,
      department: defaultDept,
      status: "ACTIVO",
      passwordHash: newHashed.hash,
      salt: newHashed.salt,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    USERS.push(newUser);
    saveToDisk();
    currentSessionUserId = newUser.id;
    return sanitizeUser(newUser);
  }
  currentSessionUserId = userOrEmail.id;
  return sanitizeUser(USERS.find((u) => u.id === userOrEmail.id) || USERS[0]);
}
function generateNextFolio() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const sequenceStr = String(folioSequence++).padStart(6, "0");
  saveToDisk();
  return `VIAT-${currentYear}-${sequenceStr}`;
}
function recordAuditLog(params) {
  const user = USERS.find((u) => u.id === params.userId);
  const newLog = {
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    requestId: params.requestId || null,
    userId: params.userId,
    userName: user?.name || "Sistema / Token Seguro",
    userEmail: user?.email || params.details?.userEmail || "N/A",
    action: params.action,
    details: params.details || null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  AUDIT_LOGS.unshift(newLog);
  saveToDisk();
  return newLog;
}
function getPopulatedRequests() {
  return TRAVEL_REQUESTS.map((req) => {
    const userRecord = USERS.find((u) => u.id === req.userId);
    return {
      ...req,
      user: userRecord ? sanitizeUser(userRecord) : void 0
    };
  });
}

// server/mailService.ts
import nodemailer from "nodemailer";
var outboxLogs = [];
function getMailTransporter(overrideHost) {
  const host = overrideHost || process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER?.trim().replace(/^["']|["']$/g, "") || "sistemas@dimer.com.mx";
  const pass = process.env.SMTP_PASS?.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  if (user && pass) {
    if (host.toLowerCase() === "smtp.gmail.com" || host.toLowerCase().includes("gmail.com") && !host.toLowerCase().includes("smtp-relay")) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }
    return nodemailer.createTransport({
      host,
      port,
      secure,
      name: "dimer.com.mx",
      // Crucial: sets valid FQDN for EHLO to satisfy Google Relay & Gmail requirements
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15e3,
      greetingTimeout: 15e3,
      socketTimeout: 2e4
    });
  }
  return null;
}
function getFromAddress(customFrom) {
  if (customFrom && customFrom.trim()) {
    return customFrom.trim().replace(/^["']|["']$/g, "");
  }
  const envFrom = process.env.SMTP_FROM?.trim().replace(/^["']|["']$/g, "");
  if (envFrom) {
    return envFrom;
  }
  return "Dimer Notificaciones <NO-REPLY@DIMER.COM.MX>";
}
var formatCurrency = (amount) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
function buildBossApprovalEmailHtml(params) {
  const { request, user, approveUrl, rejectUrl, token } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const urgency = (request.urgency || "media").toLowerCase();
  const urgencyBadgeStyle = urgency === "alta" ? "background: #fef2f2; color: #dc2626; border: 1px solid #f87171;" : urgency === "baja" ? "background: #f0fdf4; color: #16a34a; border: 1px solid #86efac;" : "background: #fffbeb; color: #d97706; border: 1px solid #fcd34d;";
  const urgencyLabel = urgency.toUpperCase();
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; text-align: left; border-bottom: 3px solid #3b82f6; }
    .badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
    .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .subtitle { margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px 32px; }
    .alert-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #1e40af; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 700; color: #64748b; width: 35%; text-transform: uppercase; font-size: 11px; }
    .info-table td.value { color: #0f172a; font-weight: 500; }
    .breakdown-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; }
    .breakdown-title { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
    .breakdown-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; }
    .amount-highlight { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0; }
    .amount-highlight .lbl { font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; }
    .amount-highlight .val { font-size: 24px; font-weight: 900; color: #047857; }
    .btn-group { text-align: center; margin: 24px 0 12px 0; }
    .btn-approve { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 6px; font-size: 14px; margin: 4px; }
    .btn-reject { display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 6px; font-size: 13px; margin: 4px; }
    .token-security { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-top: 20px; font-size: 11px; color: #64748b; font-family: monospace; word-break: break-all; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">SOLICITUD POR AUTORIZAR - ${requestType}</span>
      <h1 class="title">Revisi\xF3n y Dictamen de Jefatura</h1>
      <p class="subtitle">Folio Oficial: <strong>${request.folio}</strong></p>
    </div>
    <div class="content">
      <div class="alert-box">
        Estimado/a L\xEDder, <strong>${requesterName}</strong> (${user.email}) ha generado una solicitud para su autorizaci\xF3n formal.
      </div>

      <table class="info-table">
        <tr>
          <td class="label">Folio</td>
          <td class="value"><strong style="color: #2563eb; font-family: monospace;">${request.folio}</strong></td>
        </tr>
        <tr>
          <td class="label">Nombre del Solicitante</td>
          <td class="value"><strong>${requesterName}</strong> (${user.email})</td>
        </tr>
        <tr>
          <td class="label">\xC1rea o Departamento</td>
          <td class="value">${department}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud</td>
          <td class="value"><strong>${requestType}</strong></td>
        </tr>
        <tr>
          <td class="label">Fecha de la Solicitud</td>
          <td class="value">${requestDate}</td>
        </tr>
        <tr>
          <td class="label">Urgencia</td>
          <td class="value">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; ${urgencyBadgeStyle}">
              ${urgencyLabel}
            </span>
          </td>
        </tr>
        <tr>
          <td class="label">Descripci\xF3n / Detalle</td>
          <td class="value" style="white-space: pre-line;">${detail}</td>
        </tr>
        ${request.destination ? `
        <tr>
          <td class="label">Destino / Lugar</td>
          <td class="value"><strong>${request.destination}</strong></td>
        </tr>
        ` : ""}
        ${request.startDate && request.endDate ? `
        <tr>
          <td class="label">Periodo de Ejecuci\xF3n</td>
          <td class="value">${new Date(request.startDate).toLocaleDateString("es-MX")} al ${new Date(request.endDate).toLocaleDateString("es-MX")}</td>
        </tr>
        ` : ""}
        ${request.comments ? `
        <tr>
          <td class="label">Observaciones Adicionales</td>
          <td class="value">${request.comments}</td>
        </tr>
        ` : ""}
      </table>

      <div class="amount-highlight">
        <div class="lbl">Monto Total Solicitado</div>
        <div class="val">${formatCurrency(request.amountRequested)} MXN</div>
      </div>

      <div class="btn-group">
        <a href="${approveUrl}" class="btn-approve" target="_blank">\u2713 APROBAR SOLICITUD</a>
        <a href="${rejectUrl}" class="btn-reject" target="_blank">\u2715 RECHAZAR SOLICITUD</a>
      </div>

      <div class="token-security">
        <strong>Enlace Seguro con Token \xDAnico:</strong><br>
        Token de un solo uso: ${token}<br>
        V\xE1lido por 7 d\xEDas exclusivamente para ${request.bossEmail}.
      </div>
    </div>
    <div class="footer">
      Solicitud de Vi\xE1ticos &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}
function buildSystemsApprovedEmailHtml(params) {
  const { request, user, approverName, approverEmail, approvedAt } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const urgency = (request.urgency || "media").toLowerCase();
  const urgencyBadgeStyle = urgency === "alta" ? "background: #fef2f2; color: #dc2626; border: 1px solid #f87171;" : urgency === "baja" ? "background: #f0fdf4; color: #16a34a; border: 1px solid #86efac;" : "background: #fffbeb; color: #d97706; border: 1px solid #fcd34d;";
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    .header { background: #064e3b; color: #ffffff; padding: 24px 32px; text-align: left; border-bottom: 3px solid #10b981; }
    .badge { display: inline-block; background: #10b981; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
    .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .content { padding: 28px 32px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 700; color: #64748b; width: 35%; text-transform: uppercase; font-size: 11px; }
    .info-table td.value { color: #0f172a; font-weight: 500; }
    .authorized-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
    .authorized-box .lbl { font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; }
    .authorized-box .val { font-size: 26px; font-weight: 900; color: #047857; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">SOLICITUD APROBADA - ${requestType}</span>
      <h1 class="title">SOLICITUD APROBADA - ${request.folio}</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #a7f3d0;">Notificaci\xF3n oficial a Sistemas & Finanzas</p>
    </div>
    <div class="content">
      <p style="font-size: 14px; margin-top: 0;">
        Se ha registrado la autorizaci\xF3n formal de la siguiente solicitud:
      </p>

      <table class="info-table">
        <tr>
          <td class="label">Folio Oficial</td>
          <td class="value"><strong style="color: #059669; font-family: monospace;">${request.folio}</strong></td>
        </tr>
        <tr>
          <td class="label">Nombre del Solicitante</td>
          <td class="value"><strong>${requesterName}</strong> (${user.email})</td>
        </tr>
        <tr>
          <td class="label">\xC1rea o Departamento</td>
          <td class="value">${department}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud</td>
          <td class="value"><strong>${requestType}</strong></td>
        </tr>
        <tr>
          <td class="label">Fecha de la Solicitud</td>
          <td class="value">${requestDate}</td>
        </tr>
        <tr>
          <td class="label">Urgencia</td>
          <td class="value">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; ${urgencyBadgeStyle}">
              ${urgency.toUpperCase()}
            </span>
          </td>
        </tr>
        <tr>
          <td class="label">Jefe que Aprob\xF3</td>
          <td class="value"><strong>${approverName}</strong> (${approverEmail})</td>
        </tr>
        <tr>
          <td class="label">Fecha y Hora de Aprobaci\xF3n</td>
          <td class="value">${new Date(approvedAt).toLocaleString("es-MX")}</td>
        </tr>
        <tr>
          <td class="label">Descripci\xF3n / Detalle</td>
          <td class="value" style="white-space: pre-line;">${detail}</td>
        </tr>
        ${request.destination ? `
        <tr>
          <td class="label">Destino</td>
          <td class="value">${request.destination}</td>
        </tr>
        ` : ""}
        <tr>
          <td class="label">Monto Solicitado</td>
          <td class="value">${formatCurrency(request.amountRequested)} MXN</td>
        </tr>
        ${request.comments ? `
        <tr>
          <td class="label">Observaciones / Dictamen</td>
          <td class="value"><em>"${request.comments}"</em></td>
        </tr>
        ` : ""}
      </table>

      <div class="authorized-box">
        <div class="lbl">Monto Total Autorizado</div>
        <div class="val">${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</div>
      </div>
    </div>
    <div class="footer">
      Sistema de Gesti\xF3n de Solicitudes &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}
function buildVerificationEmailHtml(params) {
  const { name, email, code, expiresMinutes = 15 } = params;
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>C\xF3digo de Verificaci\xF3n - Vi\xE1ticos Dimer</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .header p { margin: 6px 0 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
    .body { padding: 32px 28px; text-align: center; }
    .greeting { font-size: 15px; color: #334155; margin-bottom: 20px; line-height: 1.5; text-align: left; }
    .code-box { background: #f8fafc; border: 2px dashed #6366f1; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .code-label { font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .code-digits { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.25em; color: #0f172a; margin: 0; }
    .validity { font-size: 12px; color: #64748b; margin-top: 8px; }
    .security-note { font-size: 12px; color: #64748b; background-color: #f8fafc; border-left: 3px solid #6366f1; padding: 12px 14px; text-align: left; border-radius: 4px; margin-top: 24px; }
    .footer { background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Vi\xE1ticos Dimer</h1>
      <p>Verificaci\xF3n de Seguridad de Cuenta</p>
    </div>
    <div class="body">
      <div class="greeting">
        Hola <strong>${name}</strong>,<br>
        Has solicitado registrar tu cuenta con el correo <strong>${email}</strong> en el Sistema de Gesti\xF3n de Vi\xE1ticos Dimer. Usa el siguiente c\xF3digo para completar tu registro:
      </div>

      <div class="code-box">
        <div class="code-label">Tu C\xF3digo de Verificaci\xF3n</div>
        <div class="code-digits">${code}</div>
        <div class="validity">V\xE1lido por <strong>${expiresMinutes} minutos</strong> (de un solo uso)</div>
      </div>

      <div class="security-note">
        <strong>Importante:</strong> Si t\xFA no solicitaste este c\xF3digo, puedes ignorar este mensaje de forma segura. Nunca compartas este c\xF3digo con nadie.
      </div>
    </div>
    <div class="footer">
      Sistema de Gesti\xF3n de Vi\xE1ticos &copy; 2026 &bull; Dimer Corporativo &bull; Soporte: sistemas@dimer.com.mx
    </div>
  </div>
</body>
</html>
  `;
}
async function sendEmail(params) {
  const { to, subject, html, from: customFrom, replyTo, requestId, folio } = params;
  const logId = `MAIL-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
  const transporter = getMailTransporter();
  const effectiveFrom = getFromAddress(customFrom);
  const effectiveReplyTo = replyTo || process.env.SMTP_REPLY_TO?.trim() || void 0;
  if (transporter) {
    try {
      await transporter.sendMail({
        from: effectiveFrom,
        replyTo: effectiveReplyTo,
        to,
        subject,
        html
      });
      const log = {
        id: logId,
        requestId,
        folio,
        to,
        subject,
        html,
        status: "ENVIADO",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      outboxLogs.unshift(log);
      console.log(`[MAIL SERVICE] Correo SMTP enviado con \xE9xito desde "${effectiveFrom}" a ${to} (Folio: ${folio || "N/A"})`);
      return { success: true, logId, status: "ENVIADO" };
    } catch (err) {
      console.warn(`[MAIL SERVICE] Primer intento fall\xF3 (${err.message}). Intentando reintento con smtp.gmail.com directo...`);
      try {
        const fallbackTransporter = getMailTransporter("smtp.gmail.com");
        if (fallbackTransporter) {
          await fallbackTransporter.sendMail({
            from: effectiveFrom,
            replyTo: effectiveReplyTo,
            to,
            subject,
            html
          });
          const log2 = {
            id: logId,
            requestId,
            folio,
            to,
            subject,
            html,
            status: "ENVIADO",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          outboxLogs.unshift(log2);
          console.log(`[MAIL SERVICE] Correo enviado exitosamente v\xEDa fallback Gmail SMTP desde "${effectiveFrom}" a ${to}`);
          return { success: true, logId, status: "ENVIADO" };
        }
      } catch (fallbackErr) {
        console.error(`[MAIL SERVICE ERROR] Fallback tambi\xE9n fall\xF3:`, fallbackErr.message);
      }
      console.error(`[MAIL SERVICE ERROR] Falla enviando correo a ${to}:`, err.message);
      const log = {
        id: logId,
        requestId,
        folio,
        to,
        subject,
        html,
        status: "FALLIDO",
        error: err.message,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      outboxLogs.unshift(log);
      return { success: false, logId, status: "FALLIDO", error: err.message };
    }
  } else {
    console.log(`[MAIL SERVICE - TEST MODE] Correo generado para ${to}: "${subject}"`);
    const log = {
      id: logId,
      requestId,
      folio,
      to,
      subject,
      html,
      status: "SIMULADO",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    outboxLogs.unshift(log);
    return { success: true, logId, status: "SIMULADO" };
  }
}
function buildNewAccountAdminEmailHtml(params) {
  const { user, registeredAt } = params;
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    .header { background: #1e1b4b; color: #ffffff; padding: 24px 32px; border-bottom: 3px solid #6366f1; }
    .badge { display: inline-block; background: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; font-family: monospace; }
    .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .content { padding: 28px 32px; }
    .alert-box { background: #eef2ff; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #3730a3; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 700; color: #64748b; width: 35%; text-transform: uppercase; font-size: 11px; }
    .info-table td.value { color: #0f172a; font-weight: 600; }
    .action-notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #92400e; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">NUEVO USUARIO REGISTRADO</span>
      <h1 class="title">Revisi\xF3n y Asignaci\xF3n de Rol Requerida</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #c7d2fe;">Sistema de Vi\xE1ticos Dimer &bull; Notificaci\xF3n a TI / Administraci\xF3n</p>
    </div>
    <div class="content">
      <div class="alert-box">
        Se ha registrado una nueva cuenta de colaborador en el sistema de vi\xE1ticos Dimer y se encuentra en espera de revisi\xF3n de roles.
      </div>

      <table class="info-table">
        <tr>
          <td class="label">Nombre del Colaborador</td>
          <td class="value">${user.name}</td>
        </tr>
        <tr>
          <td class="label">Correo Corporativo</td>
          <td class="value" style="color: #4f46e5;">${user.email}</td>
        </tr>
        <tr>
          <td class="label">Departamento</td>
          <td class="value">${user.department}</td>
        </tr>
        <tr>
          <td class="label">Rol Inicial</td>
          <td class="value"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace;">${user.role}</span></td>
        </tr>
        <tr>
          <td class="label">Fecha y Hora</td>
          <td class="value">${new Date(registeredAt).toLocaleString("es-MX")}</td>
        </tr>
      </table>

      <div class="action-notice">
        <strong>Acci\xF3n requerida para el Administrador:</strong><br>
        Por favor ingresa al m\xF3dulo de <strong>Administraci\xF3n (RBAC)</strong> en el sistema de vi\xE1ticos para revisar esta cuenta y asignarle su rol oficial definitivo (Solicitante, Jefe Aprobador, Finanzas, etc.).
      </div>
    </div>
    <div class="footer">
      Sistema de Gesti\xF3n de Vi\xE1ticos &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}
function buildTokenApprovalResultPageHtml(params) {
  const { status, request, actionTaken, errorMessage, processedBy, processedAt } = params;
  const isSuccess = status === "APROBADA";
  const isRejected = status === "RECHAZADA";
  const isAlready = status === "YA_PROCESADA";
  let title = "Dictamen de Solicitud de Vi\xE1ticos";
  let bannerColor = "#0f172a";
  let badgeColor = "#3b82f6";
  let mainHeading = "Resultado del Dictamen";
  let message = "";
  if (isSuccess) {
    title = "Solicitud Autorizada con \xC9xito";
    bannerColor = "#064e3b";
    badgeColor = "#10b981";
    mainHeading = "\u2713 Solicitud Autorizada con \xC9xito";
    message = "La solicitud ha quedado formalmente AUTORIZADA en el sistema de vi\xE1ticos Dimer. Se ha notificado a Finanzas y a Sistemas para la correspondiente dispersi\xF3n de fondos y seguimiento.";
  } else if (isRejected) {
    title = "Solicitud Rechazada";
    bannerColor = "#881337";
    badgeColor = "#f43f5e";
    mainHeading = "\u2715 Solicitud Rechazada";
    message = "La solicitud ha sido registrada como RECHAZADA. El solicitante y las \xE1reas correspondientes han sido informados del dictamen.";
  } else if (isAlready) {
    title = "Solicitud Ya Procesada";
    bannerColor = "#1e293b";
    badgeColor = "#eab308";
    mainHeading = "Esta Solicitud Ya Fue Procesada";
    message = `Esta solicitud ya fue atendida previamente (${request?.status}). No se requiere ninguna acci\xF3n adicional.`;
  } else {
    title = "Enlace No V\xE1lido";
    bannerColor = "#450a0a";
    badgeColor = "#ef4444";
    mainHeading = "Enlace No V\xE1lido o Expirado";
    message = errorMessage || "El enlace utilizado no es v\xE1lido, ha expirado o el token de seguridad ya fue consumido.";
  }
  const formatCurrency2 = (val) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val || 0);
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Dimer</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .card {
      max-width: 600px;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      border: 1px solid #cbd5e1;
    }
    .header {
      background: ${bannerColor};
      color: #ffffff;
      padding: 28px 32px;
      text-align: left;
      border-bottom: 4px solid ${badgeColor};
    }
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #ffffff;
    }
    .logo-text span {
      color: #38bdf8;
    }
    .badge {
      display: inline-block;
      background: ${badgeColor};
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: monospace;
    }
    .title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
    }
    .subtitle {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
    .content {
      padding: 28px 32px;
    }
    .message-box {
      background: #f8fafc;
      border-left: 4px solid ${badgeColor};
      padding: 14px 18px;
      border-radius: 6px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    .info-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .info-table td.label {
      font-weight: 700;
      color: #64748b;
      width: 38%;
      text-transform: uppercase;
      font-size: 11px;
    }
    .info-table td.value {
      color: #0f172a;
      font-weight: 600;
    }
    .amount-highlight {
      background: ${isSuccess ? "#ecfdf5" : "#f8fafc"};
      border: 1px solid ${isSuccess ? "#a7f3d0" : "#e2e8f0"};
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin: 20px 0;
    }
    .amount-highlight .lbl {
      font-size: 11px;
      font-weight: 700;
      color: ${isSuccess ? "#065f46" : "#64748b"};
      text-transform: uppercase;
    }
    .amount-highlight .val {
      font-size: 26px;
      font-weight: 900;
      color: ${isSuccess ? "#047857" : "#0f172a"};
      margin-top: 4px;
    }
    .btn-container {
      margin-top: 24px;
      text-align: center;
    }
    .btn-close {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }
    .btn-close:hover {
      background: #334155;
    }
    .footer {
      background: #f8fafc;
      padding: 16px 32px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-row">
        <div class="logo-text">DIMER<span>.</span></div>
        <span class="badge">${status}</span>
      </div>
      <h1 class="title">${mainHeading}</h1>
      <p class="subtitle">${request ? `Folio Oficial: <strong>${request.folio}</strong>` : "Sistema de Vi\xE1ticos Dimer"}</p>
    </div>
    <div class="content">
      <div class="message-box">
        ${message}
      </div>

      ${request ? `
      <table class="info-table">
        <tr>
          <td class="label">Folio</td>
          <td class="value"><strong style="color: #2563eb; font-family: monospace;">${request.folio}</strong></td>
        </tr>
        <tr>
          <td class="label">Solicitante</td>
          <td class="value">${request.requesterName}</td>
        </tr>
        <tr>
          <td class="label">Departamento</td>
          <td class="value">${request.department}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud</td>
          <td class="value">${request.requestType}</td>
        </tr>
        ${request.destination ? `
        <tr>
          <td class="label">Destino</td>
          <td class="value">${request.destination}</td>
        </tr>
        ` : ""}
        <tr>
          <td class="label">Procesado Por</td>
          <td class="value"><strong>${processedBy || request.approvedBy || request.rejectedBy || request.bossEmail}</strong></td>
        </tr>
        <tr>
          <td class="label">Fecha y Hora</td>
          <td class="value">${new Date(processedAt || Date.now()).toLocaleString("es-MX")}</td>
        </tr>
      </table>

      <div class="amount-highlight">
        <div class="lbl">${isSuccess ? "Monto Total Autorizado" : "Monto de la Solicitud"}</div>
        <div class="val">${formatCurrency2(request.amountAuthorized || request.amountRequested)} MXN</div>
      </div>
      ` : ""}

      <div class="btn-container">
        <button onclick="window.close()" class="btn-close">
          Cerrar esta ventana
        </button>
      </div>
    </div>
    <div class="footer">
      Sistema de Gesti\xF3n de Vi\xE1ticos &copy; 2026 &bull; Dimer Corporativo
    </div>
  </div>
</body>
</html>
  `;
}

// server/nextjsArtifacts.ts
var NEXTJS_CODE_ARTIFACTS = [
  {
    path: "prisma/schema.prisma",
    language: "prisma",
    description: "Esquema de Prisma ORM (v6) con Enums, Modelos de Usuario, Solicitud y Auditor\xEDa.",
    content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  JEFE
  FINANZAS
  EMPLEADO
}

enum Status {
  BORRADOR
  PENDIENTE_APROBACION
  APROBADA
  RECHAZADA
  CORRECCION_SOLICITADA
  PAGADA
  FINALIZADA
}

model User {
  id        String          @id @default(cuid())
  name      String?
  email     String          @unique
  role      Role            @default(EMPLEADO)
  requests  TravelRequest[] @relation("Solicitante")
  createdAt DateTime        @default(now())
}

model TravelRequest {
  id               String   @id @default(cuid())
  folio            String   @unique
  status           Status   @default(PENDIENTE_APROBACION)
  userId           String
  user             User     @relation("Solicitante", fields: [userId], references: [id])
  bossEmail        String
  startDate        DateTime
  endDate          DateTime
  destination      String
  reason           String
  amountRequested  Float
  amountAuthorized Float?
  comments         String?  @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId])
  @@index([bossEmail])
  @@index([status])
}

model AuditLog {
  id        String   @id @default(cuid())
  requestId String?
  userId    String
  action    String
  details   Json?
  createdAt DateTime @default(now())

  @@index([requestId])
  @@index([userId])
}
`
  },
  {
    path: "lib/auth.ts",
    language: "typescript",
    description: "Opciones de NextAuth.js con Google Provider (prompt: select_account), Credentials Provider, persistencia de roles y callbacks.",
    content: `import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "Dimer Credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contrase\xF1a", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Ingresa correo y contrase\xF1a");
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) {
          throw new Error("Usuario no encontrado o debe usar Google");
        }
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Contrase\xF1a incorrecta");
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Upsert usuario en PostgreSQL
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            name: user.name || "Usuario",
            email: user.email,
            role: Role.EMPLEADO,
          },
        });
      }
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
`
  },
  {
    path: "app/api/auth/[...nextauth]/route.ts",
    language: "typescript",
    description: "Ruta API Handler de NextAuth para Next.js 14 App Router.",
    content: `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
`
  },
  {
    path: "app/api/auth/register-init/route.ts",
    language: "typescript",
    description: "Endpoint Next.js 14 para iniciar registro de usuario, generar c\xF3digo de 6 d\xEDgitos y enviar correo SMTP.",
    content: `import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

// En memoria o Redis/PostgreSQL para c\xF3digos de verificaci\xF3n
const VERIFICATION_STORE = new Map<string, { code: string; expiresAt: number; name: string; department: string; passwordHash: string }>();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  try {
    const { name, email, password, department } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nombre, correo y contrase\xF1a son requeridos" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con este correo electr\xF3nico." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    VERIFICATION_STORE.set(cleanEmail, {
      code,
      expiresAt,
      name: name.trim(),
      department: department?.trim() || "General",
      passwordHash,
    });

    const html = \`
      <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white;">
        <h2>C\xF3digo de Verificaci\xF3n Dimer: <span style="color: #6366f1;">\${code}</span></h2>
        <p>Hola \${name}, introduce este c\xF3digo para verificar tu cuenta institucional de Vi\xE1ticos.</p>
        <p style="font-size: 11px; color: #94a3b8;">V\xE1lido por 15 minutos.</p>
      </div>
    \`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "DIMER Vi\xE1ticos <notificaciones@dimer.com.mx>",
        to: cleanEmail,
        subject: \`C\xF3digo de Verificaci\xF3n Dimer: \${code}\`,
        html,
      });
    } catch (mailErr: any) {
      console.warn("SMTP Warning:", mailErr.message);
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      expiresAt,
      message: "C\xF3digo de verificaci\xF3n enviado al correo institucional.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al procesar el registro" }, { status: 500 });
  }
}
`
  },
  {
    path: "app/api/auth/verify-code/route.ts",
    language: "typescript",
    description: "Endpoint Next.js 14 para validar el c\xF3digo de 6 d\xEDgitos y persistir el usuario en la base de datos.",
    content: `import { NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Correo y c\xF3digo requeridos" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    // Validar c\xF3digo y persistir usuario en PostgreSQL mediante Prisma
    const user = await prisma.user.create({
      data: {
        name: cleanEmail.split("@")[0],
        email: cleanEmail,
        role: Role.EMPLEADO,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: "Cuenta verificada y activada exitosamente.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al validar el c\xF3digo" }, { status: 500 });
  }
}
`
  },
  {
    path: "lib/mail-service.ts",
    language: "typescript",
    description: "Servicio Nodemailer con plantillas HTML empresariales para Jefe y Finanzas.",
    content: `import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const defaultSender = process.env.SMTP_FROM || "Sistema de Vi\xE1ticos <notificaciones@empresa.com>";
const finanzasEmail = process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx";

export async function sendBossNotificationEmail(params: {
  bossEmail: string;
  requesterName: string;
  requesterEmail: string;
  folio: string;
  destination: string;
  startDate: string;
  endDate: string;
  reason: string;
  amountRequested: number;
  approvalUrl: string;
}) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

  const html = \`
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: sans-serif; background-color: #f4f5f7; padding: 20px; color: #1e293b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="background: #0f172a; padding: 24px; color: #ffffff;">
        <span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">AUTORIZACI\xD3N PENDIENTE</span>
        <h2 style="margin: 8px 0 0 0;">Solicitud de Vi\xE1ticos: \${params.folio}</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hola, <strong>\${params.requesterName}</strong> (\${params.requesterEmail}) ha ingresado una nueva solicitud de vi\xE1ticos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #64748b;">Folio:</td><td style="font-weight: bold;">\${params.folio}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Destino:</td><td><strong>\${params.destination}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Periodo:</td><td>\${params.startDate} al \${params.endDate}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Motivo:</td><td>\${params.reason}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Solicitado:</td><td style="font-size: 18px; font-weight: bold; color: #059669;">\${formatCurrency(params.amountRequested)}</td></tr>
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="\${params.approvalUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Revisar y Autorizar Solicitud</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">* Solo el correo \${params.bossEmail} o un administrador est\xE1n autorizados para procesar esta solicitud.</p>
      </div>
    </div>
  </body>
  </html>
  \`;

  return transporter.sendMail({
    from: defaultSender,
    to: params.bossEmail,
    subject: \`[Acci\xF3n Requerida] Solicitud de Vi\xE1ticos \${params.folio} - \${params.requesterName}\`,
    html,
  });
}

export async function sendFinanceNotificationEmail(params: {
  folio: string;
  requesterName: string;
  bossEmail: string;
  destination: string;
  amountRequested: number;
  amountAuthorized: number;
  comments?: string;
  financeUrl: string;
}) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

  const html = \`
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: sans-serif; background-color: #f4f5f7; padding: 20px; color: #1e293b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="background: #064e3b; padding: 24px; color: #ffffff;">
        <span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">SOLICITUD APROBADA</span>
        <h2 style="margin: 8px 0 0 0;">Vi\xE1ticos Aprobados: \${params.folio}</h2>
      </div>
      <div style="padding: 24px;">
        <p>El Jefe Directo (<strong>\${params.bossEmail}</strong>) ha autorizado la siguiente solicitud para dispersi\xF3n de recursos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #64748b;">Folio:</td><td style="font-weight: bold;">\${params.folio}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Beneficiario:</td><td><strong>\${params.requesterName}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Destino:</td><td>\${params.destination}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Solicitado:</td><td>\${formatCurrency(params.amountRequested)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Autorizado:</td><td style="font-size: 18px; font-weight: bold; color: #059669;">\${formatCurrency(params.amountAuthorized)}</td></tr>
          \${params.comments ? \`<tr><td style="padding: 8px 0; color: #64748b;">Comentarios:</td><td><em>\${params.comments}</em></td></tr>\` : ""}
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="\${params.financeUrl}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver P\xF3liza en Finanzas</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  \`;

  return transporter.sendMail({
    from: defaultSender,
    to: finanzasEmail,
    subject: \`[Para Dispersi\xF3n] Vi\xE1ticos Aprobados \${params.folio} - \${params.requesterName}\`,
    html,
  });
}
`
  },
  {
    path: "app/actions/viaticos.ts",
    language: "typescript",
    description: "Server Actions con validaciones de seguridad, folio consecutivo VIAT-YYYY-XXXXXX, auditor\xEDa y correos.",
    content: `import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient, Status, Role } from "@prisma/client";
import { sendBossNotificationEmail, sendFinanceNotificationEmail } from "@/lib/mail-service";

const prisma = new PrismaClient();

/**
 * Genera el siguiente folio consecutivo con formato VIAT-YYYY-XXXXXX
 */
async function generateNextFolio(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = \`VIAT-\${currentYear}-\`;
  
  const lastRequest = await prisma.travelRequest.findFirst({
    where: { folio: { startsWith: prefix } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });

  let nextNumber = 1;
  if (lastRequest && lastRequest.folio) {
    const parts = lastRequest.folio.split("-");
    if (parts.length === 3) {
      const num = parseInt(parts[2], 10);
      if (!isNaN(num)) nextNumber = num + 1;
    }
  }

  return \`VIAT-\${currentYear}-\${String(nextNumber).padStart(6, "0")}\`;
}

export async function createTravelRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("No autenticado. Inicie sesi\xF3n para continuar.");
  }

  const bossEmail = formData.get("bossEmail") as string;
  const destination = formData.get("destination") as string;
  const reason = formData.get("reason") as string;
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const amountRequested = parseFloat(formData.get("amountRequested") as string);
  const comments = formData.get("comments") as string | null;

  if (!bossEmail || !destination || !reason || !startDateStr || !endDateStr || isNaN(amountRequested) || amountRequested <= 0) {
    throw new Error("Por favor complete todos los campos obligatorios con valores v\xE1lidos.");
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (endDate < startDate) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
  }

  const folio = await generateNextFolio();

  const request = await prisma.$transaction(async (tx) => {
    const newRequest = await tx.travelRequest.create({
      data: {
        folio,
        status: Status.PENDIENTE_APROBACION,
        userId: session.user.id,
        bossEmail: bossEmail.toLowerCase().trim(),
        destination: destination.trim(),
        reason: reason.trim(),
        startDate,
        endDate,
        amountRequested,
        comments: comments?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        requestId: newRequest.id,
        userId: session.user.id,
        action: "CREACION_SOLICITUD",
        details: {
          folio,
          bossEmail,
          amountRequested,
          destination,
        },
      },
    });

    return newRequest;
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const approvalUrl = \`\${appUrl}/aprobar/\${request.id}\`;

  try {
    await sendBossNotificationEmail({
      bossEmail: request.bossEmail,
      requesterName: session.user.name || "Colaborador",
      requesterEmail: session.user.email,
      folio: request.folio,
      destination: request.destination,
      startDate: startDate.toLocaleDateString("es-MX"),
      endDate: endDate.toLocaleDateString("es-MX"),
      reason: request.reason,
      amountRequested: request.amountRequested,
      approvalUrl,
    });
  } catch (mailError) {
    console.error("Fallo al enviar correo al jefe:", mailError);
  }

  revalidatePath("/solicitar");
  revalidatePath("/mis-solicitudes");
  return { success: true, folio: request.folio, requestId: request.id };
}

export async function approveTravelRequest(params: {
  requestId: string;
  amountAuthorized: number;
  comments?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Debe autenticarse con su cuenta de Google.");
  }

  const request = await prisma.travelRequest.findUnique({
    where: { id: params.requestId },
    include: { user: true },
  });

  if (!request) {
    throw new Error("Solicitud no encontrada.");
  }

  // Validaci\xF3n de seguridad de jefe o admin
  const isBoss = request.bossEmail.toLowerCase() === session.user.email.toLowerCase();
  const isAdmin = session.user.role === Role.ADMIN;

  if (!isBoss && !isAdmin) {
    throw new Error(\`Acceso no autorizado. Debe iniciar sesi\xF3n con \${request.bossEmail}\`);
  }

  if (isNaN(params.amountAuthorized) || params.amountAuthorized < 0) {
    throw new Error("El monto autorizado debe ser un valor positivo v\xE1lido.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.travelRequest.update({
      where: { id: params.requestId },
      data: {
        status: Status.APROBADA,
        amountAuthorized: params.amountAuthorized,
        comments: params.comments?.trim() || request.comments,
      },
    });

    await tx.auditLog.create({
      data: {
        requestId: req.id,
        userId: session.user.id,
        action: "APROBACION_JEFE",
        details: {
          approvedBy: session.user.email,
          amountRequested: req.amountRequested,
          amountAuthorized: params.amountAuthorized,
          comments: params.comments,
        },
      },
    });

    return req;
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const financeUrl = \`\${appUrl}/finanzas\`;

  try {
    await sendFinanceNotificationEmail({
      folio: updated.folio,
      requesterName: request.user.name || "Colaborador",
      bossEmail: session.user.email,
      destination: updated.destination,
      amountRequested: updated.amountRequested,
      amountAuthorized: params.amountAuthorized,
      comments: params.comments,
      financeUrl,
    });
  } catch (err) {
    console.error("Fallo al notificar a finanzas:", err);
  }

  revalidatePath(\`/aprobar/\${params.requestId}\`);
  revalidatePath("/finanzas");
  return { success: true, folio: updated.folio };
}

export async function rejectTravelRequest(params: { requestId: string; comments: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Debe autenticarse.");

  const request = await prisma.travelRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new Error("Solicitud no encontrada.");

  const isBoss = request.bossEmail.toLowerCase() === session.user.email.toLowerCase();
  const isAdmin = session.user.role === Role.ADMIN;
  if (!isBoss && !isAdmin) throw new Error("No autorizado.");

  await prisma.$transaction([
    prisma.travelRequest.update({
      where: { id: params.requestId },
      data: { status: Status.RECHAZADA, comments: params.comments },
    }),
    prisma.auditLog.create({
      data: {
        requestId: params.requestId,
        userId: session.user.id,
        action: "RECHAZO_JEFE",
        details: { rejectedBy: session.user.email, reason: params.comments },
      },
    }),
  ]);

  revalidatePath(\`/aprobar/\${params.requestId}\`);
  return { success: true };
}
`
  },
  {
    path: "app/solicitar/page.tsx",
    language: "typescript",
    description: "P\xE1gina de Formulario de Solicitud con validaciones, preview de folio y experiencia de usuario limpia.",
    content: `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createTravelRequest } from "@/app/actions/viaticos";

export default function SolicitarViaticosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createTravelRequest(formData);
      if (res.success) {
        alert(\`\xA1Solicitud generada con \xE9xito! Folio: \${res.folio}\`);
        router.push("/mis-solicitudes");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Nueva Solicitud de Vi\xE1ticos</h1>
        <p className="text-slate-600 mb-6 text-sm">
          Complete la informaci\xF3n del viaje. El folio oficial se generar\xE1 autom\xE1ticamente y se enviar\xE1 la notificaci\xF3n al correo del jefe especificado.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Correo Electr\xF3nico del Jefe Inmediato *
            </label>
            <input
              type="email"
              name="bossEmail"
              required
              placeholder="director@tuempresa.com"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Este correo recibir\xE1 la notificaci\xF3n con el enlace seguro de aprobaci\xF3n.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha Inicio del Viaje *</label>
              <input
                type="date"
                name="startDate"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha Fin del Viaje *</label>
              <input
                type="date"
                name="endDate"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Ciudad / Destino *</label>
            <input
              type="text"
              name="destination"
              required
              placeholder="Ej. Monterrey, N.L. - Planta Industrial"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Monto Total Solicitado (MXN) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="1"
                name="amountRequested"
                required
                placeholder="15000.00"
                className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Justificaci\xF3n / Motivo del Viaje *</label>
            <textarea
              name="reason"
              rows={3}
              required
              placeholder="Describa el objetivo del viaje, clientes a visitar y entregables esperados..."
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Desglose o Comentarios Adicionales</label>
            <textarea
              name="comments"
              rows={2}
              placeholder="Ej. Hospedaje: $6,000, Vuelo: $5,000, Alimentos: $4,000"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 text-sm"
            >
              {loading ? "Enviando Solicitud..." : "Enviar a Aprobaci\xF3n"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`
  },
  {
    path: "app/aprobar/[id]/page.tsx",
    language: "typescript",
    description: "P\xE1gina de Aprobaci\xF3n de Jefatura con validaci\xF3n de correo de sesi\xF3n, ajuste de monto autorizado y registro de auditor\xEDa.",
    content: `import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import ApprovalForm from "./ApprovalForm";

const prisma = new PrismaClient();

interface Props {
  params: { id: string };
}

export default async function AprobarPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const request = await prisma.travelRequest.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  if (!request) notFound();

  // Registrar auditor\xEDa de apertura / visualizaci\xF3n
  if (session?.user?.id) {
    await prisma.auditLog.create({
      data: {
        requestId: request.id,
        userId: session.user.id,
        action: "VISUALIZACION_SOLICITUD",
        details: { viewedBy: session.user.email },
      },
    });
  }

  const userEmail = session?.user?.email?.toLowerCase();
  const bossEmail = request.bossEmail.toLowerCase();
  const isAdmin = session?.user?.role === Role.ADMIN;
  const isAuthorized = userEmail === bossEmail || isAdmin;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Gesti\xF3n de Aprobaci\xF3n
            </span>
            <h1 className="text-2xl font-bold">Folio {request.folio}</h1>
            <p className="text-slate-400 text-sm mt-1">
              Solicitado el {new Date(request.createdAt).toLocaleDateString("es-MX")} por {request.user.name}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block uppercase font-medium">Estado Actual</span>
            <span className="inline-block mt-1 font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-3 py-1 rounded-lg text-sm">
              {request.status}
            </span>
          </div>
        </div>

        {/* Alerta de Seguridad de Validaci\xF3n de Correo */}
        {!isAuthorized && (
          <div className="p-6 bg-red-50 border-b border-red-200 text-red-800">
            <h3 className="font-bold text-base flex items-center gap-2">
              Acceso Restringido: Correo no Coincide
            </h3>
            <p className="text-sm mt-1">
              Esta solicitud est\xE1 dirigida a <strong>{request.bossEmail}</strong>. Tu sesi\xF3n actual es <strong>{session?.user?.email || "No autenticado"}</strong>.
              Para gestionar esta solicitud, debes iniciar sesi\xF3n con la cuenta de Google autorizada.
            </p>
          </div>
        )}

        {/* Resumen del Viaje */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Destino</h4>
            <p className="text-slate-900 font-semibold text-lg">{request.destination}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Periodo de Viaje</h4>
            <p className="text-slate-900 font-medium">
              {new Date(request.startDate).toLocaleDateString("es-MX")} al {new Date(request.endDate).toLocaleDateString("es-MX")}
            </p>
          </div>
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo / Justificaci\xF3n</h4>
            <p className="text-slate-800 text-sm leading-relaxed">{request.reason}</p>
          </div>
          <div className="md:col-span-2 bg-blue-50/80 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-blue-900 uppercase">Monto Solicitado</span>
              <p className="text-2xl font-black text-blue-700">
                \${request.amountRequested.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
              </p>
            </div>
            <div className="text-right text-xs text-blue-600">
              Moneda: Pesos Mexicanos
            </div>
          </div>
        </div>

        {/* Formulario Interactivo del Jefe */}
        {isAuthorized && request.status === "PENDIENTE_APROBACION" && (
          <div className="p-6 md:p-8">
            <ApprovalForm
              requestId={request.id}
              initialAmount={request.amountRequested}
            />
          </div>
        )}
      </div>
    </div>
  );
}
`
  }
];

// server/app.ts
function createApp() {
  const app = express();
  console.log("[DIMER API] Initializing Express Application Instance for Vercel/Node...");
  app.use(cors());
  app.use(express.json());
  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "viaticos-dimer-api"
    });
  });
  app.get("/api/me", (req, res) => {
    const user = getCurrentUser();
    res.json({
      user,
      allUsers: USERS.map(sanitizeUser),
      appUrl: process.env.APP_URL || "http://localhost:3000",
      finanzasEmail: process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx",
      systemsEmail: "sistemas@dimer.com.mx"
    });
  });
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Correo electr\xF3nico y contrase\xF1a requeridos" });
      }
      const cleanEmail = email.trim().toLowerCase();
      const userRecord = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!userRecord) {
        return res.status(401).json({ error: "No existe una cuenta registrada con este correo. Por favor reg\xEDstrate." });
      }
      if (userRecord.status === "INACTIVO") {
        return res.status(403).json({ error: "Esta cuenta est\xE1 inactiva. Contacta al Administrador." });
      }
      if (userRecord.passwordHash && userRecord.salt) {
        const isValid = verifyPassword(password, userRecord.passwordHash, userRecord.salt);
        if (!isValid) {
          return res.status(401).json({ error: "Contrase\xF1a incorrecta. Verifica tus datos e intenta de nuevo." });
        }
      }
      const user = setCurrentUser(userRecord.id);
      recordAuditLog({
        userId: user.id,
        action: "INICIO_SESION",
        details: { email: user.email, role: user.role }
      });
      res.json({ success: true, user });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error en el inicio de sesi\xF3n" });
    }
  });
  app.post("/api/auth/register-init", async (req, res) => {
    try {
      const { name, email, password, department, roleId } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Nombre completo, correo y contrase\xF1a son obligatorios" });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes("@")) {
        return res.status(400).json({ error: "El formato de correo no es v\xE1lido." });
      }
      const existing = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: "Ya existe una cuenta activa con este correo electr\xF3nico. Por favor inicia sesi\xF3n." });
      }
      const deptName = department ? department.trim() : "General";
      getOrCreateDepartment(deptName);
      const { hash, salt } = hashPassword(password);
      const initialRoleId = "role_solicitante";
      const { code, expiresAt } = createVerificationCode({
        email: cleanEmail,
        name: name.trim(),
        department: deptName,
        roleId: initialRoleId,
        passwordHash: hash,
        salt
      });
      const emailHtml = buildVerificationEmailHtml({
        name: name.trim(),
        email: cleanEmail,
        code,
        expiresMinutes: 15
      });
      const mailResult = await sendEmail({
        to: cleanEmail,
        subject: `C\xF3digo de Verificaci\xF3n Dimer: ${code}`,
        html: emailHtml
      });
      console.log(`[AUTH REGISTRATION] C\xF3digo de verificaci\xF3n ${code} emitido para ${cleanEmail} (Status: ${mailResult.status})`);
      res.json({
        success: true,
        email: cleanEmail,
        expiresAt,
        simulatedCode: mailResult.status === "SIMULADO" ? code : void 0,
        message: `Se ha enviado un c\xF3digo de verificaci\xF3n de 6 d\xEDgitos a ${cleanEmail}. Por favor revisa tu bandeja de entrada o spam.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error al iniciar registro" });
    }
  });
  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Correo y c\xF3digo de 6 d\xEDgitos requeridos" });
      }
      const result = verifyCodeAndActivateUser(email, code);
      if (!result.success || !result.user) {
        return res.status(400).json({ error: result.error || "C\xF3digo de verificaci\xF3n inv\xE1lido" });
      }
      const activeUser = setCurrentUser(result.user.id);
      recordAuditLog({
        userId: activeUser.id,
        action: "VERIFICACION_Y_ACTIVACION_CUENTA",
        details: {
          email: activeUser.email,
          role: activeUser.role,
          department: activeUser.department
        }
      });
      try {
        const adminEmailHtml = buildNewAccountAdminEmailHtml({
          user: {
            name: activeUser.name,
            email: activeUser.email,
            department: activeUser.department,
            role: activeUser.role
          },
          registeredAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        await sendEmail({
          to: "sistemas@dimer.com.mx",
          subject: `NUEVA CUENTA REGISTRADA - Revisi\xF3n y Asignaci\xF3n de Rol (${activeUser.name})`,
          html: adminEmailHtml
        });
        console.log(`[AUTH] Notificaci\xF3n de nuevo usuario (${activeUser.email}) enviada a sistemas@dimer.com.mx`);
      } catch (mailErr) {
        console.error("[AUTH ERROR] No se pudo enviar notificaci\xF3n de nuevo usuario a sistemas:", mailErr.message);
      }
      res.json({
        success: true,
        user: sanitizeUser(result.user),
        message: "\xA1Cuenta verificada y activada con \xE9xito! Bienvenido al Sistema de Vi\xE1ticos Dimer."
      });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error al verificar el c\xF3digo" });
    }
  });
  app.post("/api/auth/resend-code", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Correo requerido" });
      }
      const cleanEmail = email.trim().toLowerCase();
      const pending = VERIFICATION_CODES.get(cleanEmail);
      if (!pending) {
        return res.status(404).json({ error: "No hay un registro pendiente para este correo. Por favor inicia tu registro nuevamente." });
      }
      const newCode = Math.floor(1e5 + Math.random() * 9e5).toString();
      pending.code = newCode;
      pending.expiresAt = Date.now() + 15 * 60 * 1e3;
      pending.attempts = 0;
      const emailHtml = buildVerificationEmailHtml({
        name: pending.name,
        email: cleanEmail,
        code: newCode,
        expiresMinutes: 15
      });
      const mailResult = await sendEmail({
        to: cleanEmail,
        subject: `Nuevo C\xF3digo de Verificaci\xF3n Dimer: ${newCode}`,
        html: emailHtml
      });
      res.json({
        success: true,
        expiresAt: pending.expiresAt,
        simulatedCode: mailResult.status === "SIMULADO" ? newCode : void 0,
        message: `Se ha reenviado un nuevo c\xF3digo de verificaci\xF3n a ${cleanEmail}.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error al reenviar c\xF3digo" });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const previousUser = getCurrentUser();
    if (previousUser) {
      recordAuditLog({
        userId: previousUser.id,
        action: "CIERRE_SESION",
        details: { email: previousUser.email, role: previousUser.role }
      });
    }
    clearCurrentUser();
    res.json({ success: true, message: "Sesi\xF3n finalizada correctamente" });
  });
  app.post("/api/switch-user", (req, res) => {
    const { emailOrId } = req.body;
    if (!emailOrId) {
      return res.status(400).json({ error: "emailOrId es requerido" });
    }
    const user = setCurrentUser(emailOrId);
    res.json({ success: true, user });
  });
  app.post("/api/auth/register", (req, res) => {
    try {
      const { name, email, password, department, roleId, status } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Nombre, correo y contrase\xF1a son obligatorios" });
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: "Ya existe un usuario registrado con este correo electr\xF3nico." });
      }
      const deptName = department ? department.trim() : "Ventas";
      const deptObj = getOrCreateDepartment(deptName);
      const selectedRoleId = roleId || "role_solicitante";
      const roleDef = ROLES.find((r) => r.id === selectedRoleId) || ROLES[1];
      const role = roleDef.id === "role_admin" ? "ADMIN" : roleDef.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : "SOLICITANTE";
      const { hash, salt } = hashPassword(password);
      const newUser = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        roleId: roleDef.id,
        department: deptObj.name,
        status: status === "INACTIVO" ? "INACTIVO" : "ACTIVO",
        isVerified: true,
        passwordHash: hash,
        salt,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      USERS.push(newUser);
      saveToDisk();
      recordAuditLog({
        userId: getCurrentUser()?.id || newUser.id,
        action: "REGISTRO_USUARIO_ADMIN",
        details: {
          registeredEmail: newUser.email,
          role: newUser.role,
          department: newUser.department
        }
      });
      res.status(201).json({
        success: true,
        user: sanitizeUser(newUser),
        message: "Usuario registrado exitosamente"
      });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error al registrar usuario" });
    }
  });
  app.get("/api/users", (req, res) => {
    const currentUser = getCurrentUser();
    if (!hasPermission(currentUser, "administrar_usuarios") && currentUser?.role !== "ADMIN") {
      return res.status(403).json({ error: "No tienes permiso para administrar usuarios" });
    }
    res.json(USERS.map(sanitizeUser));
  });
  app.post("/api/users", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_usuarios") && currentUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar usuarios" });
      }
      const { name, email, password, department, roleId, role: directRole, status } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: "Nombre y correo son obligatorios" });
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: "El correo electr\xF3nico ya se encuentra en uso." });
      }
      const deptName = department ? department.trim() : "General";
      const deptObj = getOrCreateDepartment(deptName);
      const selectedRoleId = roleId || (directRole === "ADMIN" ? "role_admin" : directRole === "SOLO_LECTURA_APROBADAS" ? "role_solo_lectura" : directRole === "JEFE" ? "role_jefe" : directRole === "FINANZAS" ? "role_finanzas" : "role_solicitante");
      const roleDef = ROLES.find((r) => r.id === selectedRoleId) || ROLES[1];
      const role = roleDef.id === "role_admin" ? "ADMIN" : roleDef.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : roleDef.id === "role_jefe" ? "JEFE" : roleDef.id === "role_finanzas" ? "FINANZAS" : "SOLICITANTE";
      const initialPassword = password || "password123";
      const { hash, salt } = hashPassword(initialPassword);
      const newUser = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        roleId: roleDef.id,
        department: deptObj.name,
        status: status === "INACTIVO" ? "INACTIVO" : "ACTIVO",
        passwordHash: hash,
        salt,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      USERS.push(newUser);
      saveToDisk();
      recordAuditLog({
        userId: currentUser?.id || "usr_adm_1",
        action: "CREACION_USUARIO_ADMIN",
        details: {
          adminEmail: currentUser?.email || "sistemas@dimer.com.mx",
          newUserId: newUser.id,
          newUserEmail: newUser.email,
          role: newUser.role
        }
      });
      res.status(201).json({ success: true, user: sanitizeUser(newUser) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/users/:id", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_usuarios") && currentUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar usuarios" });
      }
      const { id } = req.params;
      const { name, email, department, roleId, role: directRole, status, password } = req.body;
      const userRecord = USERS.find((u) => u.id === id || u.email.toLowerCase() === id.toLowerCase());
      if (!userRecord) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      if (name) userRecord.name = name.trim();
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const conflict = USERS.find((u) => u.id !== userRecord.id && u.email.toLowerCase() === cleanEmail);
        if (conflict) {
          return res.status(400).json({ error: "El correo electr\xF3nico ya pertenece a otro usuario" });
        }
        userRecord.email = cleanEmail;
      }
      if (department) {
        const deptObj = getOrCreateDepartment(department.trim());
        userRecord.department = deptObj.name;
      }
      if (roleId || directRole) {
        const targetRoleId = roleId || (directRole === "ADMIN" ? "role_admin" : directRole === "SOLO_LECTURA_APROBADAS" ? "role_solo_lectura" : directRole === "JEFE" ? "role_jefe" : directRole === "FINANZAS" ? "role_finanzas" : "role_solicitante");
        const roleDef = ROLES.find((r) => r.id === targetRoleId || r.name.toUpperCase() === String(directRole).toUpperCase());
        if (roleDef) {
          userRecord.roleId = roleDef.id;
          userRecord.role = roleDef.id === "role_admin" ? "ADMIN" : roleDef.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : roleDef.id === "role_jefe" ? "JEFE" : roleDef.id === "role_finanzas" ? "FINANZAS" : "SOLICITANTE";
        } else if (directRole) {
          userRecord.role = directRole;
        }
      }
      if (status) {
        userRecord.status = status;
      }
      if (password && password.trim()) {
        const { hash, salt } = hashPassword(password.trim());
        userRecord.passwordHash = hash;
        userRecord.salt = salt;
      }
      saveToDisk();
      recordAuditLog({
        userId: currentUser?.id || "usr_adm_1",
        action: "ACTUALIZACION_USUARIO",
        details: {
          targetUserId: userRecord.id,
          targetUserEmail: userRecord.email,
          status: userRecord.status,
          role: userRecord.role
        }
      });
      res.json({ success: true, user: sanitizeUser(userRecord) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/users/:id", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_usuarios") && currentUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para eliminar o desactivar usuarios" });
      }
      const { id } = req.params;
      const userIndex = USERS.findIndex((u) => u.id === id || u.email.toLowerCase() === id.toLowerCase());
      if (userIndex === -1) return res.status(404).json({ error: "Usuario no encontrado" });
      const target = USERS[userIndex];
      if (target.email.toLowerCase() === "sistemas@dimer.com.mx") {
        return res.status(400).json({ error: "No se puede eliminar la cuenta principal de administraci\xF3n (sistemas@dimer.com.mx)" });
      }
      if (currentUser && target.id === currentUser.id) {
        return res.status(400).json({ error: "No puede eliminar su propia cuenta activa de sesi\xF3n" });
      }
      const isSoft = req.query.soft === "true";
      if (isSoft) {
        target.status = "INACTIVO";
        saveToDisk();
        recordAuditLog({
          userId: currentUser?.id || "usr_adm_1",
          action: "DESACTIVACION_USUARIO",
          details: { targetUserId: target.id, email: target.email }
        });
        return res.json({ success: true, message: `Usuario ${target.name} desactivado.`, user: sanitizeUser(target) });
      } else {
        const [deleted] = USERS.splice(userIndex, 1);
        saveToDisk();
        recordAuditLog({
          userId: currentUser?.id || "usr_adm_1",
          action: "ELIMINACION_USUARIO",
          details: { deletedUserId: deleted.id, email: deleted.email, name: deleted.name }
        });
        return res.json({ success: true, message: `Cuenta de ${deleted.name} (${deleted.email}) eliminada permanentemente.` });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/departments", (req, res) => {
    res.json(DEPARTMENTS);
  });
  app.post("/api/departments", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_departamentos") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar departamentos" });
      }
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "El nombre del departamento es obligatorio" });
      }
      const trimmed = name.trim();
      const existing = DEPARTMENTS.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: "Ya existe un departamento con este nombre" });
      }
      const newDept = {
        id: `dept_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
        name: trimmed,
        description: description?.trim() || "",
        active: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      DEPARTMENTS.push(newDept);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "CREACION_DEPARTAMENTO",
        details: { departmentName: newDept.name }
      });
      res.status(201).json({ success: true, department: newDept });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/departments/:id", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_departamentos") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar departamentos" });
      }
      const { id } = req.params;
      const { name, description, active } = req.body;
      const dept = DEPARTMENTS.find((d) => d.id === id);
      if (!dept) return res.status(404).json({ error: "Departamento no encontrado" });
      if (name && name.trim()) {
        const conflict = DEPARTMENTS.find((d) => d.id !== id && d.name.toLowerCase() === name.trim().toLowerCase());
        if (conflict) return res.status(400).json({ error: "Ya existe otro departamento con este nombre" });
        dept.name = name.trim();
      }
      if (description !== void 0) dept.description = description.trim();
      if (active !== void 0) dept.active = Boolean(active);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "ACTUALIZACION_DEPARTAMENTO",
        details: { departmentId: dept.id, departmentName: dept.name, active: dept.active }
      });
      res.json({ success: true, department: dept });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/bosses", (req, res) => {
    res.json(BOSSES);
  });
  app.post("/api/bosses", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_jefes") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar jefes" });
      }
      const { name, email, department } = req.body;
      if (!name || !email || !department) {
        return res.status(400).json({ error: "Nombre, correo y departamento son requeridos" });
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = BOSSES.find((b) => b.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: "Ya existe un jefe registrado con este correo" });
      }
      const deptObj = getOrCreateDepartment(department.trim());
      const newBoss = {
        id: `boss_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
        name: name.trim(),
        email: cleanEmail,
        department: deptObj.name,
        active: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      BOSSES.push(newBoss);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "CREACION_JEFE",
        details: { bossName: newBoss.name, bossEmail: newBoss.email, department: newBoss.department }
      });
      res.status(201).json({ success: true, boss: newBoss });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  const updateBossHandler = (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_jefes") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar jefes" });
      }
      const { id } = req.params;
      const decodedId = decodeURIComponent(id);
      const { name, email, department, active } = req.body;
      const boss = BOSSES.find(
        (b) => b.id === id || b.id === decodedId || b.email.toLowerCase() === id.toLowerCase() || b.email.toLowerCase() === decodedId.toLowerCase()
      );
      if (!boss) return res.status(404).json({ error: "Jefe o aprobador no encontrado" });
      if (name) boss.name = name.trim();
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const conflict = BOSSES.find((b) => b.id !== boss.id && b.email.toLowerCase() === cleanEmail);
        if (conflict) return res.status(400).json({ error: "El correo electr\xF3nico ya pertenece a otro jefe registrado" });
        boss.email = cleanEmail;
      }
      if (department) {
        const deptObj = getOrCreateDepartment(department.trim());
        boss.department = deptObj.name;
      }
      if (active !== void 0) boss.active = Boolean(active);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "ACTUALIZACION_JEFE",
        details: { bossId: boss.id, name: boss.name, email: boss.email, department: boss.department, active: boss.active }
      });
      res.json({ success: true, boss });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error al actualizar jefe" });
    }
  };
  app.put("/api/bosses/:id", updateBossHandler);
  app.patch("/api/bosses/:id", updateBossHandler);
  app.post("/api/bosses/:id", updateBossHandler);
  app.delete("/api/bosses/:id", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_jefes") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para eliminar o desactivar jefes" });
      }
      const { id } = req.params;
      const decodedId = decodeURIComponent(id);
      const bossIndex = BOSSES.findIndex(
        (b) => b.id === id || b.id === decodedId || b.email.toLowerCase() === id.toLowerCase() || b.email.toLowerCase() === decodedId.toLowerCase()
      );
      if (bossIndex === -1) return res.status(404).json({ error: "Jefe no encontrado" });
      const [removed] = BOSSES.splice(bossIndex, 1);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "ELIMINACION_JEFE",
        details: { bossId: removed.id, name: removed.name, email: removed.email }
      });
      res.json({ success: true, message: `Jefe ${removed.name} eliminado del cat\xE1logo.`, boss: removed });
    } catch (err) {
      res.status(500).json({ error: err.message || "Error al eliminar jefe" });
    }
  });
  app.get("/api/roles", (req, res) => {
    res.json(ROLES);
  });
  app.get("/api/permissions", (req, res) => {
    res.json(ALL_SYSTEM_PERMISSIONS);
  });
  app.post("/api/roles", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_roles") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar roles" });
      }
      const { name, description, permissions } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "El nombre del rol es obligatorio" });
      }
      const trimmedName = name.trim();
      const existing = ROLES.find((r) => r.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: "Ya existe un rol con ese nombre" });
      }
      const newRole = {
        id: `role_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
        name: trimmedName,
        description: description?.trim() || "",
        permissions: Array.isArray(permissions) ? permissions : ["ver_solicitudes"],
        active: true,
        isSystem: false
      };
      ROLES.push(newRole);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "CREACION_ROL",
        details: { roleName: newRole.name, permissionsCount: newRole.permissions.length }
      });
      res.status(201).json({ success: true, role: newRole });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/roles/:id", (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, "administrar_roles") && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No tienes permiso para administrar roles" });
      }
      const { id } = req.params;
      const { name, description, permissions, active } = req.body;
      const role = ROLES.find((r) => r.id === id);
      if (!role) return res.status(404).json({ error: "Rol no encontrado" });
      if (name && name.trim()) {
        const conflict = ROLES.find((r) => r.id !== id && r.name.toLowerCase() === name.trim().toLowerCase());
        if (conflict) return res.status(400).json({ error: "Ya existe otro rol con ese nombre" });
        role.name = name.trim();
      }
      if (description !== void 0) role.description = description.trim();
      if (Array.isArray(permissions)) role.permissions = permissions;
      if (active !== void 0) role.active = Boolean(active);
      saveToDisk();
      recordAuditLog({
        userId: currentUser.id,
        action: "ACTUALIZACION_ROL",
        details: { roleId: role.id, roleName: role.name, permissions: role.permissions }
      });
      res.json({ success: true, role });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/approval-tokens/:token", (req, res) => {
    const { token } = req.params;
    const result = validateApprovalToken(token);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }
    const requester = USERS.find((u) => u.id === result.request?.userId);
    res.json({
      valid: true,
      tokenRecord: result.tokenRecord,
      request: { ...result.request, user: requester ? sanitizeUser(requester) : void 0 }
    });
  });
  app.post("/api/approval-tokens/:token/action", async (req, res) => {
    try {
      const { token } = req.params;
      const { action, amountAuthorized, comments } = req.body;
      if (!["APROBADA", "RECHAZADA"].includes(action)) {
        return res.status(400).json({ error: "Acci\xF3n no v\xE1lida. Solo APROBADA o RECHAZADA." });
      }
      const tokenValidation = validateApprovalToken(token);
      if (!tokenValidation.valid || !tokenValidation.request || !tokenValidation.tokenRecord) {
        return res.status(400).json({ error: tokenValidation.error || "Token inv\xE1lido o expirado" });
      }
      const request = tokenValidation.request;
      const tokenRecord = tokenValidation.tokenRecord;
      if (action === "RECHAZADA" && !comments?.trim()) {
        return res.status(400).json({ error: "El motivo del rechazo es obligatorio" });
      }
      consumeApprovalToken(token, action);
      if (action === "APROBADA") {
        const numAuth = parseFloat(amountAuthorized !== void 0 ? amountAuthorized : request.amountRequested);
        request.status = "APROBADA";
        request.amountAuthorized = isNaN(numAuth) ? request.amountRequested : numAuth;
        if (comments) request.comments = comments.trim();
        request.approvedBy = tokenRecord.bossEmail;
        request.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
        request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        recordAuditLog({
          requestId: request.id,
          userId: `boss_token_${tokenRecord.bossEmail}`,
          action: "APROBACION_VIA_TOKEN_SEGURO",
          details: {
            bossEmail: tokenRecord.bossEmail,
            amountAuthorized: request.amountAuthorized,
            comments: comments || "Aprobado mediante enlace seguro",
            tokenId: tokenRecord.id
          }
        });
        const requester = USERS.find((u) => u.id === request.userId);
        const systemsEmailHtml = buildSystemsApprovedEmailHtml({
          request,
          user: requester ? sanitizeUser(requester) : { name: "Colaborador", email: request.userId, department: "General", role: "EMPLEADO", status: "ACTIVO", id: request.userId },
          approverName: request.bossName || tokenRecord.bossEmail,
          approverEmail: tokenRecord.bossEmail,
          approvedAt: request.approvedAt
        });
        await sendEmail({
          to: "sistemas@dimer.com.mx",
          subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${request.folio}`,
          html: systemsEmailHtml,
          requestId: request.id,
          folio: request.folio
        });
        const finanzasEmail = process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx";
        if (finanzasEmail !== "sistemas@dimer.com.mx") {
          await sendEmail({
            to: finanzasEmail,
            subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${request.folio}`,
            html: systemsEmailHtml,
            requestId: request.id,
            folio: request.folio
          });
        }
      } else {
        request.status = "RECHAZADA";
        request.rejectionReason = comments.trim();
        if (comments) request.comments = comments.trim();
        request.rejectedBy = tokenRecord.bossEmail;
        request.rejectedAt = (/* @__PURE__ */ new Date()).toISOString();
        request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        recordAuditLog({
          requestId: request.id,
          userId: `boss_token_${tokenRecord.bossEmail}`,
          action: "RECHAZO_VIA_TOKEN_SEGURO",
          details: {
            bossEmail: tokenRecord.bossEmail,
            rejectionReason: comments.trim(),
            tokenId: tokenRecord.id
          }
        });
      }
      res.json({
        success: true,
        action,
        folio: request.folio,
        message: `Solicitud ${request.folio} ${action === "APROBADA" ? "aprobada y notificada a sistemas/finanzas" : "rechazada"} exitosamente.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/requests", (req, res) => {
    const { status, roleFilter } = req.query;
    const currentUser = getCurrentUser();
    let list = getPopulatedRequests();
    if (!currentUser) {
      return res.json(list);
    }
    if (currentUser.role === "SOLO_LECTURA_APROBADAS" || currentUser.roleId === "role_solo_lectura") {
      list = list.filter((r) => ["APROBADA", "PAGADA", "FINALIZADA"].includes(r.status));
    } else if (currentUser.role === "SOLICITANTE" || currentUser.roleId === "role_solicitante") {
      if (roleFilter !== "to_approve") {
        list = list.filter(
          (r) => r.userId === currentUser.id || r.user?.email.toLowerCase() === currentUser.email.toLowerCase()
        );
      }
    }
    if (status && status !== "TODAS") {
      list = list.filter((r) => r.status === status);
    }
    if (roleFilter === "mine") {
      list = list.filter(
        (r) => r.userId === currentUser.id || r.user?.email.toLowerCase() === currentUser.email.toLowerCase()
      );
    } else if (roleFilter === "to_approve") {
      list = list.filter(
        (r) => r.bossEmail.toLowerCase() === currentUser.email.toLowerCase() || currentUser.role === "ADMIN"
      );
    } else if (roleFilter === "finanzas" || roleFilter === "approved_only") {
      list = list.filter((r) => ["APROBADA", "PAGADA", "FINALIZADA"].includes(r.status));
    }
    res.json(list);
  });
  app.get("/api/requests/:id", (req, res) => {
    const { id } = req.params;
    const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    const userRecord = USERS.find((u) => u.id === request.userId);
    const relatedLogs = AUDIT_LOGS.filter((l) => l.requestId === request.id);
    const currentUser = getCurrentUser();
    if (currentUser) {
      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: "VISUALIZACION_SOLICITUD",
        details: {
          viewerRole: currentUser.role,
          viewerEmail: currentUser.email,
          folio: request.folio
        }
      });
    }
    res.json({
      request: { ...request, user: userRecord ? sanitizeUser(userRecord) : void 0 },
      auditLogs: relatedLogs,
      canApprove: currentUser ? currentUser.email.toLowerCase() === request.bossEmail.toLowerCase() || currentUser.role === "ADMIN" || hasPermission(currentUser, "aprobar_solicitudes") : false
    });
  });
  app.post("/api/requests", async (req, res) => {
    try {
      const activeUser = getCurrentUser() || USERS[1];
      const {
        bossId,
        bossEmail,
        requesterName,
        department,
        requestType,
        detail,
        requestDate,
        urgency,
        startDate,
        endDate,
        destination,
        reason,
        amountRequested,
        transportCost,
        hotelCost,
        foodCost,
        miscCost,
        comments
      } = req.body;
      const finalReason = (detail || reason || "").trim();
      const finalDestination = (destination || "Oficina / Centro Corporativo").trim();
      const finalStartDate = startDate || (/* @__PURE__ */ new Date()).toISOString();
      const finalEndDate = endDate || finalStartDate;
      if (!finalReason) {
        return res.status(400).json({ error: "La descripci\xF3n o detalle de lo solicitado es obligatorio" });
      }
      let targetBossEmail = bossEmail?.trim()?.toLowerCase();
      let targetBossName = "";
      if (bossId) {
        const foundBoss = BOSSES.find((b) => b.id === bossId);
        if (foundBoss) {
          targetBossEmail = foundBoss.email.toLowerCase();
          targetBossName = foundBoss.name;
        }
      }
      if (!targetBossEmail) {
        return res.status(400).json({ error: "Debe seleccionar un jefe que autoriza" });
      }
      const numAmount = parseFloat(amountRequested || "0");
      if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({ error: "El monto solicitado debe ser un valor v\xE1lido" });
      }
      const folio = generateNextFolio();
      const requestId = `req_${Date.now()}`;
      const tokenRecord = createApprovalToken(requestId, targetBossEmail, bossId);
      const resolvedRequesterName = (requesterName?.trim() || activeUser.name).trim();
      const resolvedDepartment = (department?.trim() || activeUser.department || "General").trim();
      const resolvedRequestType = (requestType?.trim() || "Vi\xE1ticos y Gastos de Viaje").trim();
      const resolvedUrgency = urgency?.trim()?.toLowerCase() || "media";
      const resolvedRequestDate = (requestDate?.trim() || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]).trim();
      const newRequest = {
        id: requestId,
        folio,
        status: "PENDIENTE_APROBACION",
        userId: activeUser.id,
        requesterName: resolvedRequesterName,
        department: resolvedDepartment,
        requestType: resolvedRequestType,
        detail: finalReason,
        requestDate: resolvedRequestDate,
        urgency: resolvedUrgency,
        bossId: bossId || void 0,
        bossEmail: targetBossEmail,
        bossName: targetBossName || targetBossEmail,
        startDate: finalStartDate,
        endDate: finalEndDate,
        destination: finalDestination,
        reason: finalReason,
        amountRequested: numAmount,
        amountAuthorized: null,
        transportCost: Number(transportCost) || 0,
        hotelCost: Number(hotelCost) || 0,
        foodCost: Number(foodCost) || 0,
        miscCost: Number(miscCost) || 0,
        comments: comments?.trim() || null,
        approvalToken: tokenRecord.token,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      TRAVEL_REQUESTS.unshift(newRequest);
      saveToDisk();
      recordAuditLog({
        requestId: newRequest.id,
        userId: activeUser.id,
        action: "CREACION_SOLICITUD",
        details: {
          folio: newRequest.folio,
          requesterName: newRequest.requesterName,
          department: newRequest.department,
          requestType: newRequest.requestType,
          urgency: newRequest.urgency,
          bossEmail: newRequest.bossEmail,
          bossName: newRequest.bossName,
          amountRequested: newRequest.amountRequested,
          destination: newRequest.destination
        }
      });
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const approveUrl = `${appUrl}/api/approval/token-action?token=${tokenRecord.token}&action=approve`;
      const rejectUrl = `${appUrl}/api/approval/token-action?token=${tokenRecord.token}&action=reject`;
      const emailHtml = buildBossApprovalEmailHtml({
        request: newRequest,
        user: activeUser,
        approveUrl,
        rejectUrl,
        token: tokenRecord.token
      });
      const mailResult = await sendEmail({
        to: newRequest.bossEmail,
        subject: `SOLICITUD POR AUTORIZAR - Folio ${newRequest.folio} (${newRequest.requestType})`,
        html: emailHtml,
        requestId: newRequest.id,
        folio: newRequest.folio
      });
      if (newRequest.bossEmail.toLowerCase() !== "sistemas@dimer.com.mx") {
        await sendEmail({
          to: "sistemas@dimer.com.mx",
          subject: `Nueva solicitud por autorizar - ${newRequest.requestType} (Folio ${newRequest.folio})`,
          html: emailHtml,
          requestId: newRequest.id,
          folio: newRequest.folio
        });
      }
      res.status(201).json({
        success: true,
        request: { ...newRequest, user: activeUser },
        approvalToken: tokenRecord.token,
        mailResult
      });
    } catch (err) {
      console.error("Error creating travel request:", err);
      res.status(500).json({ error: err.message || "Error al procesar la solicitud" });
    }
  });
  app.get("/api/approval/token-action", async (req, res) => {
    try {
      const { token, action, reason } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).send(buildTokenApprovalResultPageHtml({
          status: "INVALIDA",
          errorMessage: "El token de autorizaci\xF3n no fue proporcionado o no es v\xE1lido."
        }));
      }
      const tokenRecord = APPROVAL_TOKENS.find((t) => t.token === token);
      if (!tokenRecord) {
        return res.status(404).send(buildTokenApprovalResultPageHtml({
          status: "INVALIDA",
          errorMessage: "El token de autorizaci\xF3n no existe o ha expirado."
        }));
      }
      const request = TRAVEL_REQUESTS.find((r) => r.id === tokenRecord.requestId || r.folio === tokenRecord.requestId);
      if (!request) {
        return res.status(404).send(buildTokenApprovalResultPageHtml({
          status: "INVALIDA",
          errorMessage: "No se encontr\xF3 la solicitud de vi\xE1ticos asociada a este token."
        }));
      }
      if (tokenRecord.expiresAt && Date.now() > new Date(tokenRecord.expiresAt).getTime()) {
        return res.status(410).send(buildTokenApprovalResultPageHtml({
          status: "INVALIDA",
          request,
          errorMessage: "Este enlace de autorizaci\xF3n ha expirado (vigencia de 7 d\xEDas)."
        }));
      }
      if (tokenRecord.used || request.status !== "PENDIENTE_APROBACION") {
        return res.send(buildTokenApprovalResultPageHtml({
          status: "YA_PROCESADA",
          request,
          processedBy: request.approvedBy || request.rejectedBy || tokenRecord.bossEmail,
          processedAt: request.approvedAt || request.rejectedAt || request.updatedAt
        }));
      }
      const isReject = action === "reject" || action === "rechazar";
      if (isReject) {
        const rejectionReason = typeof reason === "string" && reason.trim() ? reason.trim() : "Rechazado directamente desde el correo electr\xF3nico";
        request.status = "RECHAZADA";
        request.rejectionReason = rejectionReason;
        request.comments = rejectionReason;
        request.rejectedBy = tokenRecord.bossEmail;
        request.rejectedAt = (/* @__PURE__ */ new Date()).toISOString();
        request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        consumeApprovalToken(token, "RECHAZADA");
        saveToDisk();
        recordAuditLog({
          requestId: request.id,
          userId: "email_token_action",
          action: "RECHAZO_DIRECTO_EMAIL",
          details: {
            rejectedBy: tokenRecord.bossEmail,
            reason: rejectionReason,
            folio: request.folio
          }
        });
        return res.send(buildTokenApprovalResultPageHtml({
          status: "RECHAZADA",
          request,
          actionTaken: "RECHAZADA",
          processedBy: tokenRecord.bossEmail,
          processedAt: request.rejectedAt
        }));
      } else {
        request.status = "APROBADA";
        request.amountAuthorized = request.amountRequested;
        request.approvedBy = tokenRecord.bossEmail;
        request.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
        request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        consumeApprovalToken(token, "APROBADA");
        saveToDisk();
        recordAuditLog({
          requestId: request.id,
          userId: "email_token_action",
          action: "APROBACION_DIRECTA_EMAIL",
          details: {
            approvedBy: tokenRecord.bossEmail,
            amountRequested: request.amountRequested,
            amountAuthorized: request.amountAuthorized,
            folio: request.folio
          }
        });
        const requesterUser = USERS.find((u) => u.id === request.userId);
        const dummyUser = requesterUser ? sanitizeUser(requesterUser) : {
          id: request.userId,
          name: request.requesterName,
          email: request.userId,
          department: request.department,
          role: "SOLICITANTE",
          status: "ACTIVO",
          createdAt: request.createdAt
        };
        const systemsEmailHtml = buildSystemsApprovedEmailHtml({
          request,
          user: dummyUser,
          approverName: tokenRecord.bossEmail,
          approverEmail: tokenRecord.bossEmail,
          approvedAt: request.approvedAt
        });
        await sendEmail({
          to: "sistemas@dimer.com.mx",
          subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${request.folio}`,
          html: systemsEmailHtml,
          requestId: request.id,
          folio: request.folio
        });
        const finanzasEmail = process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx";
        if (finanzasEmail.toLowerCase() !== "sistemas@dimer.com.mx") {
          await sendEmail({
            to: finanzasEmail,
            subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${request.folio}`,
            html: systemsEmailHtml,
            requestId: request.id,
            folio: request.folio
          });
        }
        return res.send(buildTokenApprovalResultPageHtml({
          status: "APROBADA",
          request,
          actionTaken: "APROBADA",
          processedBy: tokenRecord.bossEmail,
          processedAt: request.approvedAt
        }));
      }
    } catch (err) {
      console.error("Error en token direct action:", err);
      return res.status(500).send(buildTokenApprovalResultPageHtml({
        status: "INVALIDA",
        errorMessage: err.message || "Error al procesar la acci\xF3n del token"
      }));
    }
  });
  app.post("/api/requests/:id/cancel", (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser();
      const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
      if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (request.userId !== currentUser.id && currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "Solo el solicitante o Administrador puede cancelar esta solicitud" });
      }
      if (["APROBADA", "PAGADA", "FINALIZADA"].includes(request.status)) {
        return res.status(400).json({ error: `No se puede cancelar una solicitud en estado ${request.status}` });
      }
      request.status = "CANCELADA";
      request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      saveToDisk();
      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: "CANCELACION_SOLICITUD",
        details: { cancelledBy: currentUser.email, folio: request.folio }
      });
      res.json({ success: true, request });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/requests/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const { amountAuthorized, comments } = req.body;
      const currentUser = getCurrentUser();
      const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
      if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }
      const isBoss = currentUser.email.toLowerCase() === request.bossEmail.toLowerCase();
      const isAdmin = currentUser.role === "ADMIN" || hasPermission(currentUser, "aprobar_solicitudes");
      if (!isBoss && !isAdmin) {
        return res.status(403).json({
          error: `Acceso no autorizado. Debe autenticarse como ${request.bossEmail} o Administrador. Su usuario actual es ${currentUser.email}`
        });
      }
      const numAuthorized = parseFloat(amountAuthorized !== void 0 ? amountAuthorized : request.amountRequested);
      if (isNaN(numAuthorized) || numAuthorized < 0) {
        return res.status(400).json({ error: "Monto autorizado no v\xE1lido" });
      }
      request.status = "APROBADA";
      request.amountAuthorized = numAuthorized;
      if (comments) request.comments = comments.trim();
      request.approvedBy = currentUser.email;
      request.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
      request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (request.approvalToken) {
        consumeApprovalToken(request.approvalToken, "APROBADA");
      }
      saveToDisk();
      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: "APROBACION_JEFE",
        details: {
          approvedBy: currentUser.email,
          amountRequested: request.amountRequested,
          amountAuthorized: request.amountAuthorized,
          comments: comments || "Sin observaciones"
        }
      });
      const requesterUser = USERS.find((u) => u.id === request.userId);
      const sanitizedRequester = requesterUser ? sanitizeUser(requesterUser) : currentUser;
      const systemsEmailHtml = buildSystemsApprovedEmailHtml({
        request,
        user: sanitizedRequester,
        approverName: currentUser.name,
        approverEmail: currentUser.email,
        approvedAt: request.approvedAt
      });
      await sendEmail({
        to: "sistemas@dimer.com.mx",
        subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${request.folio}`,
        html: systemsEmailHtml,
        requestId: request.id,
        folio: request.folio
      });
      const finanzasEmail = process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx";
      if (finanzasEmail !== "sistemas@dimer.com.mx") {
        await sendEmail({
          to: finanzasEmail,
          subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${request.folio}`,
          html: systemsEmailHtml,
          requestId: request.id,
          folio: request.folio
        });
      }
      res.json({
        success: true,
        request: { ...request, user: sanitizedRequester }
      });
    } catch (err) {
      console.error("Error approving travel request:", err);
      res.status(500).json({ error: err.message || "Error al autorizar solicitud" });
    }
  });
  app.post("/api/requests/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const currentUser = getCurrentUser();
      const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
      if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
      const isBoss = currentUser.email.toLowerCase() === request.bossEmail.toLowerCase();
      const isAdmin = currentUser.role === "ADMIN" || hasPermission(currentUser, "aprobar_solicitudes");
      if (!isBoss && !isAdmin) {
        return res.status(403).json({ error: `No autorizado. Se requiere ${request.bossEmail}` });
      }
      if (!comments?.trim()) {
        return res.status(400).json({ error: "El motivo del rechazo es obligatorio" });
      }
      request.status = "RECHAZADA";
      request.rejectionReason = comments.trim();
      request.comments = comments.trim();
      request.rejectedBy = currentUser.email;
      request.rejectedAt = (/* @__PURE__ */ new Date()).toISOString();
      request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (request.approvalToken) {
        consumeApprovalToken(request.approvalToken, "RECHAZADA");
      }
      saveToDisk();
      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: "RECHAZO_JEFE",
        details: {
          rejectedBy: currentUser.email,
          reason: comments.trim()
        }
      });
      res.json({ success: true, request });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/requests/:id/request-correction", async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const currentUser = getCurrentUser();
      const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
      if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
      const isBoss = currentUser.email.toLowerCase() === request.bossEmail.toLowerCase();
      const isAdmin = currentUser.role === "ADMIN" || hasPermission(currentUser, "aprobar_solicitudes");
      if (!isBoss && !isAdmin) {
        return res.status(403).json({ error: `No autorizado. Se requiere ${request.bossEmail}` });
      }
      request.status = "CORRECCION_SOLICITADA";
      if (comments) request.comments = comments.trim();
      request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      saveToDisk();
      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: "SOLICITUD_CORRECCION",
        details: {
          requestedBy: currentUser.email,
          notes: comments || "Revisar montos o documentaci\xF3n"
        }
      });
      res.json({ success: true, request });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/requests/:id/pay", (req, res) => {
    const { id } = req.params;
    const { reference, notes } = req.body;
    const currentUser = getCurrentUser();
    const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
    if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
    request.status = "PAGADA";
    request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveToDisk();
    recordAuditLog({
      requestId: request.id,
      userId: currentUser.id,
      action: "DISPERSION_PAGO",
      details: {
        paidBy: currentUser.email,
        amount: request.amountAuthorized || request.amountRequested,
        reference: reference || "SPEI-DIRECTO",
        notes: notes || "Pago procesado por Finanzas"
      }
    });
    res.json({ success: true, request });
  });
  app.post("/api/requests/:id/finalize", (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const currentUser = getCurrentUser();
    const request = TRAVEL_REQUESTS.find((r) => r.id === id || r.folio === id);
    if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
    request.status = "FINALIZADA";
    request.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveToDisk();
    recordAuditLog({
      requestId: request.id,
      userId: currentUser.id,
      action: "FINALIZACION_COMPROBACION",
      details: {
        finalizedBy: currentUser.email,
        notes: notes || "Comprobaci\xF3n de gastos cerrada satisfactoriamente"
      }
    });
    res.json({ success: true, request });
  });
  app.get("/api/audit-logs", (req, res) => {
    const { requestId } = req.query;
    if (requestId) {
      return res.json(AUDIT_LOGS.filter((l) => l.requestId === requestId));
    }
    res.json(AUDIT_LOGS);
  });
  app.get("/api/outbox", (req, res) => {
    res.json(outboxLogs);
  });
  app.get("/api/smtp/status", (req, res) => {
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = process.env.SMTP_PORT?.trim() || "465";
    const user = process.env.SMTP_USER?.trim().replace(/^["']|["']$/g, "") || "sistemas@dimer.com.mx";
    const pass = process.env.SMTP_PASS?.trim().replace(/^["']|["']$/g, "");
    const secure = process.env.SMTP_SECURE;
    const from = getFromAddress();
    res.json({
      configured: Boolean(user && pass),
      details: {
        host,
        port,
        user: user ? `${user.substring(0, 3)}***@${user.split("@")[1] || ""}` : "sistemas@dimer.com.mx",
        hasPassword: Boolean(pass),
        secure: secure === "true" || port === "465",
        from
      },
      instructions: !pass ? "Falta la contrase\xF1a de aplicaci\xF3n (16 letras) en SMTP_PASS. Los correos se emulan en la Bandeja SMTP." : "Credenciales de Google Workspace configuradas. Listo para enviar correos salientes."
    });
  });
  app.post("/api/smtp/test", async (req, res) => {
    const { targetEmail } = req.body;
    const recipient = targetEmail?.trim() || "sistemas@dimer.com.mx";
    const testHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #4f46e5; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Prueba de Conexi\xF3n SMTP - Dimer</h2>
        <p>Este es un correo de prueba enviado desde el <strong>Sistema Corporativo Dimer</strong> para verificar la conectividad de correo saliente.</p>
        <p><strong>Destinatario:</strong> ${recipient}</p>
        <p><strong>Fecha/Hora:</strong> ${(/* @__PURE__ */ new Date()).toLocaleString("es-MX")}</p>
        <div style="margin-top: 20px; padding: 10px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; color: #16a34a; font-weight: bold;">
          \u2713 Conexi\xF3n con servidor de correo establecida con \xE9xito.
        </div>
      </div>
    `;
    const result = await sendEmail({
      to: recipient,
      subject: `[PRUEBA] Verificaci\xF3n de correo SMTP Dimer - ${(/* @__PURE__ */ new Date()).toLocaleTimeString("es-MX")}`,
      html: testHtml
    });
    res.json({
      ...result,
      targetEmail: recipient
    });
  });
  app.get("/api/stats", (req, res) => {
    const totalRequests = TRAVEL_REQUESTS.length;
    const pendingApproval = TRAVEL_REQUESTS.filter((r) => r.status === "PENDIENTE_APROBACION").length;
    const approved = TRAVEL_REQUESTS.filter((r) => r.status === "APROBADA").length;
    const paid = TRAVEL_REQUESTS.filter((r) => r.status === "PAGADA").length;
    const rejected = TRAVEL_REQUESTS.filter((r) => r.status === "RECHAZADA").length;
    const correctionRequested = TRAVEL_REQUESTS.filter((r) => r.status === "CORRECCION_SOLICITADA").length;
    const totalAmountRequested = TRAVEL_REQUESTS.reduce((acc, r) => acc + r.amountRequested, 0);
    const totalAmountAuthorized = TRAVEL_REQUESTS.reduce((acc, r) => acc + (r.amountAuthorized || 0), 0);
    res.json({
      totalRequests,
      pendingApproval,
      approved,
      paid,
      rejected,
      correctionRequested,
      totalAmountRequested,
      totalAmountAuthorized,
      totalUsers: USERS.length,
      totalDepartments: DEPARTMENTS.length,
      totalBosses: BOSSES.length,
      totalRoles: ROLES.length
    });
  });
  app.get("/api/code-artifacts", (req, res) => {
    res.json(NEXTJS_CODE_ARTIFACTS);
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}`
    });
  });
  return app;
}
export {
  createApp
};


const app = createApp();

export default app;
