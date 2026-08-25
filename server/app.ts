import express from 'express';
import path from 'path';
import cors from 'cors';
import {
  USERS,
  TRAVEL_REQUESTS,
  AUDIT_LOGS,
  DEPARTMENTS,
  BOSSES,
  ROLES,
  ALL_SYSTEM_PERMISSIONS,
  APPROVAL_TOKENS,
  VERIFICATION_CODES,
  createVerificationCode,
  verifyCodeAndActivateUser,
  getCurrentUser,
  setCurrentUser,
  generateNextFolio,
  recordAuditLog,
  getPopulatedRequests,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  hasPermission,
  getOrCreateDepartment,
  createApprovalToken,
  validateApprovalToken,
  consumeApprovalToken,
  clearCurrentUser,
  saveToDisk,
} from './db';
import {
  buildBossApprovalEmailHtml,
  buildSystemsApprovedEmailHtml,
  buildVerificationEmailHtml,
  buildNewAccountAdminEmailHtml,
  buildTokenApprovalResultPageHtml,
  sendEmail,
  getFromAddress,
  outboxLogs,
} from './mailService';
import { NEXTJS_CODE_ARTIFACTS } from './nextjsArtifacts';
import type { TravelRequest, User, Role, Status, StoredUserRecord } from '../src/types';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // ================= 1. AUTHENTICATION & SESSION =================

  // Current session & bootstrap config
  app.get('/api/me', (req, res) => {
    const user = getCurrentUser();
    res.json({
      user,
      allUsers: USERS.map(sanitizeUser),
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      finanzasEmail: process.env.FINANZAS_EMAIL || 'finanzas@dimer.com.mx',
      systemsEmail: 'sistemas@dimer.com.mx',
    });
  });

  // Login with Email + Password
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Correo electrónico y contraseña requeridos' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const userRecord = USERS.find(u => u.email.toLowerCase() === cleanEmail);
      if (!userRecord) {
        return res.status(401).json({ error: 'No existe una cuenta registrada con este correo. Por favor regístrate.' });
      }

      if (userRecord.status === 'INACTIVO') {
        return res.status(403).json({ error: 'Esta cuenta está inactiva. Contacta al Administrador.' });
      }

      // Check password with stored hash & salt
      if (userRecord.passwordHash && userRecord.salt) {
        const isValid = verifyPassword(password, userRecord.passwordHash, userRecord.salt);
        if (!isValid) {
          return res.status(401).json({ error: 'Contraseña incorrecta. Verifica tus datos e intenta de nuevo.' });
        }
      }

      const user = setCurrentUser(userRecord.id);
      recordAuditLog({
        userId: user.id,
        action: 'INICIO_SESION',
        details: { email: user.email, role: user.role },
      });

      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error en el inicio de sesión' });
    }
  });

  // Step 1 of Registration: Validate data, generate 6-digit code, send email to user
  app.post('/api/auth/register-init', async (req, res) => {
    try {
      const { name, email, password, department, roleId } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nombre completo, correo y contraseña son obligatorios' });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'El formato de correo no es válido.' });
      }

      // Check if user already exists in active DB
      const existing = USERS.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe una cuenta activa con este correo electrónico. Por favor inicia sesión.' });
      }

      // Create department if needed
      const deptName = department ? department.trim() : 'General';
      getOrCreateDepartment(deptName);

      // Hash password
      const { hash, salt } = hashPassword(password);

      // All newly registered accounts default to 'role_solicitante'.
      // Roles must be formally reviewed and assigned by the Administrator (sistemas@dimer.com.mx).
      const initialRoleId = 'role_solicitante';

      // Generate 6-digit verification code & save to store
      const { code, expiresAt } = createVerificationCode({
        email: cleanEmail,
        name: name.trim(),
        department: deptName,
        roleId: initialRoleId,
        passwordHash: hash,
        salt,
      });

      // Send Verification Email via SMTP
      const emailHtml = buildVerificationEmailHtml({
        name: name.trim(),
        email: cleanEmail,
        code,
        expiresMinutes: 15,
      });

      const mailResult = await sendEmail({
        to: cleanEmail,
        subject: `Código de Verificación Dimer: ${code}`,
        html: emailHtml,
      });

      console.log(`[AUTH REGISTRATION] Código de verificación ${code} emitido para ${cleanEmail} (Status: ${mailResult.status})`);

      res.json({
        success: true,
        email: cleanEmail,
        expiresAt,
        simulatedCode: mailResult.status === 'SIMULADO' ? code : undefined,
        message: `Se ha enviado un código de verificación de 6 dígitos a ${cleanEmail}. Por favor revisa tu bandeja de entrada o spam.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al iniciar registro' });
    }
  });

  // Step 2 of Registration: Validate 6-digit code and activate user account
  app.post('/api/auth/verify-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Correo y código de 6 dígitos requeridos' });
      }

      const result = verifyCodeAndActivateUser(email, code);
      if (!result.success || !result.user) {
        return res.status(400).json({ error: result.error || 'Código de verificación inválido' });
      }

      // Log in the new user immediately
      const activeUser = setCurrentUser(result.user.id);

      recordAuditLog({
        userId: activeUser.id,
        action: 'VERIFICACION_Y_ACTIVACION_CUENTA',
        details: {
          email: activeUser.email,
          role: activeUser.role,
          department: activeUser.department,
        },
      });

      // Automatically dispatch notification email to sistemas@dimer.com.mx for role review and assignment
      try {
        const adminEmailHtml = buildNewAccountAdminEmailHtml({
          user: {
            name: activeUser.name,
            email: activeUser.email,
            department: activeUser.department,
            role: activeUser.role,
          },
          registeredAt: new Date().toISOString(),
        });

        await sendEmail({
          to: 'sistemas@dimer.com.mx',
          subject: `NUEVA CUENTA REGISTRADA - Revisión y Asignación de Rol (${activeUser.name})`,
          html: adminEmailHtml,
        });
        console.log(`[AUTH] Notificación de nuevo usuario (${activeUser.email}) enviada a sistemas@dimer.com.mx`);
      } catch (mailErr: any) {
        console.error('[AUTH ERROR] No se pudo enviar notificación de nuevo usuario a sistemas:', mailErr.message);
      }

      res.json({
        success: true,
        user: sanitizeUser(result.user),
        message: '¡Cuenta verificada y activada con éxito! Bienvenido al Sistema de Viáticos Dimer.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al verificar el código' });
    }
  });

  // Resend Verification Code
  app.post('/api/auth/resend-code', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Correo requerido' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const pending = VERIFICATION_CODES.get(cleanEmail);
      if (!pending) {
        return res.status(404).json({ error: 'No hay un registro pendiente para este correo. Por favor inicia tu registro nuevamente.' });
      }

      // Generate fresh code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      pending.code = newCode;
      pending.expiresAt = Date.now() + 15 * 60 * 1000;
      pending.attempts = 0;

      const emailHtml = buildVerificationEmailHtml({
        name: pending.name,
        email: cleanEmail,
        code: newCode,
        expiresMinutes: 15,
      });

      const mailResult = await sendEmail({
        to: cleanEmail,
        subject: `Nuevo Código de Verificación Dimer: ${newCode}`,
        html: emailHtml,
      });

      res.json({
        success: true,
        expiresAt: pending.expiresAt,
        simulatedCode: mailResult.status === 'SIMULADO' ? newCode : undefined,
        message: `Se ha reenviado un nuevo código de verificación a ${cleanEmail}.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al reenviar código' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const previousUser = getCurrentUser();
    if (previousUser) {
      recordAuditLog({
        userId: previousUser.id,
        action: 'CIERRE_SESION',
        details: { email: previousUser.email, role: previousUser.role },
      });
    }
    clearCurrentUser();
    res.json({ success: true, message: 'Sesión finalizada correctamente' });
  });

  // Switch session (for development and multi-role testing)
  app.post('/api/switch-user', (req, res) => {
    const { emailOrId } = req.body;
    if (!emailOrId) {
      return res.status(400).json({ error: 'emailOrId es requerido' });
    }
    const user = setCurrentUser(emailOrId);
    res.json({ success: true, user });
  });

  // Direct registration from Admin panel
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, email, password, department, roleId, status } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = USERS.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo electrónico.' });
      }

      const deptName = department ? department.trim() : 'Ventas';
      const deptObj = getOrCreateDepartment(deptName);

      const selectedRoleId = roleId || 'role_solicitante';
      const roleDef = ROLES.find(r => r.id === selectedRoleId) || ROLES[1];
      const role: Role = roleDef.id === 'role_admin' ? 'ADMIN' : roleDef.id === 'role_solo_lectura' ? 'SOLO_LECTURA_APROBADAS' : 'SOLICITANTE';

      const { hash, salt } = hashPassword(password);

      const newUser: StoredUserRecord = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        roleId: roleDef.id,
        department: deptObj.name,
        status: status === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
        isVerified: true,
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
      };

      USERS.push(newUser);
      saveToDisk();

      recordAuditLog({
        userId: getCurrentUser()?.id || newUser.id,
        action: 'REGISTRO_USUARIO_ADMIN',
        details: {
          registeredEmail: newUser.email,
          role: newUser.role,
          department: newUser.department,
        },
      });

      res.status(201).json({
        success: true,
        user: sanitizeUser(newUser),
        message: 'Usuario registrado exitosamente',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al registrar usuario' });
    }
  });

  // ================= 2. USERS ADMINISTRATION CRUD =================

  app.get('/api/users', (req, res) => {
    const currentUser = getCurrentUser();
    if (!hasPermission(currentUser, 'administrar_usuarios') && currentUser?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permiso para administrar usuarios' });
    }
    res.json(USERS.map(sanitizeUser));
  });

  app.post('/api/users', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_usuarios') && currentUser?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar usuarios' });
      }

      const { name, email, password, department, roleId, role: directRole, status } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = USERS.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: 'El correo electrónico ya se encuentra en uso.' });
      }

      const deptName = department ? department.trim() : 'General';
      const deptObj = getOrCreateDepartment(deptName);

      const selectedRoleId = roleId || (directRole === 'ADMIN' ? 'role_admin' : directRole === 'SOLO_LECTURA_APROBADAS' ? 'role_solo_lectura' : directRole === 'JEFE' ? 'role_jefe' : directRole === 'FINANZAS' ? 'role_finanzas' : 'role_solicitante');
      const roleDef = ROLES.find(r => r.id === selectedRoleId) || ROLES[1];
      const role: Role = roleDef.id === 'role_admin' ? 'ADMIN' :
                         roleDef.id === 'role_solo_lectura' ? 'SOLO_LECTURA_APROBADAS' :
                         roleDef.id === 'role_jefe' ? 'JEFE' :
                         roleDef.id === 'role_finanzas' ? 'FINANZAS' : 'SOLICITANTE';

      const initialPassword = password || 'password123';
      const { hash, salt } = hashPassword(initialPassword);

      const newUser: StoredUserRecord = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        roleId: roleDef.id,
        department: deptObj.name,
        status: status === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
      };

      USERS.push(newUser);
      saveToDisk();

      recordAuditLog({
        userId: currentUser?.id || 'usr_adm_1',
        action: 'CREACION_USUARIO_ADMIN',
        details: {
          adminEmail: currentUser?.email || 'sistemas@dimer.com.mx',
          newUserId: newUser.id,
          newUserEmail: newUser.email,
          role: newUser.role,
        },
      });

      res.status(201).json({ success: true, user: sanitizeUser(newUser) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_usuarios') && currentUser?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar usuarios' });
      }

      const { id } = req.params;
      const { name, email, department, roleId, role: directRole, status, password } = req.body;

      const userRecord = USERS.find(u => u.id === id || u.email.toLowerCase() === id.toLowerCase());
      if (!userRecord) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (name) userRecord.name = name.trim();
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const conflict = USERS.find(u => u.id !== userRecord.id && u.email.toLowerCase() === cleanEmail);
        if (conflict) {
          return res.status(400).json({ error: 'El correo electrónico ya pertenece a otro usuario' });
        }
        userRecord.email = cleanEmail;
      }
      if (department) {
        const deptObj = getOrCreateDepartment(department.trim());
        userRecord.department = deptObj.name;
      }
      if (roleId || directRole) {
        const targetRoleId = roleId || (directRole === 'ADMIN' ? 'role_admin' : directRole === 'SOLO_LECTURA_APROBADAS' ? 'role_solo_lectura' : directRole === 'JEFE' ? 'role_jefe' : directRole === 'FINANZAS' ? 'role_finanzas' : 'role_solicitante');
        const roleDef = ROLES.find(r => r.id === targetRoleId || r.name.toUpperCase() === String(directRole).toUpperCase());
        if (roleDef) {
          userRecord.roleId = roleDef.id;
          userRecord.role = roleDef.id === 'role_admin' ? 'ADMIN' :
                            roleDef.id === 'role_solo_lectura' ? 'SOLO_LECTURA_APROBADAS' :
                            roleDef.id === 'role_jefe' ? 'JEFE' :
                            roleDef.id === 'role_finanzas' ? 'FINANZAS' : 'SOLICITANTE';
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
        userId: currentUser?.id || 'usr_adm_1',
        action: 'ACTUALIZACION_USUARIO',
        details: {
          targetUserId: userRecord.id,
          targetUserEmail: userRecord.email,
          status: userRecord.status,
          role: userRecord.role,
        },
      });

      res.json({ success: true, user: sanitizeUser(userRecord) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_usuarios') && currentUser?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para eliminar o desactivar usuarios' });
      }

      const { id } = req.params;
      const userIndex = USERS.findIndex(u => u.id === id || u.email.toLowerCase() === id.toLowerCase());
      if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

      const target = USERS[userIndex];
      if (target.email.toLowerCase() === 'sistemas@dimer.com.mx') {
        return res.status(400).json({ error: 'No se puede eliminar la cuenta principal de administración (sistemas@dimer.com.mx)' });
      }
      if (currentUser && target.id === currentUser.id) {
        return res.status(400).json({ error: 'No puede eliminar su propia cuenta activa de sesión' });
      }

      // Check if permanent delete or soft deactivation
      const isSoft = req.query.soft === 'true';
      if (isSoft) {
        target.status = 'INACTIVO';
        saveToDisk();
        recordAuditLog({
          userId: currentUser?.id || 'usr_adm_1',
          action: 'DESACTIVACION_USUARIO',
          details: { targetUserId: target.id, email: target.email },
        });
        return res.json({ success: true, message: `Usuario ${target.name} desactivado.`, user: sanitizeUser(target) });
      } else {
        // Permanent deletion from database
        const [deleted] = USERS.splice(userIndex, 1);
        saveToDisk();
        recordAuditLog({
          userId: currentUser?.id || 'usr_adm_1',
          action: 'ELIMINACION_USUARIO',
          details: { deletedUserId: deleted.id, email: deleted.email, name: deleted.name },
        });
        return res.json({ success: true, message: `Cuenta de ${deleted.name} (${deleted.email}) eliminada permanentemente.` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================= 3. DEPARTMENTS CRUD =================

  app.get('/api/departments', (req, res) => {
    res.json(DEPARTMENTS);
  });

  app.post('/api/departments', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_departamentos') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar departamentos' });
      }

      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del departamento es obligatorio' });
      }

      const trimmed = name.trim();
      const existing = DEPARTMENTS.find(d => d.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'Ya existe un departamento con este nombre' });
      }

      const newDept = {
        id: `dept_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: trimmed,
        description: description?.trim() || '',
        active: true,
        createdAt: new Date().toISOString(),
      };

      DEPARTMENTS.push(newDept);
      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'CREACION_DEPARTAMENTO',
        details: { departmentName: newDept.name },
      });

      res.status(201).json({ success: true, department: newDept });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/departments/:id', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_departamentos') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar departamentos' });
      }

      const { id } = req.params;
      const { name, description, active } = req.body;

      const dept = DEPARTMENTS.find(d => d.id === id);
      if (!dept) return res.status(404).json({ error: 'Departamento no encontrado' });

      if (name && name.trim()) {
        const conflict = DEPARTMENTS.find(d => d.id !== id && d.name.toLowerCase() === name.trim().toLowerCase());
        if (conflict) return res.status(400).json({ error: 'Ya existe otro departamento con este nombre' });
        dept.name = name.trim();
      }
      if (description !== undefined) dept.description = description.trim();
      if (active !== undefined) dept.active = Boolean(active);

      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'ACTUALIZACION_DEPARTAMENTO',
        details: { departmentId: dept.id, departmentName: dept.name, active: dept.active },
      });

      res.json({ success: true, department: dept });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================= 4. BOSSES (JEFES / APROBADORES) CATALOG =================

  app.get('/api/bosses', (req, res) => {
    res.json(BOSSES);
  });

  app.post('/api/bosses', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_jefes') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar jefes' });
      }

      const { name, email, department } = req.body;
      if (!name || !email || !department) {
        return res.status(400).json({ error: 'Nombre, correo y departamento son requeridos' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = BOSSES.find(b => b.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe un jefe registrado con este correo' });
      }

      const deptObj = getOrCreateDepartment(department.trim());

      const newBoss = {
        id: `boss_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: name.trim(),
        email: cleanEmail,
        department: deptObj.name,
        active: true,
        createdAt: new Date().toISOString(),
      };

      BOSSES.push(newBoss);
      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'CREACION_JEFE',
        details: { bossName: newBoss.name, bossEmail: newBoss.email, department: newBoss.department },
      });

      res.status(201).json({ success: true, boss: newBoss });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const updateBossHandler = (req: express.Request, res: express.Response) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_jefes') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar jefes' });
      }

      const { id } = req.params;
      const decodedId = decodeURIComponent(id);
      const { name, email, department, active } = req.body;

      const boss = BOSSES.find(
        b => b.id === id || b.id === decodedId || b.email.toLowerCase() === id.toLowerCase() || b.email.toLowerCase() === decodedId.toLowerCase()
      );
      if (!boss) return res.status(404).json({ error: 'Jefe o aprobador no encontrado' });

      if (name) boss.name = name.trim();
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const conflict = BOSSES.find(b => b.id !== boss.id && b.email.toLowerCase() === cleanEmail);
        if (conflict) return res.status(400).json({ error: 'El correo electrónico ya pertenece a otro jefe registrado' });
        boss.email = cleanEmail;
      }
      if (department) {
        const deptObj = getOrCreateDepartment(department.trim());
        boss.department = deptObj.name;
      }
      if (active !== undefined) boss.active = Boolean(active);

      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'ACTUALIZACION_JEFE',
        details: { bossId: boss.id, name: boss.name, email: boss.email, department: boss.department, active: boss.active },
      });

      res.json({ success: true, boss });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al actualizar jefe' });
    }
  };

  app.put('/api/bosses/:id', updateBossHandler);
  app.patch('/api/bosses/:id', updateBossHandler);
  app.post('/api/bosses/:id', updateBossHandler);

  app.delete('/api/bosses/:id', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_jefes') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para eliminar o desactivar jefes' });
      }

      const { id } = req.params;
      const decodedId = decodeURIComponent(id);
      const bossIndex = BOSSES.findIndex(
        b => b.id === id || b.id === decodedId || b.email.toLowerCase() === id.toLowerCase() || b.email.toLowerCase() === decodedId.toLowerCase()
      );

      if (bossIndex === -1) return res.status(404).json({ error: 'Jefe no encontrado' });

      const [removed] = BOSSES.splice(bossIndex, 1);
      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'ELIMINACION_JEFE',
        details: { bossId: removed.id, name: removed.name, email: removed.email },
      });

      res.json({ success: true, message: `Jefe ${removed.name} eliminado del catálogo.`, boss: removed });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al eliminar jefe' });
    }
  });

  // ================= 5. ROLES & PERMISSIONS CRUD =================

  app.get('/api/roles', (req, res) => {
    res.json(ROLES);
  });

  app.get('/api/permissions', (req, res) => {
    res.json(ALL_SYSTEM_PERMISSIONS);
  });

  app.post('/api/roles', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_roles') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar roles' });
      }

      const { name, description, permissions } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
      }

      const trimmedName = name.trim();
      const existing = ROLES.find(r => r.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
      }

      const newRole = {
        id: `role_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: trimmedName,
        description: description?.trim() || '',
        permissions: Array.isArray(permissions) ? permissions : ['ver_solicitudes'],
        active: true,
        isSystem: false,
      };

      ROLES.push(newRole);
      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'CREACION_ROL',
        details: { roleName: newRole.name, permissionsCount: newRole.permissions.length },
      });

      res.status(201).json({ success: true, role: newRole });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/roles/:id', (req, res) => {
    try {
      const currentUser = getCurrentUser();
      if (!hasPermission(currentUser, 'administrar_roles') && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permiso para administrar roles' });
      }

      const { id } = req.params;
      const { name, description, permissions, active } = req.body;

      const role = ROLES.find(r => r.id === id);
      if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

      if (name && name.trim()) {
        const conflict = ROLES.find(r => r.id !== id && r.name.toLowerCase() === name.trim().toLowerCase());
        if (conflict) return res.status(400).json({ error: 'Ya existe otro rol con ese nombre' });
        role.name = name.trim();
      }
      if (description !== undefined) role.description = description.trim();
      if (Array.isArray(permissions)) role.permissions = permissions;
      if (active !== undefined) role.active = Boolean(active);

      saveToDisk();

      recordAuditLog({
        userId: currentUser.id,
        action: 'ACTUALIZACION_ROL',
        details: { roleId: role.id, roleName: role.name, permissions: role.permissions },
      });

      res.json({ success: true, role });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================= 6. APPROVAL TOKENS VALIDATION & ACTION =================

  app.get('/api/approval-tokens/:token', (req, res) => {
    const { token } = req.params;
    const result = validateApprovalToken(token);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }

    const requester = USERS.find(u => u.id === result.request?.userId);
    res.json({
      valid: true,
      tokenRecord: result.tokenRecord,
      request: { ...result.request, user: requester ? sanitizeUser(requester) : undefined },
    });
  });

  app.post('/api/approval-tokens/:token/action', async (req, res) => {
    try {
      const { token } = req.params;
      const { action, amountAuthorized, comments } = req.body;

      if (!['APROBADA', 'RECHAZADA'].includes(action)) {
        return res.status(400).json({ error: 'Acción no válida. Solo APROBADA o RECHAZADA.' });
      }

      const tokenValidation = validateApprovalToken(token);
      if (!tokenValidation.valid || !tokenValidation.request || !tokenValidation.tokenRecord) {
        return res.status(400).json({ error: tokenValidation.error || 'Token inválido o expirado' });
      }

      const request = tokenValidation.request;
      const tokenRecord = tokenValidation.tokenRecord;

      if (action === 'RECHAZADA' && !comments?.trim()) {
        return res.status(400).json({ error: 'El motivo del rechazo es obligatorio' });
      }

      // Consume the single-use token
      consumeApprovalToken(token, action);

      if (action === 'APROBADA') {
        const numAuth = parseFloat(amountAuthorized !== undefined ? amountAuthorized : request.amountRequested);
        request.status = 'APROBADA';
        request.amountAuthorized = isNaN(numAuth) ? request.amountRequested : numAuth;
        if (comments) request.comments = comments.trim();
        request.approvedBy = tokenRecord.bossEmail;
        request.approvedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();

        // Audit log
        recordAuditLog({
          requestId: request.id,
          userId: `boss_token_${tokenRecord.bossEmail}`,
          action: 'APROBACION_VIA_TOKEN_SEGURO',
          details: {
            bossEmail: tokenRecord.bossEmail,
            amountAuthorized: request.amountAuthorized,
            comments: comments || 'Aprobado mediante enlace seguro',
            tokenId: tokenRecord.id,
          },
        });

        // Email to Systems (sistemas@dimer.com.mx) and Finanzas
        const requester = USERS.find(u => u.id === request.userId);
        const systemsEmailHtml = buildSystemsApprovedEmailHtml({
          request,
          user: requester ? sanitizeUser(requester) : { name: 'Colaborador', email: request.userId, department: 'General', role: 'EMPLEADO', status: 'ACTIVO', id: request.userId },
          approverName: request.bossName || tokenRecord.bossEmail,
          approverEmail: tokenRecord.bossEmail,
          approvedAt: request.approvedAt,
        });

        await sendEmail({
          to: 'sistemas@dimer.com.mx',
          subject: `SOLICITUD DE VIÁTICOS APROBADA - ${request.folio}`,
          html: systemsEmailHtml,
          requestId: request.id,
          folio: request.folio,
        });

        // Also notify finance
        const finanzasEmail = process.env.FINANZAS_EMAIL || 'finanzas@dimer.com.mx';
        if (finanzasEmail !== 'sistemas@dimer.com.mx') {
          await sendEmail({
            to: finanzasEmail,
            subject: `SOLICITUD DE VIÁTICOS APROBADA - ${request.folio}`,
            html: systemsEmailHtml,
            requestId: request.id,
            folio: request.folio,
          });
        }
      } else {
        request.status = 'RECHAZADA';
        request.rejectionReason = comments.trim();
        if (comments) request.comments = comments.trim();
        request.rejectedBy = tokenRecord.bossEmail;
        request.rejectedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();

        recordAuditLog({
          requestId: request.id,
          userId: `boss_token_${tokenRecord.bossEmail}`,
          action: 'RECHAZO_VIA_TOKEN_SEGURO',
          details: {
            bossEmail: tokenRecord.bossEmail,
            rejectionReason: comments.trim(),
            tokenId: tokenRecord.id,
          },
        });
      }

      res.json({
        success: true,
        action,
        folio: request.folio,
        message: `Solicitud ${request.folio} ${action === 'APROBADA' ? 'aprobada y notificada a sistemas/finanzas' : 'rechazada'} exitosamente.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================= 7. TRAVEL REQUESTS =================

  app.get('/api/requests', (req, res) => {
    const { status, roleFilter } = req.query;
    const currentUser = getCurrentUser();
    let list = getPopulatedRequests();

    if (!currentUser) {
      return res.json(list);
    }

    // 1. Role-based mandatory security constraints
    if (currentUser.role === 'SOLO_LECTURA_APROBADAS' || currentUser.roleId === 'role_solo_lectura') {
      // ONLY view approved or completed requests
      list = list.filter(r => ['APROBADA', 'PAGADA', 'FINALIZADA'].includes(r.status));
    } else if (currentUser.role === 'SOLICITANTE' || currentUser.roleId === 'role_solicitante') {
      // Solicitante by default sees ONLY their own requests, unless filtering approvals
      if (roleFilter !== 'to_approve') {
        list = list.filter(
          r => r.userId === currentUser.id || r.user?.email.toLowerCase() === currentUser.email.toLowerCase()
        );
      }
    }

    // 2. Query filter overrides
    if (status && status !== 'TODAS') {
      list = list.filter(r => r.status === status);
    }

    if (roleFilter === 'mine') {
      list = list.filter(
        r => r.userId === currentUser.id || r.user?.email.toLowerCase() === currentUser.email.toLowerCase()
      );
    } else if (roleFilter === 'to_approve') {
      list = list.filter(
        r => r.bossEmail.toLowerCase() === currentUser.email.toLowerCase() || currentUser.role === 'ADMIN'
      );
    } else if (roleFilter === 'finanzas' || roleFilter === 'approved_only') {
      list = list.filter(r => ['APROBADA', 'PAGADA', 'FINALIZADA'].includes(r.status));
    }

    res.json(list);
  });

  app.get('/api/requests/:id', (req, res) => {
    const { id } = req.params;
    const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const userRecord = USERS.find(u => u.id === request.userId);
    const relatedLogs = AUDIT_LOGS.filter(l => l.requestId === request.id);

    const currentUser = getCurrentUser();
    if (currentUser) {
      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: 'VISUALIZACION_SOLICITUD',
        details: {
          viewerRole: currentUser.role,
          viewerEmail: currentUser.email,
          folio: request.folio,
        },
      });
    }

    res.json({
      request: { ...request, user: userRecord ? sanitizeUser(userRecord) : undefined },
      auditLogs: relatedLogs,
      canApprove: currentUser ? (
        currentUser.email.toLowerCase() === request.bossEmail.toLowerCase() ||
        currentUser.role === 'ADMIN' ||
        hasPermission(currentUser, 'aprobar_solicitudes')
      ) : false,
    });
  });

  // Create new request
  app.post('/api/requests', async (req, res) => {
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
        comments,
      } = req.body;

      const finalReason = (detail || reason || '').trim();
      const finalDestination = (destination || 'Oficina / Centro Corporativo').trim();
      const finalStartDate = startDate || new Date().toISOString();
      const finalEndDate = endDate || finalStartDate;

      if (!finalReason) {
        return res.status(400).json({ error: 'La descripción o detalle de lo solicitado es obligatorio' });
      }

      // Resolve boss from ID or provided email
      let targetBossEmail = bossEmail?.trim()?.toLowerCase();
      let targetBossName = '';
      if (bossId) {
        const foundBoss = BOSSES.find(b => b.id === bossId);
        if (foundBoss) {
          targetBossEmail = foundBoss.email.toLowerCase();
          targetBossName = foundBoss.name;
        }
      }

      if (!targetBossEmail) {
        return res.status(400).json({ error: 'Debe seleccionar un jefe que autoriza' });
      }

      const numAmount = parseFloat(amountRequested || '0');
      if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({ error: 'El monto solicitado debe ser un valor válido' });
      }

      const folio = generateNextFolio();
      const requestId = `req_${Date.now()}`;

      // Generate single-use approval token
      const tokenRecord = createApprovalToken(requestId, targetBossEmail, bossId);

      const resolvedRequesterName = (requesterName?.trim() || activeUser.name).trim();
      const resolvedDepartment = (department?.trim() || activeUser.department || 'General').trim();
      const resolvedRequestType = (requestType?.trim() || 'Viáticos y Gastos de Viaje').trim();
      const resolvedUrgency = (urgency?.trim()?.toLowerCase() || 'media');
      const resolvedRequestDate = (requestDate?.trim() || new Date().toISOString().split('T')[0]).trim();

      const newRequest: TravelRequest = {
        id: requestId,
        folio,
        status: 'PENDIENTE_APROBACION',
        userId: activeUser.id,
        requesterName: resolvedRequesterName,
        department: resolvedDepartment,
        requestType: resolvedRequestType,
        detail: finalReason,
        requestDate: resolvedRequestDate,
        urgency: resolvedUrgency as any,
        bossId: bossId || undefined,
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
        createdAt: new Date().toISOString(),
      };

      TRAVEL_REQUESTS.unshift(newRequest);
      saveToDisk();

      // Audit Log
      recordAuditLog({
        requestId: newRequest.id,
        userId: activeUser.id,
        action: 'CREACION_SOLICITUD',
        details: {
          folio: newRequest.folio,
          requesterName: newRequest.requesterName,
          department: newRequest.department,
          requestType: newRequest.requestType,
          urgency: newRequest.urgency,
          bossEmail: newRequest.bossEmail,
          bossName: newRequest.bossName,
          amountRequested: newRequest.amountRequested,
          destination: newRequest.destination,
        },
      });

      // Send Tokenized Email to Boss and systems authorization email
      // The links use the direct 1-click token action endpoint so approvers can approve/reject from email without UI login redirection.
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const approveUrl = `${appUrl}/api/approval/token-action?token=${tokenRecord.token}&action=approve`;
      const rejectUrl = `${appUrl}/api/approval/token-action?token=${tokenRecord.token}&action=reject`;

      const emailHtml = buildBossApprovalEmailHtml({
        request: newRequest,
        user: activeUser,
        approveUrl,
        rejectUrl,
        token: tokenRecord.token,
      });

      // 1. Send to the designated authorizing Boss
      const mailResult = await sendEmail({
        to: newRequest.bossEmail,
        subject: `SOLICITUD POR AUTORIZAR - Folio ${newRequest.folio} (${newRequest.requestType})`,
        html: emailHtml,
        requestId: newRequest.id,
        folio: newRequest.folio,
      });

      // 2. Also send always to sistemas@dimer.com.mx for centralized authorization & automation if different
      if (newRequest.bossEmail.toLowerCase() !== 'sistemas@dimer.com.mx') {
        await sendEmail({
          to: 'sistemas@dimer.com.mx',
          subject: `Nueva solicitud por autorizar - ${newRequest.requestType} (Folio ${newRequest.folio})`,
          html: emailHtml,
          requestId: newRequest.id,
          folio: newRequest.folio,
        });
      }

      res.status(201).json({
        success: true,
        request: { ...newRequest, user: activeUser },
        approvalToken: tokenRecord.token,
        mailResult,
      });
    } catch (err: any) {
      console.error('Error creating travel request:', err);
      res.status(500).json({ error: err.message || 'Error al procesar la solicitud' });
    }
  });

  // ================= 1-CLIC DIRECT APPROVAL / REJECTION FROM EMAIL (NO LOGIN / REDIRECTION REQUIRED) =================
  app.get('/api/approval/token-action', async (req, res) => {
    try {
      const { token, action, reason } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).send(buildTokenApprovalResultPageHtml({
          status: 'INVALIDA',
          errorMessage: 'El token de autorización no fue proporcionado o no es válido.',
        }));
      }

      const tokenRecord = APPROVAL_TOKENS.find(t => t.token === token);
      if (!tokenRecord) {
        return res.status(404).send(buildTokenApprovalResultPageHtml({
          status: 'INVALIDA',
          errorMessage: 'El token de autorización no existe o ha expirado.',
        }));
      }

      // Find the associated request
      const request = TRAVEL_REQUESTS.find(r => r.id === tokenRecord.requestId || r.folio === tokenRecord.requestId);
      if (!request) {
        return res.status(404).send(buildTokenApprovalResultPageHtml({
          status: 'INVALIDA',
          errorMessage: 'No se encontró la solicitud de viáticos asociada a este token.',
        }));
      }

      // Check if token has expired (default 7 days)
      if (tokenRecord.expiresAt && Date.now() > new Date(tokenRecord.expiresAt).getTime()) {
        return res.status(410).send(buildTokenApprovalResultPageHtml({
          status: 'INVALIDA',
          request,
          errorMessage: 'Este enlace de autorización ha expirado (vigencia de 7 días).',
        }));
      }

      // Check if already processed
      if (tokenRecord.used || request.status !== 'PENDIENTE_APROBACION') {
        return res.send(buildTokenApprovalResultPageHtml({
          status: 'YA_PROCESADA',
          request,
          processedBy: request.approvedBy || request.rejectedBy || tokenRecord.bossEmail,
          processedAt: request.approvedAt || request.rejectedAt || request.updatedAt,
        }));
      }

      const isReject = action === 'reject' || action === 'rechazar';

      if (isReject) {
        // Execute 1-click rejection
        const rejectionReason = (typeof reason === 'string' && reason.trim())
          ? reason.trim()
          : 'Rechazado directamente desde el correo electrónico';

        request.status = 'RECHAZADA';
        request.rejectionReason = rejectionReason;
        request.comments = rejectionReason;
        request.rejectedBy = tokenRecord.bossEmail;
        request.rejectedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();

        consumeApprovalToken(token, 'RECHAZADA');
        saveToDisk();

        recordAuditLog({
          requestId: request.id,
          userId: 'email_token_action',
          action: 'RECHAZO_DIRECTO_EMAIL',
          details: {
            rejectedBy: tokenRecord.bossEmail,
            reason: rejectionReason,
            folio: request.folio,
          },
        });

        return res.send(buildTokenApprovalResultPageHtml({
          status: 'RECHAZADA',
          request,
          actionTaken: 'RECHAZADA',
          processedBy: tokenRecord.bossEmail,
          processedAt: request.rejectedAt,
        }));
      } else {
        // Execute 1-click approval
        request.status = 'APROBADA';
        request.amountAuthorized = request.amountRequested;
        request.approvedBy = tokenRecord.bossEmail;
        request.approvedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();

        consumeApprovalToken(token, 'APROBADA');
        saveToDisk();

        recordAuditLog({
          requestId: request.id,
          userId: 'email_token_action',
          action: 'APROBACION_DIRECTA_EMAIL',
          details: {
            approvedBy: tokenRecord.bossEmail,
            amountRequested: request.amountRequested,
            amountAuthorized: request.amountAuthorized,
            folio: request.folio,
          },
        });

        // Send Email to Systems and Finanzas
        const requesterUser = USERS.find(u => u.id === request.userId);
        const dummyUser: User = requesterUser ? sanitizeUser(requesterUser) : {
          id: request.userId,
          name: request.requesterName,
          email: request.userId,
          department: request.department,
          role: 'SOLICITANTE',
          status: 'ACTIVO',
          createdAt: request.createdAt,
        };

        const systemsEmailHtml = buildSystemsApprovedEmailHtml({
          request,
          user: dummyUser,
          approverName: tokenRecord.bossEmail,
          approverEmail: tokenRecord.bossEmail,
          approvedAt: request.approvedAt,
        });

        await sendEmail({
          to: 'sistemas@dimer.com.mx',
          subject: `SOLICITUD DE VIÁTICOS APROBADA - ${request.folio}`,
          html: systemsEmailHtml,
          requestId: request.id,
          folio: request.folio,
        });

        const finanzasEmail = process.env.FINANZAS_EMAIL || 'finanzas@dimer.com.mx';
        if (finanzasEmail.toLowerCase() !== 'sistemas@dimer.com.mx') {
          await sendEmail({
            to: finanzasEmail,
            subject: `SOLICITUD DE VIÁTICOS APROBADA - ${request.folio}`,
            html: systemsEmailHtml,
            requestId: request.id,
            folio: request.folio,
          });
        }

        return res.send(buildTokenApprovalResultPageHtml({
          status: 'APROBADA',
          request,
          actionTaken: 'APROBADA',
          processedBy: tokenRecord.bossEmail,
          processedAt: request.approvedAt,
        }));
      }
    } catch (err: any) {
      console.error('Error en token direct action:', err);
      return res.status(500).send(buildTokenApprovalResultPageHtml({
        status: 'INVALIDA',
        errorMessage: err.message || 'Error al procesar la acción del token',
      }));
    }
  });

  // Cancel Request
  app.post('/api/requests/:id/cancel', (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = getCurrentUser();

      const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
      if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

      if (request.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el solicitante o Administrador puede cancelar esta solicitud' });
      }

      if (['APROBADA', 'PAGADA', 'FINALIZADA'].includes(request.status)) {
        return res.status(400).json({ error: `No se puede cancelar una solicitud en estado ${request.status}` });
      }

      request.status = 'CANCELADA';
      request.updatedAt = new Date().toISOString();
      saveToDisk();

      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: 'CANCELACION_SOLICITUD',
        details: { cancelledBy: currentUser.email, folio: request.folio },
      });

      res.json({ success: true, request });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct Boss Approval from UI
  app.post('/api/requests/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { amountAuthorized, comments } = req.body;
      const currentUser = getCurrentUser();

      const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
      if (!request) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      const isBoss = currentUser.email.toLowerCase() === request.bossEmail.toLowerCase();
      const isAdmin = currentUser.role === 'ADMIN' || hasPermission(currentUser, 'aprobar_solicitudes');

      if (!isBoss && !isAdmin) {
        return res.status(403).json({
          error: `Acceso no autorizado. Debe autenticarse como ${request.bossEmail} o Administrador. Su usuario actual es ${currentUser.email}`,
        });
      }

      const numAuthorized = parseFloat(amountAuthorized !== undefined ? amountAuthorized : request.amountRequested);
      if (isNaN(numAuthorized) || numAuthorized < 0) {
        return res.status(400).json({ error: 'Monto autorizado no válido' });
      }

      request.status = 'APROBADA';
      request.amountAuthorized = numAuthorized;
      if (comments) request.comments = comments.trim();
      request.approvedBy = currentUser.email;
      request.approvedAt = new Date().toISOString();
      request.updatedAt = new Date().toISOString();

      // If there was an associated token, mark it used
      if (request.approvalToken) {
        consumeApprovalToken(request.approvalToken, 'APROBADA');
      }

      saveToDisk();

      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: 'APROBACION_JEFE',
        details: {
          approvedBy: currentUser.email,
          amountRequested: request.amountRequested,
          amountAuthorized: request.amountAuthorized,
          comments: comments || 'Sin observaciones',
        },
      });

      // Send Email to Systems (sistemas@dimer.com.mx) and Finanzas
      const requesterUser = USERS.find(u => u.id === request.userId);
      const sanitizedRequester = requesterUser ? sanitizeUser(requesterUser) : currentUser;

      const systemsEmailHtml = buildSystemsApprovedEmailHtml({
        request,
        user: sanitizedRequester,
        approverName: currentUser.name,
        approverEmail: currentUser.email,
        approvedAt: request.approvedAt,
      });

      await sendEmail({
        to: 'sistemas@dimer.com.mx',
        subject: `SOLICITUD DE VIÁTICOS APROBADA - ${request.folio}`,
        html: systemsEmailHtml,
        requestId: request.id,
        folio: request.folio,
      });

      const finanzasEmail = process.env.FINANZAS_EMAIL || 'finanzas@dimer.com.mx';
      if (finanzasEmail !== 'sistemas@dimer.com.mx') {
        await sendEmail({
          to: finanzasEmail,
          subject: `SOLICITUD DE VIÁTICOS APROBADA - ${request.folio}`,
          html: systemsEmailHtml,
          requestId: request.id,
          folio: request.folio,
        });
      }

      res.json({
        success: true,
        request: { ...request, user: sanitizedRequester },
      });
    } catch (err: any) {
      console.error('Error approving travel request:', err);
      res.status(500).json({ error: err.message || 'Error al autorizar solicitud' });
    }
  });

  // Direct Boss Rejection from UI
  app.post('/api/requests/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const currentUser = getCurrentUser();

      const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
      if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

      const isBoss = currentUser.email.toLowerCase() === request.bossEmail.toLowerCase();
      const isAdmin = currentUser.role === 'ADMIN' || hasPermission(currentUser, 'aprobar_solicitudes');
      if (!isBoss && !isAdmin) {
        return res.status(403).json({ error: `No autorizado. Se requiere ${request.bossEmail}` });
      }

      if (!comments?.trim()) {
        return res.status(400).json({ error: 'El motivo del rechazo es obligatorio' });
      }

      request.status = 'RECHAZADA';
      request.rejectionReason = comments.trim();
      request.comments = comments.trim();
      request.rejectedBy = currentUser.email;
      request.rejectedAt = new Date().toISOString();
      request.updatedAt = new Date().toISOString();

      if (request.approvalToken) {
        consumeApprovalToken(request.approvalToken, 'RECHAZADA');
      }

      saveToDisk();

      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: 'RECHAZO_JEFE',
        details: {
          rejectedBy: currentUser.email,
          reason: comments.trim(),
        },
      });

      res.json({ success: true, request });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Request Correction
  app.post('/api/requests/:id/request-correction', async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const currentUser = getCurrentUser();

      const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
      if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

      const isBoss = currentUser.email.toLowerCase() === request.bossEmail.toLowerCase();
      const isAdmin = currentUser.role === 'ADMIN' || hasPermission(currentUser, 'aprobar_solicitudes');
      if (!isBoss && !isAdmin) {
        return res.status(403).json({ error: `No autorizado. Se requiere ${request.bossEmail}` });
      }

      request.status = 'CORRECCION_SOLICITADA';
      if (comments) request.comments = comments.trim();
      request.updatedAt = new Date().toISOString();
      saveToDisk();

      recordAuditLog({
        requestId: request.id,
        userId: currentUser.id,
        action: 'SOLICITUD_CORRECCION',
        details: {
          requestedBy: currentUser.email,
          notes: comments || 'Revisar montos o documentación',
        },
      });

      res.json({ success: true, request });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Finance: Pay Request
  app.post('/api/requests/:id/pay', (req, res) => {
    const { id } = req.params;
    const { reference, notes } = req.body;
    const currentUser = getCurrentUser();

    const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    request.status = 'PAGADA';
    request.updatedAt = new Date().toISOString();
    saveToDisk();

    recordAuditLog({
      requestId: request.id,
      userId: currentUser.id,
      action: 'DISPERSION_PAGO',
      details: {
        paidBy: currentUser.email,
        amount: request.amountAuthorized || request.amountRequested,
        reference: reference || 'SPEI-DIRECTO',
        notes: notes || 'Pago procesado por Finanzas',
      },
    });

    res.json({ success: true, request });
  });

  // Finance/Admin: Finalize Request
  app.post('/api/requests/:id/finalize', (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const currentUser = getCurrentUser();

    const request = TRAVEL_REQUESTS.find(r => r.id === id || r.folio === id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    request.status = 'FINALIZADA';
    request.updatedAt = new Date().toISOString();
    saveToDisk();

    recordAuditLog({
      requestId: request.id,
      userId: currentUser.id,
      action: 'FINALIZACION_COMPROBACION',
      details: {
        finalizedBy: currentUser.email,
        notes: notes || 'Comprobación de gastos cerrada satisfactoriamente',
      },
    });

    res.json({ success: true, request });
  });

  // ================= 8. AUDIT LOGS & OUTBOX =================

  app.get('/api/audit-logs', (req, res) => {
    const { requestId } = req.query;
    if (requestId) {
      return res.json(AUDIT_LOGS.filter(l => l.requestId === requestId));
    }
    res.json(AUDIT_LOGS);
  });

  app.get('/api/outbox', (req, res) => {
    res.json(outboxLogs);
  });

  // SMTP Diagnostic & Connection Tester
  app.get('/api/smtp/status', (req, res) => {
    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT?.trim() || '465';
    const user = process.env.SMTP_USER?.trim().replace(/^["']|["']$/g, '') || 'sistemas@dimer.com.mx';
    const pass = process.env.SMTP_PASS?.trim().replace(/^["']|["']$/g, '');
    const secure = process.env.SMTP_SECURE;
    const from = getFromAddress();

    res.json({
      configured: Boolean(user && pass),
      details: {
        host: host,
        port: port,
        user: user ? `${user.substring(0, 3)}***@${user.split('@')[1] || ''}` : 'sistemas@dimer.com.mx',
        hasPassword: Boolean(pass),
        secure: secure === 'true' || port === '465',
        from,
      },
      instructions: !pass
        ? 'Falta la contraseña de aplicación (16 letras) en SMTP_PASS. Los correos se emulan en la Bandeja SMTP.'
        : 'Credenciales de Google Workspace configuradas. Listo para enviar correos salientes.',
    });
  });

  app.post('/api/smtp/test', async (req, res) => {
    const { targetEmail } = req.body;
    const recipient = targetEmail?.trim() || 'sistemas@dimer.com.mx';

    const testHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #4f46e5; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Prueba de Conexión SMTP - Dimer</h2>
        <p>Este es un correo de prueba enviado desde el <strong>Sistema Corporativo Dimer</strong> para verificar la conectividad de correo saliente.</p>
        <p><strong>Destinatario:</strong> ${recipient}</p>
        <p><strong>Fecha/Hora:</strong> ${new Date().toLocaleString('es-MX')}</p>
        <div style="margin-top: 20px; padding: 10px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; color: #16a34a; font-weight: bold;">
          ✓ Conexión con servidor de correo establecida con éxito.
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: recipient,
      subject: `[PRUEBA] Verificación de correo SMTP Dimer - ${new Date().toLocaleTimeString('es-MX')}`,
      html: testHtml,
    });

    res.json({
      ...result,
      targetEmail: recipient,
    });
  });

  // ================= 9. SYSTEM STATS =================

  app.get('/api/stats', (req, res) => {
    const totalRequests = TRAVEL_REQUESTS.length;
    const pendingApproval = TRAVEL_REQUESTS.filter(r => r.status === 'PENDIENTE_APROBACION').length;
    const approved = TRAVEL_REQUESTS.filter(r => r.status === 'APROBADA').length;
    const paid = TRAVEL_REQUESTS.filter(r => r.status === 'PAGADA').length;
    const rejected = TRAVEL_REQUESTS.filter(r => r.status === 'RECHAZADA').length;
    const correctionRequested = TRAVEL_REQUESTS.filter(r => r.status === 'CORRECCION_SOLICITADA').length;

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
      totalRoles: ROLES.length,
    });
  });

  // Next.js & Prisma Production Code Artifacts
  app.get('/api/code-artifacts', (req, res) => {
    res.json(NEXTJS_CODE_ARTIFACTS);
  });

  // ================= CATCH-ALL API 404 HANDLER (PREVENTS HTML ON API CALLS) =================
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}`,
    });
  });

  return app;
}
