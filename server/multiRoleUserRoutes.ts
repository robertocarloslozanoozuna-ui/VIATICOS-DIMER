import type { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from './supabase.js';
import {
  ALL_SYSTEM_PERMISSIONS,
  getUserById,
  getUserByEmail,
  listUsers,
  insertUser,
  updateUser,
  deleteUser,
  listRoles,
  sanitizeUser,
  hasPermission,
  hashPassword,
  recordAuditLog,
} from './db.js';
import type { Role, User } from '../src/types.js';

function parseCookies(req: Request) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}

function verifyJwt(token: string): { sub: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT inválido');
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) throw new Error('JWT inválido');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub: string; exp?: number };
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Sesión expirada');
  return payload;
}

async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const cookies = parseCookies(req);
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const token = bearer || String(cookies.dimer_session || '');
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    const stored = await getUserById(payload.sub);
    if (!stored || stored.status !== 'ACTIVO') return null;
    return stored;
  } catch {
    return null;
  }
}

function requireUserAdmin(req: Request, res: Response, next: NextFunction) {
  void getAuthenticatedUser(req).then(user => {
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    if (!hasPermission(user, 'administrar_usuarios')) {
      return res.status(403).json({ error: 'No tienes permiso para esta operación' });
    }
    (req as any).dimerUser = user;
    next();
  }).catch(() => res.status(503).json({ error: 'Base de datos no disponible' }));
}

async function resolveRoleSelection(body: any, currentRoleIds?: string[]) {
  const hasRoleIds = Array.isArray(body?.roleIds);
  const hasRoleId = body?.roleId !== undefined && body?.roleId !== null && String(body.roleId).trim() !== '';
  if (!hasRoleIds && !hasRoleId) return currentRoleIds;

  const rawIds = hasRoleIds ? body.roleIds : [body.roleId];
  const roleIds = Array.from(new Set((rawIds as unknown[])
    .map(id => String(id || '').trim())
    .filter(Boolean)));
  if (!roleIds.length) throw new Error('Debe asignarse al menos un rol al usuario.');

  const roles = await listRoles();
  const invalid = roleIds.filter(id => !roles.some(r => r.id === id));
  if (invalid.length) throw new Error(`Rol(es) no encontrado(s): ${invalid.join(', ')}`);
  return roleIds;
}

async function syncUserRoles(userId: string, roleIds: string[]) {
  if (!roleIds.length) throw new Error('Debe existir al menos un rol asignado.');
  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  const rows = roleIds.map(roleId => ({ user_id: userId, role_id: roleId }));
  const { error: insertError } = await supabase.from('user_roles').insert(rows);
  if (insertError) throw insertError;
}

export function registerMultiRoleUserRoutes(app: Express) {
  app.get('/api/users', requireUserAdmin, async (_req, res) => {
    try {
      return res.json(await listUsers());
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'Error interno' });
    }
  });

  app.post('/api/users', requireUserAdmin, async (req, res) => {
    try {
      const { name, email, password, department, status } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
      }
      const clean = String(email).trim().toLowerCase();
      if (await getUserByEmail(clean)) return res.status(400).json({ error: 'El correo ya está registrado' });

      const roleIds = await resolveRoleSelection(req.body, ['role_solicitante']);
      if (!roleIds?.length) return res.status(400).json({ error: 'Debe asignarse al menos un rol al usuario.' });
      const roles = await listRoles();
      const primaryRole = roles.find(r => r.id === roleIds[0]);
      if (!primaryRole) return res.status(400).json({ error: 'El rol principal seleccionado no existe.' });
      const { hash, salt } = hashPassword(String(password));
      const rec = {
        id: `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        name: String(name).trim(),
        email: clean,
        department: String(department || 'General').trim(),
        role: primaryRole.name.toUpperCase() as Role,
        roleId: primaryRole.id,
        roleIds,
        status: status === 'INACTIVO' ? 'INACTIVO' as const : 'ACTIVO' as const,
        isVerified: true,
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
      };
      const created = await insertUser(rec);
      await syncUserRoles(created.id, roleIds);
      const user = await getUserById(created.id);
      if (!user) throw new Error('No fue posible recuperar el usuario creado.');
      await recordAuditLog({
        userId: (req as any).dimerUser.id,
        action: 'ROLES_ACTUALIZADOS',
        details: { targetUserId: user.id, targetEmail: user.email, previousRoleIds: [], newRoleIds: roleIds }
      });
      return res.json({ success: true, user });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error interno' });
    }
  });

  app.put('/api/users/:id', requireUserAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const target = await getUserById(id);
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

      const previousRoleIds = target.roleIds?.length ? [...target.roleIds] : (target.roleId ? [target.roleId] : []);
      const roleIds = await resolveRoleSelection(req.body, previousRoleIds);
      const p: any = { ...req.body };
      if (roleIds?.length) {
        const roles = await listRoles();
        const primaryRole = roles.find(r => r.id === roleIds[0]);
        if (!primaryRole) return res.status(400).json({ error: 'El rol principal seleccionado no existe.' });
        p.roleIds = roleIds;
        p.roleId = primaryRole.id;
        p.role = primaryRole.name.toUpperCase() as Role;
      }
      if (p.password) {
        const { hash, salt } = hashPassword(String(p.password));
        p.passwordHash = hash;
        p.salt = salt;
        delete p.password;
      }

      const updated = await updateUser(id, p);
      if (roleIds?.length) await syncUserRoles(id, roleIds);
      const user = await getUserById(id);
      if (!user) throw new Error('No fue posible recuperar el usuario actualizado.');

      if (roleIds?.join('|') !== previousRoleIds.join('|')) {
        await recordAuditLog({
          userId: (req as any).dimerUser.id,
          action: 'ROLES_ACTUALIZADOS',
          details: { targetUserId: id, targetEmail: user.email, previousRoleIds, newRoleIds: roleIds }
        });
      }
      return res.json({ success: true, user: user || sanitizeUser(updated) });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error interno' });
    }
  });

  app.delete('/api/users/:id', requireUserAdmin, async (req, res) => {
    try {
      const target = await getUserById(String(req.params.id));
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (target.email.toLowerCase() === 'sistemas@dimer.com.mx') {
        return res.status(400).json({ error: 'No se puede eliminar la cuenta principal de administración.' });
      }
      await deleteUser(target.id);
      await recordAuditLog({
        userId: (req as any).dimerUser.id,
        action: 'ELIMINACION_USUARIO',
        details: { targetUserId: target.id, targetEmail: target.email, targetName: target.name }
      });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error interno' });
    }
  });
}
