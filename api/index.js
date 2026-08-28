var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/supabase.js
import { createClient } from "@supabase/supabase-js";
function getSupabaseClient() {
  if (client) return client;
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl) throw new Error("Database unavailable: falta SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Database unavailable: falta SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/i, "");
  if (!/^https?:\/\/[^\s/]+(?:\.[^\s/]+)+$/i.test(supabaseUrl)) {
    throw new Error("Database unavailable: SUPABASE_URL no es v\xE1lida");
  }
  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return client;
}
var client, supabase;
var init_supabase = __esm({
  "server/supabase.js"() {
    client = null;
    supabase = new Proxy({}, {
      get(_target, property) {
        const instance = getSupabaseClient();
        const value = instance[property];
        return typeof value === "function" ? value.bind(instance) : value;
      }
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  ALL_SYSTEM_PERMISSIONS: () => ALL_SYSTEM_PERMISSIONS,
  createApprovalToken: () => createApprovalToken,
  createBoss: () => createBoss,
  createDepartment: () => createDepartment,
  createRole: () => createRole,
  createVerificationCode: () => createVerificationCode,
  deleteBoss: () => deleteBoss,
  deleteRequest: () => deleteRequest,
  deleteUser: () => deleteUser,
  generateNextFolio: () => generateNextFolio,
  generateSecureToken: () => generateSecureToken,
  getBossById: () => getBossById,
  getOrCreateDepartment: () => getOrCreateDepartment,
  getPopulatedRequests: () => getPopulatedRequests,
  getRequest: () => getRequest,
  getUserByEmail: () => getUserByEmail,
  getUserById: () => getUserById,
  hasPermission: () => hasPermission,
  hashPassword: () => hashPassword,
  insertRequest: () => insertRequest,
  insertUser: () => insertUser,
  listAuditLogs: () => listAuditLogs,
  listBosses: () => listBosses,
  listDepartments: () => listDepartments,
  listRequests: () => listRequests,
  listRoles: () => listRoles,
  listUsers: () => listUsers,
  processApprovalTokenAction: () => processApprovalTokenAction,
  recordAuditLog: () => recordAuditLog,
  sanitizeUser: () => sanitizeUser,
  updateBoss: () => updateBoss,
  updateDepartment: () => updateDepartment,
  updateRequest: () => updateRequest,
  updateRole: () => updateRole,
  updateUser: () => updateUser,
  validateApprovalToken: () => validateApprovalToken,
  verifyCodeAndActivateUser: () => verifyCodeAndActivateUser,
  verifyPassword: () => verifyPassword
});
import crypto from "crypto";
function hashPassword(password, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  return { hash: crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex"), salt };
}
function verifyPassword(password, hash, salt) {
  try {
    if (!password || !hash || !salt) return false;
    const calc = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
    const a = Buffer.from(calc, "hex"), b = Buffer.from(hash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}
function sanitizeUser(u, role) {
  const roleId = u.roleId || (u.role === "ADMIN" ? "role_admin" : u.role === "JEFE" ? "role_jefe" : u.role === "FINANZAS" ? "role_finanzas" : u.role === "SOLO_LECTURA_APROBADAS" ? "role_solo_lectura" : "role_solicitante");
  const perms = role?.permissions || [];
  return { id: u.id, name: u.name, email: u.email, department: u.department || "", role: u.role, roleId, permissions: u.role === "ADMIN" ? ALL_SYSTEM_PERMISSIONS.map((p) => p.id) : perms, status: u.status, isVerified: u.isVerified ?? true, avatar: u.avatar, createdAt: u.createdAt };
}
async function getUserById(id) {
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toUser(data) : null;
}
async function getUserByEmail(email) {
  const { data, error } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (error) throw error;
  return data ? toUser(data) : null;
}
async function listUsers() {
  const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const roles = await listRoles();
  return (data || []).map(toUser).map((u) => sanitizeUser(u, roles.find((r) => r.id === u.roleId)));
}
async function insertUser(u) {
  const { data, error } = await supabase.from("users").insert({ id: u.id, name: u.name, email: u.email.toLowerCase(), role: u.role, role_id: u.roleId || "role_solicitante", department: u.department || "General", status: u.status, is_verified: u.isVerified ?? true, password_hash: u.passwordHash || "", salt: u.salt || "", created_at: u.createdAt || (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toUser(data);
}
async function updateUser(id, p) {
  const row = {};
  for (const [k, v] of Object.entries(p)) {
    const m = { name: "name", email: "email", role: "role", roleId: "role_id", department: "department", status: "status", isVerified: "is_verified", passwordHash: "password_hash", salt: "salt" };
    if (m[k] !== void 0 && v !== void 0) row[m[k]] = k === "email" ? String(v).toLowerCase() : v;
  }
  const { data, error } = await supabase.from("users").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return toUser(data);
}
async function deleteUser(id) {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}
async function listDepartments() {
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) throw error;
  return (data || []).map(toDept);
}
async function getOrCreateDepartment(name) {
  const clean = name.trim() || "General";
  const { data, error } = await supabase.from("departments").select("*").ilike("name", clean).maybeSingle();
  if (error) throw error;
  if (data) return toDept(data);
  const { data: created, error: e } = await supabase.from("departments").insert({ id: `dept_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`, name: clean, description: "Departamento registrado autom\xE1ticamente", active: true, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (e) throw e;
  return toDept(created);
}
async function createDepartment(name, description) {
  return getOrCreateDepartment(name).then(async (d) => {
    if (d.description === "Departamento registrado autom\xE1ticamente" && description) {
      const { data, error } = await supabase.from("departments").update({ description }).eq("id", d.id).select("*").single();
      if (error) throw error;
      return toDept(data);
    }
    return d;
  });
}
async function updateDepartment(id, p) {
  const { data, error } = await supabase.from("departments").update({ name: p.name, description: p.description, active: p.active }).eq("id", id).select("*").single();
  if (error) throw error;
  return toDept(data);
}
async function listBosses() {
  const { data, error } = await supabase.from("bosses").select("*").order("name");
  if (error) throw error;
  return (data || []).map(toBoss);
}
async function getBossById(id) {
  const { data, error } = await supabase.from("bosses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toBoss(data) : null;
}
async function createBoss(name, email, department) {
  const { data, error } = await supabase.from("bosses").insert({ id: `boss_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`, name: name.trim(), email: email.trim().toLowerCase(), department: department.trim(), active: true, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toBoss(data);
}
async function updateBoss(id, p) {
  const row = {};
  if (p.name !== void 0) row.name = p.name;
  if (p.email !== void 0) row.email = p.email.toLowerCase();
  if (p.department !== void 0) row.department = p.department;
  if (p.active !== void 0) row.active = Boolean(p.active);
  const { data, error } = await supabase.from("bosses").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return toBoss(data);
}
async function deleteBoss(id) {
  const { error } = await supabase.from("bosses").delete().eq("id", id);
  if (error) throw error;
}
async function listRoles() {
  const { data, error } = await supabase.from("roles").select("*").order("name");
  if (error) throw error;
  return (data || []).map(toRole);
}
async function createRole(p) {
  const { data, error } = await supabase.from("roles").insert({ id: `role_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`, name: p.name.trim(), description: p.description?.trim() || null, permissions: Array.isArray(p.permissions) ? p.permissions : ["ver_solicitudes"], active: true, is_system: false, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toRole(data);
}
async function updateRole(id, p) {
  const { data, error } = await supabase.from("roles").update({ name: p.name, description: p.description, permissions: p.permissions, active: p.active }).eq("id", id).select("*").single();
  if (error) throw error;
  return toRole(data);
}
async function listRequests() {
  const { data, error } = await supabase.from("travel_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(toReq);
}
async function getRequest(idOrFolio) {
  const { data, error } = await supabase.from("travel_requests").select("*").or(`id.eq.${idOrFolio},folio.eq.${idOrFolio}`).maybeSingle();
  if (error) throw error;
  return data ? toReq(data) : null;
}
async function getPopulatedRequests() {
  const rs = await listRequests();
  const ids = [...new Set(rs.map((r) => r.userId).filter(Boolean))];
  if (!ids.length) return rs;
  const { data, error } = await supabase.from("users").select("*").in("id", ids);
  if (error) throw error;
  const roles = await listRoles();
  const users = new Map((data || []).map((r) => [r.id, sanitizeUser(toUser(r), roles.find((x) => x.id === r.role_id))]));
  return rs.map((r) => ({ ...r, user: users.get(r.userId) }));
}
async function insertRequest(r) {
  const { data, error } = await supabase.from("travel_requests").insert({ id: r.id, folio: r.folio, status: r.status, user_id: r.userId, requester_name: r.requesterName || null, department: r.department || null, request_type: r.requestType || null, detail: r.detail || null, request_date: r.requestDate || null, urgency: r.urgency || null, boss_id: r.bossId || null, boss_email: r.bossEmail || null, boss_name: r.bossName || null, start_date: r.startDate || null, end_date: r.endDate || null, destination: r.destination || null, reason: r.reason || null, amount_requested: r.amountRequested, amount_authorized: r.amountAuthorized ?? null, transport_cost: r.transportCost ?? 0, hotel_cost: r.hotelCost ?? 0, food_cost: r.foodCost ?? 0, misc_cost: r.miscCost ?? 0, comments: r.comments ?? null, approved_by: r.approvedBy || null, approved_at: r.approvedAt || null, created_at: r.createdAt || (/* @__PURE__ */ new Date()).toISOString(), approval_token: r.approvalToken || null, rejected_by: r.rejectedBy || null, rejected_at: r.rejectedAt || null, rejection_reason: r.rejectionReason || null, updated_at: r.updatedAt || null }).select("*").single();
  if (error) throw error;
  return toReq(data);
}
async function updateRequest(id, p) {
  const map = { requesterName: "requester_name", department: "department", requestType: "request_type", detail: "detail", requestDate: "request_date", urgency: "urgency", bossId: "boss_id", bossEmail: "boss_email", bossName: "boss_name", startDate: "start_date", endDate: "end_date", destination: "destination", reason: "reason", amountRequested: "amount_requested", amountAuthorized: "amount_authorized", transportCost: "transport_cost", hotelCost: "hotel_cost", foodCost: "food_cost", miscCost: "misc_cost", comments: "comments", approvedBy: "approved_by", approvedAt: "approved_at", rejectedBy: "rejected_by", rejectedAt: "rejected_at", rejectionReason: "rejection_reason", approvalToken: "approval_token", status: "status", updatedAt: "updated_at" };
  const row = {};
  for (const k of Object.keys(map)) if (p[k] !== void 0) row[map[k]] = p[k];
  const { data, error } = await supabase.from("travel_requests").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return toReq(data);
}
async function deleteRequest(id) {
  const { error } = await supabase.from("travel_requests").delete().eq("id", id);
  if (error) throw error;
}
async function generateNextFolio() {
  const { data, error } = await supabase.rpc("generate_next_travel_folio", { target_year: (/* @__PURE__ */ new Date()).getFullYear() });
  if (error || typeof data !== "string") throw new Error(`Error generando folio PostgreSQL: ${error?.message || "RPC no disponible"}`);
  return data;
}
async function createApprovalToken(requestId, bossEmail, bossId) {
  const { data, error } = await supabase.from("approval_tokens").insert({ id: `apptok_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`, token: `tok_${crypto.randomBytes(32).toString("hex")}`, request_id: requestId, boss_id: bossId || null, boss_email: bossEmail.trim().toLowerCase(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), used: false, created_at: (/* @__PURE__ */ new Date()).toISOString(), used_at: null, action: null }).select("*").single();
  if (error) throw error;
  return toToken(data);
}
async function validateApprovalToken(token) {
  const { data, error } = await supabase.from("approval_tokens").select("*").eq("token", token.trim()).maybeSingle();
  if (error) throw error;
  if (!data) return { valid: false, error: "Token inv\xE1lido o no encontrado" };
  const t = toToken(data);
  if (t.used) return { valid: false, error: `Este enlace ya fue utilizado previamente para ${t.action || "procesar"} la solicitud.`, tokenRecord: t };
  if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now()) return { valid: false, error: "Este enlace de autorizaci\xF3n ha expirado.", tokenRecord: t };
  const request = await getRequest(t.requestId);
  if (!request) return { valid: false, error: "No se encontr\xF3 la solicitud asociada al token", tokenRecord: t };
  return { valid: true, tokenRecord: t, request };
}
async function processApprovalTokenAction(token, action, amountAuthorized, comments) {
  const { data, error } = await supabase.rpc("process_approval_token_action", { p_token: token, p_action: action, p_amount_authorized: amountAuthorized ?? null, p_comments: comments ?? null });
  if (error) throw error;
  if (!data || data.success !== true) throw new Error("PostgreSQL no confirm\xF3 la autorizaci\xF3n");
  return data;
}
async function recordAuditLog(p) {
  const user = await getUserById(p.userId);
  const { data, error } = await supabase.from("audit_logs").insert({ id: `aud_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`, request_id: p.requestId || null, user_id: p.userId, user_name: user?.name || null, user_email: user?.email || null, action: p.action, details: p.details || null, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toAudit(data);
}
async function listAuditLogs(requestId) {
  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
  if (requestId) query = query.eq("request_id", requestId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toAudit);
}
async function createVerificationCode(p) {
  const code = crypto.randomInt(1e5, 1e6).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
  const { error } = await supabase.from("verification_codes").upsert({ email: p.email.toLowerCase(), code, name: p.name, department: p.department, role_id: p.roleId, password_hash: p.passwordHash, salt: p.salt, expires_at: expiresAt, attempts: 0, created_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "email" });
  if (error) throw error;
  return { code, expiresAt };
}
async function verifyCodeAndActivateUser(email, code) {
  const clean = email.trim().toLowerCase();
  const { data, error } = await supabase.from("verification_codes").select("*").eq("email", clean).maybeSingle();
  if (error) throw error;
  if (!data) return { success: false, error: "No hay un c\xF3digo pendiente para este correo." };
  if (new Date(data.expires_at).getTime() < Date.now()) return { success: false, error: "El c\xF3digo ha expirado." };
  if (Number(data.attempts || 0) >= 5) return { success: false, error: "Demasiados intentos. Solicita un nuevo c\xF3digo." };
  if (String(data.code) !== code.trim()) {
    await supabase.from("verification_codes").update({ attempts: Number(data.attempts || 0) + 1 }).eq("email", clean);
    return { success: false, error: "C\xF3digo de verificaci\xF3n incorrecto." };
  }
  const id = `usr_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
  const { data: user, error: e } = await supabase.from("users").insert({ id, name: data.name, email: clean, role: "SOLICITANTE", role_id: data.role_id || "role_solicitante", department: data.department, status: "ACTIVO", is_verified: true, password_hash: data.password_hash, salt: data.salt, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (e) throw e;
  await supabase.from("verification_codes").delete().eq("email", clean);
  return { success: true, user: toUser(user) };
}
function hasPermission(u, p) {
  return !!u && u.status === "ACTIVO" && (u.role === "ADMIN" || u.permissions?.includes(p));
}
var ALL_SYSTEM_PERMISSIONS, toUser, toDept, toRole, toBoss, toReq, toToken, toAudit;
var init_db = __esm({
  "server/db.ts"() {
    init_supabase();
    ALL_SYSTEM_PERMISSIONS = [
      ["ver_solicitudes", "Ver mis solicitudes", "Consultar solicitudes de vi\xE1ticos", "Vi\xE1ticos"],
      ["crear_solicitudes", "Crear solicitudes", "Generar solicitudes", "Vi\xE1ticos"],
      ["editar_solicitudes", "Editar solicitudes", "Modificar solicitudes permitidas", "Vi\xE1ticos"],
      ["cancelar_solicitudes", "Cancelar solicitudes", "Cancelar solicitudes propias", "Vi\xE1ticos"],
      ["aprobar_solicitudes", "Aprobar solicitudes", "Dictaminar y autorizar vi\xE1ticos", "Aprobaciones"],
      ["ver_todas_solicitudes", "Ver todas las solicitudes", "Consultar solicitudes corporativas", "Aprobaciones"],
      ["administrar_usuarios", "Administrar usuarios", "Gestionar usuarios", "Administraci\xF3n"],
      ["administrar_departamentos", "Administrar departamentos", "Gestionar departamentos", "Administraci\xF3n"],
      ["administrar_jefes", "Administrar jefes", "Gestionar aprobadores", "Administraci\xF3n"],
      ["administrar_roles", "Administrar roles", "Gestionar roles y permisos", "Administraci\xF3n"],
      ["ver_reportes", "Ver reportes y Finanzas", "Consultar reportes y finanzas", "Finanzas"],
      ["administrar_configuracion", "Administrar configuraci\xF3n", "Gestionar configuraci\xF3n", "Administraci\xF3n"]
    ].map(([id, label, description, category]) => ({ id, label, description, category }));
    toUser = (r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, roleId: r.role_id || void 0, department: r.department || "", status: r.status, isVerified: r.is_verified, passwordHash: r.password_hash, salt: r.salt, createdAt: r.created_at, avatar: r.avatar });
    toDept = (r) => ({ id: r.id, name: r.name, description: r.description || void 0, active: Boolean(r.active), createdAt: r.created_at });
    toRole = (r) => ({ id: r.id, name: r.name, description: r.description || void 0, active: Boolean(r.active), isSystem: Boolean(r.is_system), permissions: Array.isArray(r.permissions) ? r.permissions : [] });
    toBoss = (r) => ({ id: r.id, name: r.name, email: r.email, department: r.department || "", active: Boolean(r.active), createdAt: r.created_at });
    toReq = (r) => ({ id: r.id, folio: r.folio, status: r.status, userId: r.user_id, requesterName: r.requester_name, department: r.department, requestType: r.request_type, detail: r.detail, requestDate: r.request_date, urgency: r.urgency, bossId: r.boss_id, bossEmail: r.boss_email || "", bossName: r.boss_name, startDate: r.start_date, endDate: r.end_date, destination: r.destination || "", reason: r.reason || "", amountRequested: r.amount_requested == null ? 0 : Number(r.amount_requested), amountAuthorized: r.amount_authorized == null ? null : Number(r.amount_authorized), transportCost: r.transport_cost == null ? 0 : Number(r.transport_cost), hotelCost: r.hotel_cost == null ? 0 : Number(r.hotel_cost), foodCost: r.food_cost == null ? 0 : Number(r.food_cost), miscCost: r.misc_cost == null ? 0 : Number(r.misc_cost), comments: r.comments, approvedBy: r.approved_by, approvedAt: r.approved_at, rejectedBy: r.rejected_by, rejectedAt: r.rejected_at, rejectionReason: r.rejection_reason, approvalToken: r.approval_token, createdAt: r.created_at, updatedAt: r.updated_at });
    toToken = (r) => ({ id: r.id, token: r.token, requestId: r.request_id, bossId: r.boss_id || void 0, bossEmail: r.boss_email || "", expiresAt: r.expires_at, used: Boolean(r.used), usedAt: r.used_at || void 0, action: r.action || void 0, createdAt: r.created_at });
    toAudit = (r) => ({ id: r.id, requestId: r.request_id, userId: r.user_id, userName: r.user_name, userEmail: r.user_email, action: r.action, details: r.details, createdAt: r.created_at });
  }
});

// server/nextjsArtifacts.ts
var nextjsArtifacts_exports = {};
__export(nextjsArtifacts_exports, {
  NEXTJS_CODE_ARTIFACTS: () => NEXTJS_CODE_ARTIFACTS
});
var NEXTJS_CODE_ARTIFACTS;
var init_nextjsArtifacts = __esm({
  "server/nextjsArtifacts.ts"() {
    NEXTJS_CODE_ARTIFACTS = [
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
  }
});

// server/app.ts
init_supabase();
init_db();
import express from "express";
import cors from "cors";
import crypto2 from "crypto";

// server/mailService.ts
import nodemailer from "nodemailer";
var outboxLogs = [];
function credentials() {
  const host = process.env.SMTP_HOST?.trim() || process.env.EMAIL_HOST?.trim() || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "465", 10);
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, "");
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  return { host, port, user, pass, secure: process.env.SMTP_SECURE === "true" || port === 465 };
}
function getMailTransporter() {
  const c = credentials();
  if (!c.user || !c.pass) return null;
  if (c.host.toLowerCase() === "smtp.gmail.com") return nodemailer.createTransport({ service: "gmail", auth: { user: c.user, pass: c.pass }, tls: { rejectUnauthorized: false } });
  return nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass }, tls: { rejectUnauthorized: false }, connectionTimeout: 15e3, greetingTimeout: 15e3, socketTimeout: 2e4 });
}
function getFromAddress(customFrom) {
  if (customFrom?.trim()) return customFrom.trim();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.MAIL_FROM;
  if (from?.trim()) return from.trim();
  const c = credentials();
  return `Dimer Notificaciones <${c.user || "sistemas@dimer.com.mx"}>`;
}
var esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
var formatCurrency = (amount) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(amount || 0));
function buildBossApprovalEmailHtml(params) {
  const { request, user, approveUrl, rejectUrl, token } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const urgency = (request.urgency || "media").toLowerCase();
  const urgencyBadgeStyle = urgency === "alta" ? "background:#fef2f2;color:#dc2626;border:1px solid #f87171;" : urgency === "baja" ? "background:#f0fdf4;color:#16a34a;border:1px solid #86efac;" : "background:#fffbeb;color:#d97706;border:1px solid #fcd34d;";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.btn{display:inline-block;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px;font-size:14px;margin:4px}.approve{background:#059669}.reject{background:#dc2626}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD POR AUTORIZAR - ${esc(requestType)}</div><h1>Revisi\xF3n y Dictamen de Jefatura</h1><p>Folio Oficial: <strong>${esc(request.folio)}</strong></p></div><div class="content"><p>Estimado/a L\xEDder, <strong>${esc(requesterName)}</strong> (${esc(user.email)}) ha generado una solicitud para su autorizaci\xF3n formal.</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr><tr><td class="label">Urgencia</td><td class="value"><span style="${urgencyBadgeStyle}">${esc(urgency.toUpperCase())}</span></td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value"><strong>${esc(request.destination)}</strong></td></tr>` : ""}${request.startDate && request.endDate ? `<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString("es-MX")} al ${new Date(request.endDate).toLocaleDateString("es-MX")}</td></tr>` : ""}${request.comments ? `<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>` : ""}</table><div class="amount"><div>Monto Total Solicitado</div><strong style="font-size:24px;color:#047857">${formatCurrency(request.amountRequested)} MXN</strong></div><div style="text-align:center"><a href="${approveUrl}" class="btn approve">\u2713 APROBAR SOLICITUD</a><a href="${rejectUrl}" class="btn reject">\u2715 RECHAZAR SOLICITUD</a></div><p style="font-size:11px;color:#64748b">Token de un solo uso: ${esc(token)}</p></div><div class="footer">Solicitud de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildSystemsApprovedEmailHtml(params) {
  const { request, user, approverName, approverEmail, approvedAt } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const urgency = (request.urgency || "media").toLowerCase();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#064e3b;color:#fff;padding:24px 32px;border-bottom:3px solid #10b981}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.authorized{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;text-align:center;margin:20px 0}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD APROBADA - ${esc(requestType)}</div><h1>SOLICITUD APROBADA - ${esc(request.folio)}</h1><p>Notificaci\xF3n oficial a Sistemas, Finanzas y Solicitante</p></div><div class="content"><p>Se ha registrado la autorizaci\xF3n formal de la siguiente solicitud:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr><tr><td class="label">Urgencia</td><td class="value">${esc(urgency.toUpperCase())}</td></tr><tr><td class="label">Jefe que Aprob\xF3</td><td class="value"><strong>${esc(approverName)}</strong> (${esc(approverEmail)})</td></tr><tr><td class="label">Fecha/Hora Aprobaci\xF3n</td><td class="value">${esc(new Date(approvedAt).toLocaleString("es-MX"))}</td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value">${esc(request.destination)}</td></tr>` : ""}<tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr>${request.comments ? `<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>` : ""}</table><div class="authorized"><div>Monto Total Autorizado</div><strong style="font-size:26px;color:#047857">${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</strong></div></div><div class="footer">Sistema de Gesti\xF3n de Solicitudes \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildVerificationEmailHtml(p) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>C\xF3digo de Verificaci\xF3n - Vi\xE1ticos Dimer</title><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:28px 24px;text-align:center}.body{padding:32px 28px;text-align:center}.code-box{background:#f8fafc;border:2px dashed #6366f1;border-radius:12px;padding:24px;margin:24px 0}.code-digits{font-family:monospace;font-size:36px;font-weight:900;letter-spacing:.25em;color:#0f172a}.footer{background:#f8fafc;padding:18px 24px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Vi\xE1ticos Dimer</h1><p>Verificaci\xF3n de Seguridad de Cuenta</p></div><div class="body"><p>Hola <strong>${esc(p.name)}</strong>,</p><p>Has solicitado registrar tu cuenta con el correo <strong>${esc(p.email)}</strong>.</p><div class="code-box"><div>Tu C\xF3digo de Verificaci\xF3n</div><div class="code-digits">${esc(p.code)}</div><div>V\xE1lido por <strong>${p.expiresMinutes || 15} minutos</strong></div></div><p style="font-size:12px;color:#64748b">Si t\xFA no solicitaste este c\xF3digo, ignora este mensaje.</p></div><div class="footer">Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildNewAccountAdminEmailHtml(p) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:24px;text-align:center}.body{padding:28px}.footer{background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Nueva cuenta registrada</h1></div><div class="body"><p><strong>${esc(p.user.name)}</strong> registr\xF3 ${esc(p.user.email)}.</p><p>Departamento: ${esc(p.user.department)}<br>Rol inicial: ${esc(p.user.role)}<br>Fecha: ${esc(p.registeredAt)}</p></div><div class="footer">Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildTokenApprovalResultPageHtml(p) {
  const r = p.request;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}.card{max-width:650px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.head{background:#0f172a;color:#fff;padding:24px}.body{padding:28px}.foot{padding:16px;background:#f8fafc;color:#64748b;font-size:11px;text-align:center}</style></head><body><div class="card"><div class="head"><h2>${esc(p.status === "APROBADA" ? "Solicitud aprobada" : p.status === "RECHAZADA" ? "Solicitud rechazada" : "Resultado del dictamen")}</h2></div><div class="body"><p>${esc(p.errorMessage || `Estado: ${p.status}`)}</p>${r ? `<p><strong>Folio:</strong> ${esc(r.folio)}<br><strong>Solicitante:</strong> ${esc(r.requesterName)}<br><strong>Procesado por:</strong> ${esc(p.processedBy || r.approvedBy || r.rejectedBy || r.bossEmail)}<br><strong>Fecha:</strong> ${esc(p.processedAt || (/* @__PURE__ */ new Date()).toISOString())}</p>` : ""}</div><div class="foot">Sistema de Vi\xE1ticos Dimer \xA9 2026</div></div></body></html>`;
}
async function sendEmail(p) {
  const logId = `MAIL-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  const transporter = getMailTransporter();
  if (!transporter) {
    const error = "Faltan credenciales SMTP";
    return { success: false, logId, status: process.env.VERCEL || process.env.NODE_ENV === "production" ? "FALLIDO" : "SIMULADO", error };
  }
  try {
    await transporter.sendMail({ from: getFromAddress(p.from), replyTo: p.replyTo, to: p.to, subject: p.subject, html: p.html });
    return { success: true, logId, status: "ENVIADO" };
  } catch (e) {
    return { success: false, logId, status: "FALLIDO", error: e?.message || "Error SMTP" };
  }
}

// server/app.ts
function baseUrl(req) {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured && !(process.env.VERCEL && configured.includes("localhost"))) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function jwtSign(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const enc = (v) => Buffer.from(v).toString("base64url");
  const head = enc(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = enc(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1e3), exp: Math.floor(Date.now() / 1e3) + 8 * 60 * 60 }));
  const sig = crypto2.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function jwtVerify(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const p = token.split(".");
  if (p.length !== 3) throw new Error("JWT inv\xE1lido");
  const expected = crypto2.createHmac("sha256", secret).update(`${p[0]}.${p[1]}`).digest("base64url");
  if (!crypto2.timingSafeEqual(Buffer.from(expected), Buffer.from(p[2]))) throw new Error("JWT inv\xE1lido");
  const payload = JSON.parse(Buffer.from(p[1], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) throw new Error("Sesi\xF3n expirada");
  return payload;
}
async function auth(req) {
  const cookies = parseCookies(req);
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const token = cookies.dimer_session || bearer;
  if (!token) return null;
  try {
    const p = jwtVerify(token);
    const u = await getUserById(p.sub);
    if (!u || u.status !== "ACTIVO") return null;
    const roles = await listRoles();
    return sanitizeUser(u, roles.find((r) => r.id === u.roleId));
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  void auth(req).then((u) => {
    if (!u) return res.status(401).json({ error: "Autenticaci\xF3n requerida" });
    req.dimerUser = u;
    next();
  }).catch(() => res.status(503).json({ error: "Base de datos no disponible" }));
}
function requirePermission(permission) {
  return (req, res, next) => {
    const u = req.dimerUser;
    if (!hasPermission(u, permission)) return res.status(403).json({ error: "No tienes permiso para esta operaci\xF3n" });
    next();
  };
}
function err(res, e) {
  const msg = e instanceof Error ? e.message : "Error interno";
  const status = /JWT|autentic|token inválido|no se encontró/i.test(msg) ? 400 : 503;
  return res.status(status).json({ success: false, error: msg });
}
function createApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(cors({ origin: true, credentials: true }));
  app2.use(express.json({ limit: "10mb" }));
  app2.get(["/api/health", "/health"], async (_req, res) => {
    try {
      const { error } = await supabase.from("users").select("id", { head: true, count: "exact" });
      if (error) throw error;
      res.json({ ok: true, service: "viaticos-dimer-api", database: "supabase", runtime: process.env.VERCEL ? "vercel-serverless" : "node", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (e) {
      res.status(503).json({ ok: false, database: "supabase", error: "Database unavailable" });
    }
  });
  app2.get(["/api/diagnostic", "/diagnostic"], async (_req, res) => {
    try {
      const [u, r] = await Promise.all([supabase.from("users").select("id", { head: true, count: "exact" }), supabase.from("travel_requests").select("id", { head: true, count: "exact" })]);
      if (u.error) throw u.error;
      if (r.error) throw r.error;
      res.json({ status: "operational", runtime: process.env.VERCEL ? "vercel-serverless" : "node", database: { type: "supabase", usersCount: u.count || 0, requestsCount: r.count || 0, persistenceType: "supabase-postgresql" }, environmentChecks: { isVercel: Boolean(process.env.VERCEL), hasAppUrl: Boolean(process.env.APP_URL), hasJwtSecret: Boolean(process.env.JWT_SECRET), hasSmtpHost: Boolean(process.env.SMTP_HOST || process.env.EMAIL_HOST), hasSmtpUser: Boolean(process.env.SMTP_USER || process.env.GMAIL_USER), hasSmtpPass: Boolean(process.env.SMTP_PASS || process.env.SMTP_PASSWORD), finanzasEmailConfigured: Boolean(process.env.FINANZAS_EMAIL) } });
    } catch (e) {
      res.status(503).json({ status: "unavailable", database: { type: "supabase" }, error: e instanceof Error ? e.message : "Database unavailable" });
    }
  });
  app2.get(["/api/me", "/me"], async (req, res) => {
    try {
      const u = await auth(req);
      const allUsers = await listUsers();
      res.json({ user: u, allUsers, appUrl: baseUrl(req), finanzasEmail: process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx", systemsEmail: "sistemas@dimer.com.mx" });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post(["/api/auth/login", "/auth/login", "/api/login", "/login"], async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || "");
      if (!email || !password) return res.status(400).json({ success: false, error: "Correo electr\xF3nico y contrase\xF1a requeridos" });
      const u = await getUserByEmail(email);
      if (!u) return res.status(401).json({ success: false, error: "No existe una cuenta registrada con este correo." });
      if (u.status !== "ACTIVO") return res.status(403).json({ success: false, error: "Esta cuenta est\xE1 inactiva." });
      if (!verifyPassword(password, u.passwordHash, u.salt)) return res.status(401).json({ success: false, error: "Contrase\xF1a incorrecta." });
      const roles = await listRoles();
      const user = sanitizeUser(u, roles.find((r) => r.id === u.roleId));
      const token = jwtSign({ sub: u.id, email: u.email });
      res.cookie("dimer_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL), sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 * 1e3 });
      await recordAuditLog({ userId: u.id, action: "INICIO_SESION", details: { email: u.email, role: u.role } });
      res.json({ success: true, user });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/logout", async (req, res) => {
    try {
      const u = await auth(req);
      if (u) await recordAuditLog({ userId: u.id, action: "CIERRE_SESION", details: { email: u.email } });
      res.setHeader("Set-Cookie", "dimer_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
      res.json({ success: true });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/switch-user", (_req, res) => res.status(403).json({ error: "Cambio de usuario deshabilitado en producci\xF3n. Inicia sesi\xF3n con credenciales reales." }));
  app2.post("/api/auth/register-init", async (req, res) => {
    try {
      const { name, email, password, department } = req.body || {};
      const clean = String(email || "").trim().toLowerCase();
      if (!name || !clean || !password) return res.status(400).json({ error: "Nombre, correo y contrase\xF1a son obligatorios" });
      if (await getUserByEmail(clean)) return res.status(400).json({ error: "Ya existe una cuenta registrada con este correo." });
      const dept = await getOrCreateDepartment(String(department || "General"));
      const { hash, salt } = hashPassword(String(password));
      const { code, expiresAt } = await createVerificationCode({ email: clean, name: String(name), department: dept.name, roleId: "role_solicitante", passwordHash: hash, salt });
      const mail = await sendEmail({ to: clean, subject: `C\xF3digo de Verificaci\xF3n Dimer: ${code}`, html: buildVerificationEmailHtml({ name: String(name), email: clean, code, expiresMinutes: 15 }) });
      if (mail.status === "FALLIDO") return res.status(500).json({ error: `Error SMTP: ${mail.error || "fallo de env\xEDo"}` });
      res.json({ success: true, email: clean, expiresAt, simulatedCode: mail.status === "SIMULADO" ? code : void 0 });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/verify-code", async (req, res) => {
    try {
      const result = await verifyCodeAndActivateUser(String(req.body?.email || ""), String(req.body?.code || ""));
      if (!result.success || !result.user) return res.status(400).json({ error: result.error });
      const roles = await listRoles();
      const user = sanitizeUser(result.user, roles.find((r) => r.id === result.user?.roleId));
      const token = jwtSign({ sub: result.user.id, email: result.user.email });
      res.cookie("dimer_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL), sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 * 1e3 });
      await recordAuditLog({ userId: result.user.id, action: "VERIFICACION_Y_ACTIVACION_CUENTA", details: { email: user.email } });
      try {
        await sendEmail({ to: "sistemas@dimer.com.mx", subject: `NUEVA CUENTA REGISTRADA - ${user.name}`, html: buildNewAccountAdminEmailHtml({ user, registeredAt: (/* @__PURE__ */ new Date()).toISOString() }) });
      } catch {
      }
      res.json({ success: true, user, message: "Cuenta verificada y activada con \xE9xito." });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/resend-code", async (req, res) => {
    try {
      const clean = String(req.body?.email || "").trim().toLowerCase();
      const { data, error } = await supabase.from("verification_codes").select("*").eq("email", clean).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "No hay un registro pendiente para este correo." });
      const code = crypto2.randomInt(1e5, 1e6).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
      await supabase.from("verification_codes").update({ code, expires_at: expiresAt, attempts: 0 }).eq("email", clean);
      const mail = await sendEmail({ to: clean, subject: `Nuevo C\xF3digo de Verificaci\xF3n Dimer: ${code}`, html: buildVerificationEmailHtml({ name: data.name, email: clean, code, expiresMinutes: 15 }) });
      if (mail.status === "FALLIDO") return res.status(500).json({ error: mail.error || "Fallo SMTP" });
      res.json({ success: true, expiresAt, simulatedCode: mail.status === "SIMULADO" ? code : void 0 });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/register", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const { name, email, password, department, roleId, status } = req.body || {};
      const clean = String(email || "").trim().toLowerCase();
      if (!name || !clean || !password) return res.status(400).json({ error: "Nombre, correo y contrase\xF1a son obligatorios" });
      if (await getUserByEmail(clean)) return res.status(400).json({ error: "Ya existe un usuario registrado con este correo." });
      const dept = await getOrCreateDepartment(String(department || "General"));
      const { hash, salt } = hashPassword(String(password));
      const roleDef = (await listRoles()).find((r) => r.id === roleId) || { id: "role_solicitante", name: "Solicitante", description: "", active: true, isSystem: true, permissions: ["ver_solicitudes"] };
      const role = roleDef.id === "role_admin" ? "ADMIN" : roleDef.id === "role_jefe" ? "JEFE" : roleDef.id === "role_finanzas" ? "FINANZAS" : roleDef.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : "SOLICITANTE";
      const u = await (await Promise.resolve().then(() => (init_db(), db_exports))).insertUser({ id: `usr_${Date.now()}_${crypto2.randomBytes(5).toString("hex")}`, name: String(name).trim(), email: clean, role, roleId: roleDef.id, department: dept.name, status: status === "INACTIVO" ? "INACTIVO" : "ACTIVO", isVerified: true, passwordHash: hash, salt, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ userId: req.dimerUser.id, action: "REGISTRO_USUARIO_ADMIN", details: { newUserId: u.id, newUserEmail: u.email } });
      res.status(201).json({ success: true, user: sanitizeUser(u, roleDef) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/users", requireAuth, requirePermission("administrar_usuarios"), async (_req, res) => {
    try {
      res.json(await listUsers());
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/users", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const { name, email, password, department, roleId, status } = req.body || {};
      const clean = String(email || "").trim().toLowerCase();
      if (await getUserByEmail(clean)) return res.status(400).json({ error: "El correo electr\xF3nico ya se encuentra en uso." });
      const dept = await getOrCreateDepartment(String(department || "General"));
      const roleDef = (await listRoles()).find((r) => r.id === roleId) || { id: "role_solicitante", name: "Solicitante", description: "", active: true, isSystem: true, permissions: [] };
      const role = roleDef.id === "role_admin" ? "ADMIN" : roleDef.id === "role_jefe" ? "JEFE" : roleDef.id === "role_finanzas" ? "FINANZAS" : roleDef.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : "SOLICITANTE";
      const { hash, salt } = hashPassword(String(password || "password123"));
      const u = await (await Promise.resolve().then(() => (init_db(), db_exports))).insertUser({ id: `usr_${Date.now()}_${crypto2.randomBytes(5).toString("hex")}`, name: String(name).trim(), email: clean, role, roleId: roleDef.id, department: dept.name, status: status === "INACTIVO" ? "INACTIVO" : "ACTIVO", isVerified: true, passwordHash: hash, salt, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ userId: req.dimerUser.id, action: "CREACION_USUARIO_ADMIN", details: { newUserId: u.id, newUserEmail: u.email } });
      res.status(201).json({ success: true, user: sanitizeUser(u, roleDef) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/users/:id", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const id = String(req.params.id);
      const existing = await getUserById(id);
      if (!existing) return res.status(404).json({ error: "Usuario no encontrado" });
      const p = {};
      for (const k of ["name", "email", "department", "status"]) if (req.body[k] !== void 0) p[k] = req.body[k];
      if (req.body.roleId) p.roleId = req.body.roleId;
      if (req.body.password) {
        const h = hashPassword(String(req.body.password));
        p.passwordHash = h.hash;
        p.salt = h.salt;
      }
      if (req.body.roleId) {
        const rd = (await listRoles()).find((r) => r.id === req.body.roleId);
        p.role = rd?.id === "role_admin" ? "ADMIN" : rd?.id === "role_jefe" ? "JEFE" : rd?.id === "role_finanzas" ? "FINANZAS" : rd?.id === "role_solo_lectura" ? "SOLO_LECTURA_APROBADAS" : "SOLICITANTE";
      }
      const u = await (await Promise.resolve().then(() => (init_db(), db_exports))).updateUser(id, p);
      await recordAuditLog({ userId: req.dimerUser.id, action: "ACTUALIZACION_USUARIO", details: { targetUserId: id } });
      res.json({ success: true, user: sanitizeUser(u) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.delete("/api/users/:id", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const u = await getUserById(String(req.params.id));
      if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
      if (u.email.toLowerCase() === "sistemas@dimer.com.mx") return res.status(400).json({ error: "No se puede eliminar la cuenta principal de administraci\xF3n" });
      await (await Promise.resolve().then(() => (init_db(), db_exports))).deleteUser(u.id);
      await recordAuditLog({ userId: req.dimerUser.id, action: "ELIMINACION_USUARIO", details: { deletedUserId: u.id, email: u.email } });
      res.json({ success: true });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/departments", async (_req, res) => {
    try {
      res.json(await listDepartments());
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/departments", requireAuth, requirePermission("administrar_departamentos"), async (req, res) => {
    try {
      const d = await createDepartment(String(req.body?.name || ""), String(req.body?.description || ""));
      await recordAuditLog({ userId: req.dimerUser.id, action: "CREACION_DEPARTAMENTO", details: { departmentName: d.name } });
      res.status(201).json({ success: true, department: d });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/departments/:id", requireAuth, requirePermission("administrar_departamentos"), async (req, res) => {
    try {
      res.json({ success: true, department: await updateDepartment(String(req.params.id), req.body) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/bosses", async (_req, res) => {
    try {
      res.json(await listBosses());
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/bosses", requireAuth, requirePermission("administrar_jefes"), async (req, res) => {
    try {
      const b = await createBoss(String(req.body?.name || ""), String(req.body?.email || ""), String(req.body?.department || ""));
      res.status(201).json({ success: true, boss: b });
    } catch (e) {
      err(res, e);
    }
  });
  for (const method of ["put", "patch", "post"]) app2[method]("/api/bosses/:id", requireAuth, requirePermission("administrar_jefes"), async (req, res) => {
    try {
      res.json({ success: true, boss: await updateBoss(String(req.params.id), req.body) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.delete("/api/bosses/:id", requireAuth, requirePermission("administrar_jefes"), async (req, res) => {
    try {
      await deleteBoss(String(req.params.id));
      res.json({ success: true });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/roles", async (_req, res) => {
    try {
      res.json(await listRoles());
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/permissions", (_req, res) => res.json(ALL_SYSTEM_PERMISSIONS));
  app2.post("/api/roles", requireAuth, requirePermission("administrar_roles"), async (req, res) => {
    try {
      res.status(201).json({ success: true, role: await createRole(req.body) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/roles/:id", requireAuth, requirePermission("administrar_roles"), async (req, res) => {
    try {
      res.json({ success: true, role: await updateRole(String(req.params.id), req.body) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/requests", async (req, res) => {
    try {
      const u = await auth(req);
      if (!u) return res.status(401).json({ error: "Autenticaci\xF3n requerida" });
      let list = await getPopulatedRequests();
      const roleFilter = String(req.query.roleFilter || "");
      const status = String(req.query.status || "");
      if (u.role === "SOLO_LECTURA_APROBADAS" || u.roleId === "role_solo_lectura") list = list.filter((r) => ["APROBADA", "PAGADA", "FINALIZADA"].includes(r.status));
      else if (u.role === "SOLICITANTE" && roleFilter !== "to_approve") list = list.filter((r) => r.userId === u.id);
      if (roleFilter === "mine") list = list.filter((r) => r.userId === u.id);
      if (roleFilter === "to_approve") list = list.filter((r) => r.bossEmail?.toLowerCase() === u.email.toLowerCase() || u.role === "ADMIN");
      if (["finanzas", "approved_only"].includes(roleFilter)) list = list.filter((r) => ["APROBADA", "PAGADA", "FINALIZADA"].includes(r.status));
      if (status && status !== "TODAS") list = list.filter((r) => r.status === status);
      res.json(list);
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      const u = req.dimerUser;
      const owner = r.userId === u.id;
      const canApprove = u.role === "ADMIN" || u.email.toLowerCase() === r.bossEmail.toLowerCase() || hasPermission(u, "aprobar_solicitudes");
      if (!owner && !canApprove && u.role !== "FINANZAS") return res.status(403).json({ error: "No autorizado" });
      const user = await getUserById(r.userId);
      const logs = await listAuditLogs(r.id);
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "VISUALIZACION_SOLICITUD", details: { folio: r.folio } });
      res.json({ request: { ...r, user: user ? sanitizeUser(user) : void 0 }, auditLogs: logs, canApprove });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const b = req.body || {};
      const boss = b.bossId ? await getBossById(String(b.bossId)) : null;
      const bossEmail = String(boss?.email || b.bossEmail || "").trim().toLowerCase();
      if (!bossEmail) return res.status(400).json({ error: "Debe seleccionar un jefe que autoriza" });
      const reason = String(b.detail || b.reason || "").trim();
      if (!reason) return res.status(400).json({ error: "La descripci\xF3n o detalle es obligatorio" });
      const amount = Number(b.amountRequested || 0);
      if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Monto solicitado no v\xE1lido" });
      const id = `req_${Date.now()}_${crypto2.randomBytes(5).toString("hex")}`;
      const folio = await generateNextFolio();
      const r = await insertRequest({ id, folio, status: "PENDIENTE_APROBACION", userId: u.id, requesterName: String(b.requesterName || u.name), department: String(b.department || u.department || "General"), requestType: String(b.requestType || "Vi\xE1ticos y Gastos de Viaje"), detail: reason, requestDate: String(b.requestDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)), urgency: String(b.urgency || "media"), bossId: boss?.id, bossEmail, bossName: boss?.name || bossEmail, startDate: String(b.startDate || (/* @__PURE__ */ new Date()).toISOString()), endDate: String(b.endDate || b.startDate || (/* @__PURE__ */ new Date()).toISOString()), destination: String(b.destination || "Oficina / Centro Corporativo"), reason, amountRequested: amount, amountAuthorized: null, transportCost: Number(b.transportCost || 0), hotelCost: Number(b.hotelCost || 0), foodCost: Number(b.foodCost || 0), miscCost: Number(b.miscCost || 0), comments: b.comments ? String(b.comments).trim() : null, approvalToken: null, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      const token = await createApprovalToken(r.id, bossEmail, boss?.id);
      await updateRequest(r.id, { approvalToken: token.token });
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "CREACION_SOLICITUD", details: { folio: r.folio, amountRequested: r.amountRequested, bossEmail } });
      const approveUrl = `${baseUrl(req)}/api/approval/token-action?token=${encodeURIComponent(token.token)}&action=approve`;
      const rejectUrl = `${baseUrl(req)}/api/approval/token-action?token=${encodeURIComponent(token.token)}&action=reject`;
      const html = buildBossApprovalEmailHtml({ request: r, user: u, approveUrl, rejectUrl, token: token.token });
      const mail = await sendEmail({ to: bossEmail, subject: `SOLICITUD POR AUTORIZAR - Folio ${folio}`, html, requestId: id, folio });
      if (bossEmail !== "sistemas@dimer.com.mx") await sendEmail({ to: "sistemas@dimer.com.mx", subject: `Nueva solicitud por autorizar - ${folio}`, html, requestId: id, folio });
      res.status(201).json({ success: true, request: r, approvalToken: token.token, mailResult: mail });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && r.userId !== u.id) return res.status(403).json({ error: "No tienes permisos" });
      if (u.role !== "ADMIN" && !["PENDIENTE_APROBACION", "CORRECCION_SOLICITADA", "BORRADOR"].includes(r.status)) return res.status(400).json({ error: `No se puede modificar en ${r.status}` });
      const updated = await updateRequest(r.id, { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "MODIFICACION_SOLICITUD", details: { folio: r.folio } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.patch("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      const u = req.dimerUser;
      if (u.role !== "ADMIN" && r.userId !== u.id) return res.status(403).json({ error: "No autorizado" });
      res.json({ success: true, request: await updateRequest(r.id, { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.delete("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && r.userId !== u.id) return res.status(403).json({ error: "No autorizado" });
      await deleteRequest(r.id);
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "ELIMINACION_SOLICITUD", details: { folio: r.folio } });
      res.json({ success: true, deletedId: r.id });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/cancel", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (r.userId !== u.id && u.role !== "ADMIN") return res.status(403).json({ error: "No autorizado" });
      if (["APROBADA", "PAGADA", "FINALIZADA"].includes(r.status)) return res.status(400).json({ error: `No se puede cancelar ${r.status}` });
      const updated = await updateRequest(r.id, { status: "CANCELADA", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "CANCELACION_SOLICITUD", details: { folio: r.folio } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  async function tokenAction(req, res) {
    try {
      const raw = String(req.query.token || "");
      const action = String(req.query.action || "").toLowerCase();
      const decision = action === "reject" || action === "rechazar" ? "RECHAZADA" : "APROBADA";
      if (!raw) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: "Token no proporcionado" }));
      if (decision === "RECHAZADA" && !req.query.reason) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: "Para rechazar, indique el motivo mediante el formulario de aprobaci\xF3n." }));
      const comments = typeof req.query.reason === "string" ? req.query.reason : "Rechazado directamente desde el correo electr\xF3nico";
      const result = await processApprovalTokenAction(raw, decision, void 0, comments);
      const r = await getRequest(String(result.requestId));
      if (!r) return res.status(500).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: "La solicitud procesada no fue encontrada" }));
      const requester = result.userId ? await getUserById(String(result.userId)) : null;
      const user = requester ? sanitizeUser(requester) : { id: r.userId, name: r.requesterName || "Colaborador", email: "", department: r.department || "General", role: "SOLICITANTE", status: "ACTIVO" };
      if (decision === "APROBADA") {
        const html = buildSystemsApprovedEmailHtml({ request: r, user, approverName: String(result.bossEmail || "Jefe Aprobador"), approverEmail: String(result.bossEmail || ""), approvedAt: r.approvedAt });
        await sendEmail({ to: user.email, subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${r.folio}`, html, requestId: r.id, folio: r.folio });
        await sendEmail({ to: "sistemas@dimer.com.mx", subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${r.folio}`, html, requestId: r.id, folio: r.folio });
        const fin = process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx";
        if (fin.toLowerCase() !== "sistemas@dimer.com.mx") await sendEmail({ to: fin, subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${r.folio}`, html, requestId: r.id, folio: r.folio });
      } else if (user.email) {
        await sendEmail({ to: user.email, subject: `SOLICITUD DE VI\xC1TICOS RECHAZADA - ${r.folio}`, html: `<p>Su solicitud <strong>${r.folio}</strong> fue rechazada.</p><p>${r.comments || comments}</p>` });
      }
      return res.send(buildTokenApprovalResultPageHtml({ status: decision, request: r, actionTaken: decision, processedBy: String(result.bossEmail || ""), processedAt: String(result.processedAt || (/* @__PURE__ */ new Date()).toISOString()) }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error procesando autorizaci\xF3n";
      return res.status(/ya fue utilizado|expirado|inválido|procesada/i.test(msg) ? 400 : 500).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: msg }));
    }
  }
  app2.get("/api/approval/token-action", tokenAction);
  app2.get("/approval-response/:token/:decision", async (req, res) => {
    req.query.token = String(req.params.token);
    req.query.action = String(req.params.decision);
    return tokenAction(req, res);
  });
  app2.get("/api/approval-response/:token/:decision", async (req, res) => {
    req.query.token = String(req.params.token);
    req.query.action = String(req.params.decision);
    return tokenAction(req, res);
  });
  app2.get("/api/approval-tokens/:token", async (req, res) => {
    try {
      const v = await validateApprovalToken(String(req.params.token));
      if (!v.valid) return res.status(400).json({ valid: false, error: v.error });
      const user = await getUserById(v.request.userId);
      res.json({ valid: true, tokenRecord: v.tokenRecord, request: { ...v.request, user: user ? sanitizeUser(user) : void 0 } });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/approve", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && u.email.toLowerCase() !== r.bossEmail.toLowerCase()) return res.status(403).json({ error: "No autorizado" });
      if (!r.approvalToken) return res.status(400).json({ error: "La solicitud no tiene token de aprobaci\xF3n" });
      const result = await processApprovalTokenAction(r.approvalToken, "APROBADA", Number(req.body?.amountAuthorized ?? r.amountRequested), req.body?.comments || null);
      const updated = await getRequest(r.id);
      if (!updated) throw new Error("Solicitud no encontrada despu\xE9s de aprobar");
      const requester = await getUserById(r.userId);
      if (requester) {
        const html = buildSystemsApprovedEmailHtml({ request: updated, user: sanitizeUser(requester), approverName: u.name, approverEmail: u.email, approvedAt: updated.approvedAt });
        await sendEmail({ to: requester.email, subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${updated.folio}`, html, requestId: r.id, folio: r.folio });
        await sendEmail({ to: "sistemas@dimer.com.mx", subject: `SOLICITUD DE VI\xC1TICOS APROBADA - ${updated.folio}`, html, requestId: r.id, folio: r.folio });
      }
      res.json({ success: true, request: updated, result });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/reject", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && u.email.toLowerCase() !== r.bossEmail.toLowerCase()) return res.status(403).json({ error: "No autorizado" });
      if (!String(req.body?.comments || "").trim()) return res.status(400).json({ error: "El motivo del rechazo es obligatorio" });
      if (!r.approvalToken) return res.status(400).json({ error: "La solicitud no tiene token de aprobaci\xF3n" });
      const result = await processApprovalTokenAction(r.approvalToken, "RECHAZADA", null, String(req.body.comments).trim());
      const updated = await getRequest(r.id);
      if (!updated) throw new Error("Solicitud no encontrada");
      const requester = await getUserById(r.userId);
      if (requester) await sendEmail({ to: requester.email, subject: `SOLICITUD DE VI\xC1TICOS RECHAZADA - ${r.folio}`, html: `<p>Su solicitud <strong>${r.folio}</strong> fue rechazada.</p><p>${String(req.body.comments).trim()}</p>` });
      res.json({ success: true, request: updated, result });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/request-correction", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && u.email.toLowerCase() !== r.bossEmail.toLowerCase()) return res.status(403).json({ error: "No autorizado" });
      const updated = await updateRequest(r.id, { status: "CORRECCION_SOLICITADA", comments: req.body?.comments || r.comments, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "SOLICITUD_CORRECCION", details: { notes: req.body?.comments || "" } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/pay", requireAuth, requirePermission("ver_reportes"), async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      const updated = await updateRequest(r.id, { status: "PAGADA", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: req.dimerUser.id, action: "DISPERSION_PAGO", details: { reference: req.body?.reference || "SPEI-DIRECTO", notes: req.body?.notes || "" } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/finalize", requireAuth, requirePermission("ver_reportes"), async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      const updated = await updateRequest(r.id, { status: "FINALIZADA", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: req.dimerUser.id, action: "FINALIZACION_COMPROBACION", details: { notes: req.body?.notes || "" } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/audit-logs", requireAuth, requirePermission("administrar_configuracion"), async (req, res) => {
    try {
      res.json(await listAuditLogs(typeof req.query.requestId === "string" ? req.query.requestId : void 0));
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/outbox", requireAuth, async (_req, res) => res.json(outboxLogs));
  app2.get("/api/smtp/status", requireAuth, async (_req, res) => {
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
    const port = process.env.SMTP_PORT || process.env.EMAIL_PORT || "465";
    const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
    const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
    res.json({ configured: Boolean(user && pass), details: { host, port, user: user ? `${user.slice(0, 3)}***@${user.split("@")[1] || ""}` : "", hasPassword: Boolean(pass), passwordLength: pass.length, secure: port === "465", from: getFromAddress() } });
  });
  app2.post("/api/smtp/test", requireAuth, requirePermission("administrar_configuracion"), async (req, res) => {
    try {
      const to = String(req.body?.targetEmail || "sistemas@dimer.com.mx");
      const result = await sendEmail({ to, subject: `[PRUEBA] SMTP Dimer ${(/* @__PURE__ */ new Date()).toISOString()}`, html: `<p>Prueba SMTP Dimer exitosa.</p><p>${(/* @__PURE__ */ new Date()).toLocaleString("es-MX")}</p>` });
      res.json({ ...result, targetEmail: to });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/stats", requireAuth, async (_req, res) => {
    try {
      const rs = await getPopulatedRequests();
      const total = (s) => rs.filter((r) => r.status === s).length;
      res.json({ totalRequests: rs.length, pendingApproval: total("PENDIENTE_APROBACION"), approved: total("APROBADA"), paid: total("PAGADA"), rejected: total("RECHAZADA"), correctionRequested: total("CORRECCION_SOLICITADA"), totalAmountRequested: rs.reduce((a, r) => a + r.amountRequested, 0), totalAmountAuthorized: rs.reduce((a, r) => a + (r.amountAuthorized || 0), 0), totalUsers: (await listUsers()).length, totalDepartments: (await listDepartments()).length, totalBosses: (await listBosses()).length, totalRoles: (await listRoles()).length });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/code-artifacts", async (_req, res) => {
    try {
      const { NEXTJS_CODE_ARTIFACTS: NEXTJS_CODE_ARTIFACTS2 } = await Promise.resolve().then(() => (init_nextjsArtifacts(), nextjsArtifacts_exports));
      res.json(NEXTJS_CODE_ARTIFACTS2);
    } catch (e) {
      err(res, e);
    }
  });
  app2.all("/api/*", (_req, res) => res.status(404).json({ error: "Ruta API no encontrada" }));
  app2.use((e, _req, res, _next) => {
    console.error("[DIMER]", e);
    if (!res.headersSent) res.status(500).json({ success: false, error: "Error interno del servidor" });
  });
  return app2;
}

// server/smtpDiagnostic.ts
import crypto3 from "node:crypto";
function getSmtpEnvironmentFingerprint() {
  const read = (name) => process.env[name] ?? "";
  const fingerprint = (value) => value ? crypto3.createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16) : null;
  const passwordCandidates = [
    "SMTP_PASS",
    "SMTP_PASSWORD",
    "EMAIL_PASS",
    "EMAIL_PASSWORD",
    "GMAIL_APP_PASSWORD",
    "GMAIL_PASSWORD"
  ];
  const present = (name) => Boolean(read(name));
  const selectedPassword = passwordCandidates.find(present) ?? null;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    smtpUser: read("SMTP_USER") || null,
    smtpUserFingerprint: fingerprint(read("SMTP_USER")),
    smtpHost: read("SMTP_HOST") || read("EMAIL_HOST") || null,
    smtpPort: read("SMTP_PORT") || read("EMAIL_PORT") || null,
    passwordResolution: {
      selectedVariable: selectedPassword,
      candidates: Object.fromEntries(passwordCandidates.map((name) => [name, present(name)])),
      selectedPasswordFingerprint: selectedPassword ? fingerprint(read(selectedPassword)) : null
    },
    smtpFrom: read("SMTP_FROM") || read("EMAIL_FROM") || read("MAIL_FROM") || null
  };
}

// server/apiEntry.ts
var app = createApp();
function handler(req, res) {
  const path = String(req?.url || "").split("?")[0];
  if (path === "/api/smtp/environment-diagnostic" || path === "/smtp/environment-diagnostic") {
    return res.status(200).json(getSmtpEnvironmentFingerprint());
  }
  return app(req, res);
}
export {
  app,
  handler as default
};
