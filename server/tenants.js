import { PrismaClient } from '@prisma/client';
import { execFile } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const tenantClients = new Map();

const defaultTenantDataDir = () => process.env.TENANT_DATA_DIR || path.join(process.cwd(), 'data', 'tenants');

export function getPlatformDatabaseUrl() {
  return process.env.PLATFORM_DATABASE_URL || `file:${path.join(process.cwd(), 'data', 'platform.db')}`;
}

export function getTenantDatabaseUrl(tenantId, dataDir = defaultTenantDataDir()) {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('invalid_tenant_id');
  return `file:${path.join(path.resolve(dataDir), `${tenantId}.db`)}`;
}

export async function provisionTenantDatabase(tenantId, dataDir = defaultTenantDataDir()) {
  const databaseUrl = getTenantDatabaseUrl(tenantId, dataDir);
  const databasePath = databaseUrl.slice('file:'.length);
  await mkdir(path.dirname(databasePath), { recursive: true });

  try {
    await migrateTenantDatabase(databaseUrl);
    return databaseUrl;
  } catch (error) {
    await rm(databasePath, { force: true });
    throw error;
  }
}

export async function migrateTenantDatabase(databaseUrl) {
  if (!databaseUrl.startsWith('file:')) throw new Error('unsupported_tenant_database_url');
  const databasePath = databaseUrl.slice('file:'.length).split('?')[0];
  await mkdir(path.dirname(path.resolve(databasePath)), { recursive: true });
  const prismaCli = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js');
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
}

export function getTenantPrisma(databaseUrl) {
  let client = tenantClients.get(databaseUrl);
  if (!client) {
    client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    tenantClients.set(databaseUrl, client);
  }
  return client;
}

export async function disconnectTenantClient(databaseUrl) {
  const client = tenantClients.get(databaseUrl);
  if (!client) return;
  await client.$disconnect();
  tenantClients.delete(databaseUrl);
}

export async function disconnectTenantClients() {
  await Promise.all([...tenantClients.values()].map(client => client.$disconnect()));
  tenantClients.clear();
}
