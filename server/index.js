import { PrismaClient } from './prisma-client.js';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { createHash, randomBytes, randomUUID } from 'crypto';
import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import http from 'http';
import { Server } from 'socket.io';
import { hasPermission, isValidPassword, isValidRole, PERMISSIONS } from './auth.js';
import { createExpiredSessionCookie, createSessionCookie } from './sessionCookie.js';
import { deleteTenantDatabase, getDefaultTenantDatabaseUrl, getPlatformDatabaseUrl, getTenantDatabaseUrl, getTenantPrisma, migrateTenantDatabase, provisionTenantDatabase, resolveDatabaseUrl } from './tenants.js';

const platformDatabaseUrl = getPlatformDatabaseUrl();
const legacyDatabaseUrl = getDefaultTenantDatabaseUrl();
if (resolveDatabaseUrl(platformDatabaseUrl) === resolveDatabaseUrl(legacyDatabaseUrl)) throw new Error('platform_database_must_be_separate');
const platformPrisma = new PrismaClient({ datasources: { db: { url: platformDatabaseUrl } } });
const legacyPrisma = new PrismaClient({ datasources: { db: { url: resolveDatabaseUrl(legacyDatabaseUrl) } } });
const tenantContext = new AsyncLocalStorage();
const prisma = new Proxy(platformPrisma, {
  get(target, property) {
    const activeClient = tenantContext.getStore()?.client ?? target;
    const value = Reflect.get(activeClient, property, activeClient);
    return typeof value === 'function' ? value.bind(activeClient) : value;
  },
});
const app = express();
const httpServer = http.createServer(app);
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:3001').split(',').map(value => value.trim()).filter(Boolean));
const cookieName = 'blm_session';
const sessionDurationMs = 8 * 60 * 60 * 1000;
let startupReady = false;
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 10);
const io = new Server(httpServer, {
  cors: {
    origin: [...allowedOrigins],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

const port = process.env.PORT || 4000;

const notifyUpdate = () => {
  console.log('[WS] Broadcasting data_updated');
  const tenantId = tenantContext.getStore()?.tenantId;
  if (tenantId) io.to(tenantId).emit('data_updated');
};

app.use(cors({ origin: [...allowedOrigins], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const prefix = `${name}=`;
  const value = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res, token) {
  const production = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', createSessionCookie(token, Math.floor(sessionDurationMs / 1000), production));
}

function clearSessionCookie(res) {
  const production = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', createExpiredSessionCookie(production));
}

async function logActivity(req, action, details = null, username = req.user?.username || 'anonymous', tenantId = req.user?.tenantId ?? null) {
  await platformPrisma.activityLog.create({
    data: {
      id: randomUUID(),
      username,
      tenantId,
      action,
      details: details ? JSON.stringify(details) : null,
      ipAddress: req.ip || null,
    },
  });
}

async function authenticate(req, res, next) {
  try {
    const token = readCookie(req, cookieName);
    if (!token) return res.status(401).json({ ok: false, message: 'authentication_required' });
    const session = await platformPrisma.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: { include: { tenant: true } } },
    });
    const tenantIsValid = session?.user.role === 'SUPERADMIN'
      || Boolean(session?.user.tenantId && session.user.tenant?.isActive);
    if (!session || session.expiresAt <= new Date() || !session.user.isActive || !isValidRole(session.user.role) || !tenantIsValid) {
      if (session) await platformPrisma.authSession.deleteMany({ where: { tokenHash: session.tokenHash } });
      clearSessionCookie(res);
      return res.status(401).json({ ok: false, message: 'authentication_required' });
    }
    req.user = {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      tenantId: session.user.tenantId,
    };
    req.sessionTokenHash = session.tokenHash;
    if (session.user.tenant) {
      tenantContext.run({ client: getTenantPrisma(session.user.tenant.databaseUrl), tenantId: session.user.tenantId }, next);
    } else {
      next();
    }
  } catch (error) {
    next(error);
  }
}

const permissionForRequest = (req) => {
  const path = req.path;
  const method = req.method;
  if (path === '/me' && method === 'GET') return PERMISSIONS.READ_DATA;
  if (path === '/admin/users' && method === 'GET') return PERMISSIONS.MANAGE_USERS;
  if (path === '/admin/users' && method === 'POST') return PERMISSIONS.MANAGE_USERS;
  if (/^\/admin\/users\/[^/]+(?:\/password)?$/.test(path) && ['PATCH', 'DELETE'].includes(method)) return PERMISSIONS.MANAGE_USERS;
  if (path === '/admin/audit' && method === 'GET') return PERMISSIONS.VIEW_AUDIT_LOG;
  if (path === '/admin/audit' && method === 'DELETE') return PERMISSIONS.CLEAR_AUDIT_LOG;
  if (path === '/blocks' && method === 'GET' || path === '/apartments' && method === 'GET' || path === '/payments' && method === 'GET' || /^\/blocks\/[^/]+\/apartments$/.test(path) && method === 'GET') return PERMISSIONS.READ_DATA;
  if (path === '/blocks' && method === 'POST' || path === '/apartments' && method === 'POST' || /^\/apartments\/[^/]+\/payments$/.test(path) && method === 'POST' || /^\/payments\/[^/]+$/.test(path) && ['PATCH', 'DELETE'].includes(method) || /^\/blocks\/[^/]+$/.test(path) && method === 'DELETE') return PERMISSIONS.WRITE_DATA;
  if (/^\/apartments\/[^/]+$/.test(path) && method === 'DELETE') return PERMISSIONS.WRITE_DATA;
  if (path === '/export' && method === 'GET') return PERMISSIONS.EXPORT_DATA;
  if (path === '/import' && method === 'POST') return PERMISSIONS.IMPORT_DATA;
  if (path === '/reset' && method === 'POST') return PERMISSIONS.RESET_DATA;
  return null;
};

function authorizeRequest(req, res, next) {
  if (req.path.startsWith('/control/')) {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ ok: false, message: 'forbidden' });
    return next();
  }
  if (req.user.role === 'SUPERADMIN' && req.path !== '/me') {
    return res.status(403).json({ ok: false, message: 'forbidden' });
  }
  const permission = permissionForRequest(req);
  if (!permission) return res.status(404).json({ ok: false, message: 'not_found' });
  if (!hasPermission(req.user.role, permission)) return res.status(403).json({ ok: false, message: 'forbidden' });
  next();
}

const loginAttempts = new Map();
function limitLoginAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const state = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (state.resetAt <= now) {
    state.count = 0;
    state.resetAt = now + 15 * 60 * 1000;
  }
  state.count += 1;
  loginAttempts.set(key, state);
  if (state.count > 20) return res.status(429).json({ ok: false, message: 'too_many_attempts' });
  next();
}

app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.headers.origin || !allowedOrigins.has(req.headers.origin)) return res.status(403).json({ ok: false, message: 'invalid_origin' });
  next();
});

io.use(async (socket, next) => {
  try {
    const token = readCookie({ headers: { cookie: socket.handshake.headers.cookie } }, cookieName);
    if (!token) return next(new Error('unauthorized'));
    const session = await platformPrisma.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: { include: { tenant: true } } },
    });
    const tenantIsValid = session?.user.role === 'SUPERADMIN'
      || Boolean(session?.user.tenantId && session.user.tenant?.isActive);
    if (!session || session.expiresAt <= new Date() || !session.user.isActive || !tenantIsValid || !hasPermission(session.user.role, PERMISSIONS.READ_DATA)) {
      return next(new Error('unauthorized'));
    }
    socket.data.user = { id: session.user.id, username: session.user.username, role: session.user.role, tenantId: session.user.tenantId };
    if (session.user.tenantId) socket.join(session.user.tenantId);
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/health', (req, res) => {
  if (!startupReady) return res.status(503).json({ ok: false, message: 'server_starting' });
  res.json({ ok: true });
});

// Auth
app.post('/api/login', limitLoginAttempts, async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(401).json({ ok: false, message: 'invalid_credentials' });
  const cleanUsername = username.trim().slice(0, 50);
  const user = await platformPrisma.user.findUnique({ where: { username: cleanUsername }, include: { tenant: true } });
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyPasswordHash);
  if (user?.username === 'admin' && password === 'admin123') {
    await logActivity(req, 'login_blocked_default_password', null, user.username);
    return res.status(403).json({ ok: false, message: 'password_reset_required' });
  }
  const tenantIsValid = user?.role === 'SUPERADMIN' || Boolean(user?.tenantId && user.tenant?.isActive);
  if (!user || !valid || Buffer.byteLength(password, 'utf8') > 72 || !user.isActive || !isValidRole(user.role) || !tenantIsValid) {
    await logActivity(req, 'login_failed', null, cleanUsername);
    return res.status(401).json({ ok: false, message: 'invalid_credentials' });
  }
  const token = randomBytes(32).toString('base64url');
  loginAttempts.delete(req.ip || 'unknown');
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await platformPrisma.authSession.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt } });
  req.user = user;
  await logActivity(req, 'login_succeeded');
  setSessionCookie(res, token);
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role, tenantId: user.tenantId } });
});

app.post('/api/logout', async (req, res, next) => {
  try {
    const token = readCookie(req, cookieName);
    if (token) {
      const session = await platformPrisma.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
      if (session) {
        req.user = session.user;
        await platformPrisma.authSession.deleteMany({ where: { tokenHash: session.tokenHash } });
        await logActivity(req, 'logout');
      }
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res, next) => {
  if (!startupReady) return res.status(503).json({ ok: false, message: 'server_starting' });
  next();
});
app.use('/api', authenticate, authorizeRequest);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/me', (req, res) => res.json({ ok: true, user: req.user }));

app.get('/api/control/tenants', async (req, res) => {
  const tenants = await platformPrisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: {
        where: { role: { in: ['HYPERADMIN', 'ADMIN', 'VIEWER'] } },
        select: { id: true, username: true, role: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  res.json(tenants.map(tenant => ({
    id: tenant.id,
    name: tenant.name,
    users: tenant.users,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
  })));
});

app.get('/api/control/audit', async (req, res) => {
  const logs = await platformPrisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  res.json(logs);
});

app.delete('/api/control/audit/platform', async (req, res) => {
  const result = await platformPrisma.activityLog.deleteMany({ where: { tenantId: null } });
  await logActivity(req, 'audit_log_cleared', { deletedCount: result.count });
  res.json({ ok: true, deletedCount: result.count });
});

app.delete('/api/control/tenants/:id/audit', async (req, res) => {
  const tenant = await platformPrisma.tenant.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!tenant) return res.status(404).json({ ok: false, message: 'tenant_not_found' });
  const result = await platformPrisma.activityLog.deleteMany({ where: { tenantId: tenant.id } });
  await logActivity(req, 'audit_log_cleared', { deletedCount: result.count }, req.user.username, tenant.id);
  res.json({ ok: true, deletedCount: result.count });
});

app.post('/api/control/tenants', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const { password } = req.body;
  if (name.length < 2 || name.length > 100 || !/^[A-Za-z0-9_.-]{3,50}$/.test(username)
    || !isValidPassword(password)) {
    return res.status(400).json({ ok: false, message: 'invalid_tenant_data' });
  }

  const id = randomUUID();
  let databaseUrl;
  try {
    databaseUrl = await provisionTenantDatabase(id);
    const tenant = await platformPrisma.$transaction(async tx => {
      const createdTenant = await tx.tenant.create({ data: { id, name, databaseUrl } });
      await tx.user.create({
        data: { username, passwordHash: await bcrypt.hash(password, 12), role: 'HYPERADMIN', tenantId: id },
      });
      return createdTenant;
    });
    await logActivity(req, 'tenant_created', { tenantId: id, name, username }, req.user.username, id);
    res.status(201).json({ id: tenant.id, name: tenant.name, username, isActive: tenant.isActive, createdAt: tenant.createdAt });
  } catch (error) {
    if (databaseUrl) await deleteTenantDatabase(databaseUrl);
    if (error?.code === 'P2002') return res.status(409).json({ ok: false, message: 'username_taken' });
    console.error('Tenant creation failed', error);
    res.status(500).json({ ok: false, message: 'tenant_creation_failed' });
  }
});

app.patch('/api/control/tenants/:id', async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ ok: false, message: 'invalid_tenant_data' });
  const tenant = await platformPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!tenant) return res.status(404).json({ ok: false, message: 'tenant_not_found' });
  await platformPrisma.$transaction(async tx => {
    await tx.tenant.update({ where: { id: tenant.id }, data: { isActive: req.body.isActive } });
    if (!req.body.isActive) {
      const users = await tx.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      await tx.authSession.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
    }
  });
  if (!req.body.isActive) io.in(tenant.id).disconnectSockets(true);
  await logActivity(req, req.body.isActive ? 'tenant_enabled' : 'tenant_disabled', { tenantId: tenant.id }, req.user.username, tenant.id);
  res.json({ id: tenant.id, name: tenant.name, isActive: req.body.isActive });
});

app.delete('/api/control/tenants/:id', async (req, res) => {
  const tenant = await platformPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!tenant) return res.status(404).json({ ok: false, message: 'tenant_not_found' });
  const expectedDatabaseUrl = getTenantDatabaseUrl(tenant.id);
  if (tenant.databaseUrl !== expectedDatabaseUrl) {
    console.error('Tenant database URL does not match its assigned path', { tenantId: tenant.id });
    return res.status(500).json({ ok: false, message: 'tenant_database_cleanup_failed' });
  }

  await platformPrisma.$transaction(async tx => {
    const users = await tx.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
    await tx.authSession.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
    await tx.user.deleteMany({ where: { tenantId: tenant.id } });
    await tx.tenant.delete({ where: { id: tenant.id } });
  });

  try {
    await deleteTenantDatabase(expectedDatabaseUrl);
  } catch (error) {
    console.error('Tenant database cleanup failed', error);
    return res.status(500).json({ ok: false, message: 'tenant_database_cleanup_failed' });
  }

  await logActivity(req, 'tenant_deleted', { tenantId: tenant.id, name: tenant.name });
  res.json({ ok: true });
});

app.patch('/api/control/tenants/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!isValidPassword(password)) {
    return res.status(400).json({ ok: false, message: 'invalid_password' });
  }
  const tenant = await platformPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!tenant) return res.status(404).json({ ok: false, message: 'tenant_not_found' });
  const admin = await platformPrisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: ['HYPERADMIN', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!admin) return res.status(404).json({ ok: false, message: 'tenant_admin_not_found' });
  await platformPrisma.$transaction(async tx => {
    await tx.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    await tx.authSession.deleteMany({ where: { userId: admin.id } });
  });
  await logActivity(req, 'tenant_password_reset', { tenantId: tenant.id, userId: admin.id }, req.user.username, tenant.id);
  res.json({ ok: true });
});

app.patch('/api/control/tenants/:id/users/:userId/password', async (req, res) => {
  const { password } = req.body;
  if (!isValidPassword(password)) {
    return res.status(400).json({ ok: false, message: 'invalid_password' });
  }
  const target = await platformPrisma.user.findFirst({
    where: { id: req.params.userId, tenantId: req.params.id, role: { in: ['HYPERADMIN', 'ADMIN', 'VIEWER'] } },
    select: { id: true },
  });
  if (!target) return res.status(404).json({ ok: false, message: 'user_not_found' });
  await platformPrisma.$transaction(async tx => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    await tx.authSession.deleteMany({ where: { userId: target.id } });
  });
  await logActivity(req, 'tenant_user_password_reset', { tenantId: req.params.id, userId: target.id }, req.user.username, req.params.id);
  res.json({ ok: true });
});

app.post('/api/control/tenants/:id/users', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const { password, role } = req.body;
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)
    || !isValidPassword(password)
    || !['HYPERADMIN', 'ADMIN', 'VIEWER'].includes(role)) {
    return res.status(400).json({ ok: false, message: 'invalid_user_data' });
  }
  const tenant = await platformPrisma.tenant.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!tenant) return res.status(404).json({ ok: false, message: 'tenant_not_found' });
  try {
    const user = await platformPrisma.user.create({
      data: { username, passwordHash: await bcrypt.hash(password, 12), role, tenantId: tenant.id },
      select: { id: true, username: true, role: true, isActive: true },
    });
    await logActivity(req, 'tenant_user_created', { tenantId: tenant.id, userId: user.id, role: user.role }, req.user.username, tenant.id);
    res.status(201).json(user);
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ ok: false, message: 'username_taken' });
    console.error('Tenant user creation failed', error);
    res.status(500).json({ ok: false, message: 'tenant_user_creation_failed' });
  }
});

app.patch('/api/control/tenants/:id/users/:userId', async (req, res) => {
  const { role, isActive } = req.body;
  if (role === undefined && isActive === undefined
    || role !== undefined && !['HYPERADMIN', 'ADMIN', 'VIEWER'].includes(role)
    || isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ ok: false, message: 'invalid_user_data' });
  }
  const target = await platformPrisma.user.findFirst({
    where: { id: req.params.userId, tenantId: req.params.id, role: { in: ['HYPERADMIN', 'ADMIN', 'VIEWER'] } },
    select: { id: true, role: true },
  });
  if (!target) return res.status(404).json({ ok: false, message: 'user_not_found' });
  const user = await platformPrisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id: target.id },
      data: { role, isActive },
      select: { id: true, username: true, role: true, isActive: true },
    });
    if (role !== undefined && role !== target.role || isActive === false) {
      await tx.authSession.deleteMany({ where: { userId: target.id } });
    }
    return updated;
  });
  await logActivity(req, 'tenant_user_updated', { tenantId: req.params.id, userId: user.id, role: user.role, isActive: user.isActive }, req.user.username, req.params.id);
  res.json(user);
});

app.get('/api/admin/users', async (req, res) => {
  const users = await platformPrisma.user.findMany({
    where: { tenantId: req.user.tenantId, role: { in: ['ADMIN', 'VIEWER'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
  });
  res.json(users);
});

app.post('/api/admin/users', async (req, res) => {
  const { username, password, role } = req.body;
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(cleanUsername) || !isValidPassword(password) || !['ADMIN', 'VIEWER'].includes(role) || !req.user.tenantId) {
    return res.status(400).json({ ok: false, message: 'invalid_user_data' });
  }
  try {
    const created = await platformPrisma.user.create({ data: { username: cleanUsername, passwordHash: await bcrypt.hash(password, 12), role, tenantId: req.user.tenantId } });
    await logActivity(req, 'user_created', { userId: created.id, role: created.role });
    res.status(201).json({ id: created.id, username: created.username, role: created.role, isActive: created.isActive, createdAt: created.createdAt });
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ ok: false, message: 'username_taken' });
    console.error('User creation failed', error);
    return res.status(500).json({ ok: false, message: 'user_creation_failed' });
  }
});

app.patch('/api/admin/users/:id', async (req, res) => {
  const { role, isActive } = req.body;
  if (role === undefined && isActive === undefined || role !== undefined && !['ADMIN', 'VIEWER'].includes(role) || isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ ok: false, message: 'invalid_user_data' });
  }
  const outcome = await platformPrisma.$transaction(async tx => {
    const target = await tx.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.tenantId !== req.user.tenantId || !['ADMIN', 'VIEWER'].includes(target.role)) return { error: 'user_not_found', status: 404 };
    if (target.id === req.user.id && (role && role !== target.role || isActive === false)) {
      return { error: 'cannot_change_own_admin_access', status: 409 };
    }
    const user = await tx.user.update({ where: { id: target.id }, data: { role, isActive }, select: { id: true, username: true, role: true, isActive: true, createdAt: true } });
    if (role !== undefined && role !== target.role || isActive === false) await tx.authSession.deleteMany({ where: { userId: target.id } });
    return { user };
  });
  if (outcome.error) return res.status(outcome.status).json({ ok: false, message: outcome.error });
  await logActivity(req, 'user_updated', { userId: outcome.user.id, role: outcome.user.role, isActive: outcome.user.isActive });
  res.json(outcome.user);
});

app.patch('/api/admin/users/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!isValidPassword(password)) {
    return res.status(400).json({ ok: false, message: 'invalid_password' });
  }
  const target = await platformPrisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId, role: { in: ['ADMIN', 'VIEWER'] } }, select: { id: true, username: true } });
  if (!target) return res.status(404).json({ ok: false, message: 'user_not_found' });
  await platformPrisma.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  await platformPrisma.authSession.deleteMany({ where: { userId: target.id } });
  await logActivity(req, 'user_password_reset', { userId: target.id });
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const target = await platformPrisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.user.tenantId, role: { in: ['ADMIN', 'VIEWER'] } },
    select: { id: true, role: true },
  });
  if (!target) return res.status(404).json({ ok: false, message: 'user_not_found' });
  await platformPrisma.user.delete({ where: { id: target.id } });
  await logActivity(req, 'user_deleted', { userId: target.id, role: target.role });
  res.json({ ok: true });
});

app.get('/api/admin/audit', async (req, res) => {
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 100, 500));
  const logs = await platformPrisma.activityLog.findMany({ where: { tenantId: req.user.tenantId }, orderBy: { createdAt: 'desc' }, take: limit });
  res.json(logs);
});

app.delete('/api/admin/audit', async (req, res) => {
  const result = await platformPrisma.activityLog.deleteMany({ where: { tenantId: req.user.tenantId } });
  await logActivity(req, 'audit_log_cleared', { deletedCount: result.count });
  res.json({ ok: true, deletedCount: result.count });
});

// Blocks
app.get('/api/blocks', async (req, res) => {
  const blocks = await prisma.block.findMany({ include: { apartments: { include: { payments: true } } } });
  res.json(blocks);
});

app.post('/api/blocks', async (req, res) => {
  const payload = req.body;
  console.log('[DEBUG] POST /api/blocks payload:', { ...payload, imageUrl: payload.imageUrl ? 'data:image/...' : null });

  // Avoid passing nested apartments (or payments) directly; extract and ignore/create separately
  const { apartments: payloadApts = [], ...blockData } = payload;

  // If payload.id provided: try update, otherwise create with provided id
  if (blockData.id) {
    try {
      const updated = await prisma.block.update({
        where: { id: blockData.id },
        data: {
          name: blockData.name,
          x: blockData.x,
          y: blockData.y,
          width: blockData.width,
          height: blockData.height,
          floorsCount: blockData.floorsCount,
          aptsPerFloor: blockData.aptsPerFloor,
          color: blockData.color,
          imageUrl: blockData.imageUrl
        },
        include: { apartments: { include: { payments: true } } }
      });
      res.json(updated);
      return;
    } catch (e) {
      // not found -> create with id
      const block = await prisma.block.create({ data: blockData });
      // initialize apartments
      const apts = [];
      let currentAptNum = 1;
      for (let f = 1; f <= block.floorsCount; f++) {
        for (let a = 1; a <= block.aptsPerFloor; a++) {
          apts.push({ blockId: block.id, floor: f, number: currentAptNum++ });
        }
      }
      await prisma.apartment.createMany({ data: apts });
      const created = await prisma.block.findUnique({ where: { id: block.id }, include: { apartments: { include: { payments: true } } } });
      res.json(created);
      return;
    }
  }
  // no id -> create normally
  const block = await prisma.block.create({ data: blockData });
  const apts = [];
  let currentAptNum = 1;
  for (let f = 1; f <= block.floorsCount; f++) {
    for (let a = 1; a <= block.aptsPerFloor; a++) {
      apts.push({ blockId: block.id, floor: f, number: currentAptNum++ });
    }
  }
  await prisma.apartment.createMany({ data: apts });
  const created = await prisma.block.findUnique({ where: { id: block.id }, include: { apartments: { include: { payments: true } } } });
  notifyUpdate();
  res.json(created);
});

app.delete('/api/blocks/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.block.delete({ where: { id } });
  notifyUpdate();
  res.json({ ok: true });
});

// Apartments
app.get('/api/apartments', async (req, res) => {
  const apts = await prisma.apartment.findMany({ include: { payments: true } });
  res.json(apts);
});

app.get('/api/blocks/:blockId/apartments', async (req, res) => {
  const { blockId } = req.params;
  const apts = await prisma.apartment.findMany({ where: { blockId }, include: { payments: true } });
  res.json(apts);
});

app.post('/api/apartments', async (req, res) => {
  const payload = req.body;
  const payments = Array.isArray(payload.payments) ? payload.payments : [];
  const aptData = { ...payload };
  delete aptData.payments;

  const apartmentLayoutBounds = {
    layoutX: [0, 1000],
    layoutY: [0, 700],
    layoutWidth: [80, 1000],
    layoutHeight: [65, 700],
  };
  for (const [field, [minimum, maximum]] of Object.entries(apartmentLayoutBounds)) {
    const value = aptData[field];
    if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)) {
      return res.status(400).json({ ok: false, message: 'invalid_apartment_layout' });
    }
  }

  // Ensure block exists when blockId is provided
  if (aptData.blockId) {
    const block = await prisma.block.findUnique({ where: { id: aptData.blockId } });
    if (!block) return res.status(400).json({ ok: false, message: 'block_not_found' });
  }

  if (aptData.id) {
    try {
      const updated = await prisma.apartment.update({ where: { id: aptData.id }, data: aptData, include: { payments: true } });

      // Keep only provided payments, delete others for this apartment
      const providedPayloadIds = payments.map(p => p.id).filter(Boolean);
      await prisma.payment.deleteMany({
        where: {
          apartmentId: updated.id,
          id: { notIn: providedPayloadIds }
        }
      });

      // upsert payments separately
      for (const p of payments) {
        const payData = { apartmentId: updated.id, amount: Number(p.amount), date: new Date(p.date), note: p.note, status: p.status };
        if (p.id) {
          await prisma.payment.upsert({ where: { id: p.id }, create: { id: p.id, ...payData }, update: payData });
        } else {
          await prisma.payment.create({ data: payData });
        }
      }
      const withPayments = await prisma.apartment.findUnique({ where: { id: updated.id }, include: { payments: true } });
      notifyUpdate();
      res.json(withPayments);
      return;
    } catch (e) {
      // If update failed because apartment was not found, fallthrough to create.
      // For other errors (foreign key etc.) return error instead of attempting create.
      if (e?.code && e.code !== 'P2025') {
        console.error('Apartment update failed:', e);
        return res.status(400).json({ ok: false, message: String(e) });
      }
      // else continue to create
    }
  }

  // create new apartment
  try {
    const created = await prisma.apartment.create({ data: aptData });
    for (const p of payments) {
      await prisma.payment.create({ data: { apartmentId: created.id, amount: Number(p.amount), date: new Date(p.date), note: p.note, status: p.status } });
    }
    const withPayments = await prisma.apartment.findUnique({ where: { id: created.id }, include: { payments: true } });
    notifyUpdate();
    res.json(withPayments);
  } catch (e) {
    console.error('Apartment create failed:', e);
    if (e?.code === 'P2003') {
      return res.status(400).json({ ok: false, message: 'invalid_foreign_key', detail: String(e) });
    }
    res.status(500).json({ ok: false, message: String(e) });
  }
});

app.delete('/api/apartments/:id', async (req, res) => {
  await prisma.apartment.delete({ where: { id: req.params.id } });
  notifyUpdate();
  res.json({ ok: true });
});

// Payments
app.post('/api/apartments/:aptId/payments', async (req, res) => {
  const { aptId } = req.params;
  const { amount, date, note, status } = req.body;
  // Validate apartment exists
  const apt = await prisma.apartment.findUnique({ where: { id: aptId } });
  if (!apt) return res.status(400).json({ ok: false, message: 'apartment_not_found' });

  const created = await prisma.payment.create({ data: { apartmentId: aptId, amount: Number(amount), date: new Date(date), note, status } });
  notifyUpdate();
  res.json(created);
});

app.patch('/api/payments/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, date, note, status } = req.body;
  try {
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        amount: amount !== undefined ? Number(amount) : undefined,
        date: date ? new Date(date) : undefined,
        note,
        status
      }
    });
    await logActivity(req, 'data_imported', { blocks: blocks.length });
    notifyUpdate();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.payment.delete({ where: { id } });
    notifyUpdate();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/payments', async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      apartment: {
        include: {
          block: true
        }
      }
    },
    orderBy: {
      date: 'desc'
    }
  });
  res.json(payments);
});

// Export/Import
app.get('/api/export', async (req, res) => {
  const blocks = await prisma.block.findMany({ include: { apartments: { include: { payments: true } } } });
  await logActivity(req, 'data_exported', { blocks: blocks.length });
  res.json({ blocks, exportedAt: new Date().toISOString() });
});

app.post('/api/import', async (req, res) => {
  const { blocks } = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ ok: false, message: 'Invalid payload' });

  try {
    // Perform import as upserts inside a transaction to avoid destructive delete and to keep existing server data intact.
    await prisma.$transaction(async (tx) => {
      for (const b of blocks) {
        const { apartments = [], ...blockFields } = b;
        // Upsert block by id if provided, otherwise create new
        if (blockFields.id) {
          await tx.block.upsert({ where: { id: blockFields.id }, create: blockFields, update: blockFields });
        } else {
          const created = await tx.block.create({ data: blockFields });
          blockFields.id = created.id; // ensure subsequent apartments link
        }

        // Upsert apartments
        for (const a of apartments) {
          const { payments = [], ...aptFields } = a;
          if (aptFields.id) {
            await tx.apartment.upsert({ where: { id: aptFields.id }, create: { ...aptFields, blockId: blockFields.id }, update: { ...aptFields, blockId: blockFields.id } });
          } else {
            const createdApt = await tx.apartment.create({ data: { ...aptFields, blockId: blockFields.id } });
            aptFields.id = createdApt.id;
          }

          // Upsert payments for this apartment
          for (const p of payments) {
            const payData = { apartmentId: aptFields.id, amount: Number(p.amount), date: new Date(p.date), note: p.note };
            if (p.id) {
              await tx.payment.upsert({ where: { id: p.id }, create: { id: p.id, ...payData }, update: payData });
            } else {
              await tx.payment.create({ data: payData });
            }
          }
        }
      }
    });
    notifyUpdate();
    res.json({ ok: true });
  } catch (e) {
    console.error('Import failed', e);
    res.status(500).json({ ok: false, message: String(e) });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.payment.deleteMany(),
      prisma.apartment.deleteMany(),
      prisma.block.deleteMany(),
    ]);
    await logActivity(req, 'data_reset');
    notifyUpdate();
    res.json({ ok: true });
  } catch (e) {
    console.error('Reset failed', e);
    res.status(500).json({ ok: false, message: String(e) });
  }
});

// Start server
const server = httpServer.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
  // Ensure db migrations are applied by checking connectivity
  try {
    await migrateTenantDatabase(legacyDatabaseUrl);
    await migrateTenantDatabase(platformDatabaseUrl);
    await prisma.$connect();
    await legacyPrisma.$connect();
    console.log('Prisma connected');

    const databaseUrl = legacyDatabaseUrl;
    let defaultTenant = await platformPrisma.tenant.findUnique({ where: { databaseUrl } });
    if (!defaultTenant) {
      defaultTenant = await platformPrisma.tenant.create({
        data: { id: randomUUID(), name: process.env.DEFAULT_TENANT_NAME?.trim() || 'Main company', databaseUrl },
      });
    }

    const legacyUsers = await legacyPrisma.user.findMany();
    for (const user of legacyUsers) {
      await platformPrisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          tenantId: user.role === 'SUPERADMIN' ? null : defaultTenant.id,
          permissions: user.permissions,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        update: { tenantId: user.role === 'SUPERADMIN' ? null : defaultTenant.id },
      });
    }
    const legacyLogs = await legacyPrisma.activityLog.findMany();
    for (const log of legacyLogs) {
      await platformPrisma.activityLog.upsert({
        where: { id: log.id },
        create: { ...log, tenantId: defaultTenant.id },
        update: {},
      });
    }
    if (legacyUsers.length) await legacyPrisma.user.deleteMany();
    await legacyPrisma.activityLog.deleteMany();

    await platformPrisma.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });

    const superadminsCount = await platformPrisma.user.count({ where: { role: 'SUPERADMIN' } });
    if (superadminsCount === 0) {
      const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      if (username && isValidPassword(password) && /^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
        await platformPrisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 12), role: 'SUPERADMIN' } });
        console.log('[AUTH] Created the configured initial superadmin');
      } else {
        console.warn('[AUTH] No superadmin exists; set BOOTSTRAP_ADMIN_USERNAME and a 5+ character BOOTSTRAP_ADMIN_PASSWORD to create one');
      }
    }

    // Seed sample data if empty
    const cnt = await legacyPrisma.block.count();
    if (cnt === 0) {
      console.log('Seeding initial data...');
      const b = await legacyPrisma.block.create({ data: { name: 'Block A', x: 100, y: 100, width: 120, height: 80, floorsCount: 3, aptsPerFloor: 2, color: '#9b5cf7' } });
      const apts = [];
      let num = 1;
      for (let f = 1; f <= b.floorsCount; f++) {
        for (let a = 1; a <= b.aptsPerFloor; a++) {
          apts.push({ blockId: b.id, floor: f, number: num++ });
        }
      }
      await legacyPrisma.apartment.createMany({ data: apts });
      console.log('Seed complete');
    }

    const tenants = await platformPrisma.tenant.findMany({ where: { databaseUrl: { not: databaseUrl } } });
    for (const tenant of tenants) await migrateTenantDatabase(tenant.databaseUrl);
    startupReady = true;
  } catch (e) {
    console.error('Prisma connect failed', e);
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process or set a different PORT env variable before starting the server.`);
    console.error('Tip: run `ss -ltnp | grep ":' + port + '"` or `lsof -i :' + port + '` to find the process and `kill <pid>` to stop it.');
    process.exit(1);
  }
  console.error('Server error', err);
  process.exit(1);
});
