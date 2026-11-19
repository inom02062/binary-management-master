import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { disconnectTenantClients, getDefaultTenantDatabaseUrl, getPlatformDatabaseUrl, getTenantDatabaseUrl, getTenantPrisma, provisionTenantDatabase, resolveDatabaseUrl } from './tenants.js';

test('PostgreSQL tenant references resolve to isolated schemas without storing connection credentials', () => {
  const previous = {
    DB_PROVIDER: process.env.DB_PROVIDER,
    DATABASE_URL: process.env.DATABASE_URL,
    PLATFORM_DATABASE_URL: process.env.PLATFORM_DATABASE_URL,
  };
  process.env.DB_PROVIDER = 'postgresql';
  process.env.DATABASE_URL = 'postgresql://db.example/app?sslmode=require';
  process.env.PLATFORM_DATABASE_URL = process.env.DATABASE_URL;

  try {
    const tenantId = 'c0a80123-4567-489a-bcde-123456789012';
    const tenantReference = getTenantDatabaseUrl(tenantId);
    assert.equal(tenantReference, 'postgres-schema:tenant_c0a80123_4567_489a_bcde_123456789012');
    assert.equal(new URL(resolveDatabaseUrl(tenantReference)).searchParams.get('schema'), 'tenant_c0a80123_4567_489a_bcde_123456789012');
    assert.equal(getDefaultTenantDatabaseUrl(), 'postgres-schema:main');
    assert.equal(new URL(getPlatformDatabaseUrl()).searchParams.get('schema'), 'platform');
    assert.equal(tenantReference.includes('@'), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('tenant database URL uses a server-generated ID under the tenant data directory', () => {
  const tenantId = 'c0a80123-4567-489a-bcde-123456789012';
  assert.equal(
    getTenantDatabaseUrl(tenantId, '/srv/app/tenants'),
    `file:${path.join('/srv/app/tenants', `${tenantId}.db`)}`
  );
});

test('tenant database URL rejects IDs that could escape the tenant directory', () => {
  assert.throws(() => getTenantDatabaseUrl('../../shared'), /invalid_tenant_id/);
});

test('provisioned tenant databases do not share business data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blm-tenants-'));
  try {
    const dataDir = path.join(root, 'tenants');
    const firstUrl = await provisionTenantDatabase('c0a80123-4567-489a-bcde-123456789012', dataDir);
    const secondUrl = await provisionTenantDatabase('c0a80123-4567-489a-bcde-123456789013', dataDir);
    const first = getTenantPrisma(firstUrl);
    const second = getTenantPrisma(secondUrl);

    await first.block.create({ data: { name: 'First company', x: 0, y: 0, width: 100, height: 100, floorsCount: 1, aptsPerFloor: 1, color: '#123456' } });

    assert.equal(await first.block.count(), 1);
    assert.equal(await second.block.count(), 0);
  } finally {
    await disconnectTenantClients();
    await rm(root, { recursive: true, force: true });
  }
});
