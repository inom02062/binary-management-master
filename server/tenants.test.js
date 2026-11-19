import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { disconnectTenantClients, getTenantDatabaseUrl, getTenantPrisma, provisionTenantDatabase } from './tenants.js';

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
