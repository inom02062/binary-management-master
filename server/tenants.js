import { execFile } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { PrismaClient } from './prisma-client.js';

const execFileAsync = promisify(execFile);
const tenantClients = new Map();
const defaultTenantDataDir = () => process.env.TENANT_DATA_DIR || path.join(process.cwd(), 'data', 'tenants');
const isPostgresUrl = value => /^postgres(?:ql)?:\/\//.test(value || '');
const usesPostgres = () => process.env.DB_PROVIDER === 'postgresql' || isPostgresUrl(process.env.DATABASE_URL);
const postgresSchemaRefPrefix = 'postgres-schema:';

function withSchema(databaseUrl, schema) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function postgresSchemaName(databaseUrl) {
  if (!databaseUrl.startsWith(postgresSchemaRefPrefix) && !isPostgresUrl(databaseUrl)) return null;
  const schema = databaseUrl.startsWith(postgresSchemaRefPrefix)
    ? databaseUrl.slice(postgresSchemaRefPrefix.length)
    : new URL(databaseUrl).searchParams.get('schema');
  if (!/^(tenant_[0-9a-f_]+|main|platform)$/.test(schema || '')) throw new Error('invalid_database_schema');
  return schema;
}

export function resolveDatabaseUrl(databaseUrl) {
  if (!databaseUrl.startsWith(postgresSchemaRefPrefix)) return databaseUrl;
  const baseUrl = process.env.DATABASE_URL;
  if (!isPostgresUrl(baseUrl)) throw new Error('postgres_database_url_required');
  const schema = postgresSchemaName(databaseUrl);
  return withSchema(baseUrl, schema);
}

export function getPlatformDatabaseUrl() {
  if (usesPostgres()) {
    const databaseUrl = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
    if (!isPostgresUrl(databaseUrl)) throw new Error('postgres_database_url_required');
    return withSchema(databaseUrl, 'platform');
  }
  return process.env.PLATFORM_DATABASE_URL || `file:${path.join(process.cwd(), 'data', 'platform.db')}`;
}

export function getDefaultTenantDatabaseUrl() {
  if (usesPostgres()) return `${postgresSchemaRefPrefix}main`;
  return process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'data', 'dev.db')}`;
}

export function getTenantDatabaseUrl(tenantId, dataDir = defaultTenantDataDir()) {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('invalid_tenant_id');
  if (usesPostgres()) return `${postgresSchemaRefPrefix}tenant_${tenantId.replaceAll('-', '_')}`;
  return `file:${path.join(path.resolve(dataDir), `${tenantId}.db`)}`;
}

async function ensurePostgresSchema(databaseUrl) {
  const schema = postgresSchemaName(databaseUrl);
  if (!schema) return;
  const client = getTenantPrisma(databaseUrl);
  await client.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
}

export async function provisionTenantDatabase(tenantId, dataDir = defaultTenantDataDir()) {
  const databaseUrl = getTenantDatabaseUrl(tenantId, dataDir);
  if (databaseUrl.startsWith(postgresSchemaRefPrefix)) {
    try {
      await ensurePostgresSchema(databaseUrl);
      await migrateTenantDatabase(databaseUrl);
      return databaseUrl;
    } catch (error) {
      await deleteTenantDatabase(databaseUrl);
      throw error;
    }
  }

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
  const resolvedUrl = resolveDatabaseUrl(databaseUrl);
  const postgres = isPostgresUrl(resolvedUrl);
  if (!postgres && !resolvedUrl.startsWith('file:')) throw new Error('unsupported_tenant_database_url');
  if (postgres) {
    await ensurePostgresSchema(resolvedUrl);
  } else {
    const databasePath = resolvedUrl.slice('file:'.length).split('?')[0];
    await mkdir(path.dirname(path.resolve(databasePath)), { recursive: true });
  }

  const prismaCli = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js');
  const schemaPath = postgres ? 'prisma/postgres/schema.prisma' : 'prisma/schema.prisma';
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
    env: { ...process.env, DATABASE_URL: resolvedUrl },
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
}

export function getTenantPrisma(databaseUrl) {
  const resolvedUrl = resolveDatabaseUrl(databaseUrl);
  let client = tenantClients.get(resolvedUrl);
  if (!client) {
    client = new PrismaClient({ datasources: { db: { url: resolvedUrl } } });
    tenantClients.set(resolvedUrl, client);
  }
  return client;
}

export async function disconnectTenantClient(databaseUrl) {
  const resolvedUrl = resolveDatabaseUrl(databaseUrl);
  const client = tenantClients.get(resolvedUrl);
  if (!client) return;
  await client.$disconnect();
  tenantClients.delete(resolvedUrl);
}

export async function deleteTenantDatabase(databaseUrl) {
  const schema = postgresSchemaName(databaseUrl);
  if (schema) {
    await disconnectTenantClient(databaseUrl);
    const client = getTenantPrisma(databaseUrl);
    await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await disconnectTenantClient(databaseUrl);
    return;
  }
  if (!databaseUrl.startsWith('file:')) throw new Error('unsupported_tenant_database_url');
  await disconnectTenantClient(databaseUrl);
  await rm(databaseUrl.slice('file:'.length), { force: true });
}

export async function disconnectTenantClients() {
  await Promise.all([...tenantClients.values()].map(client => client.$disconnect()));
  tenantClients.clear();
}
