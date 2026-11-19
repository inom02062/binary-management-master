let activeTenantScope = 'unauthenticated';

export function setTenantStorageScope(tenantId?: string | null) {
  activeTenantScope = tenantId || 'platform';
}

export function tenantStorageKey(key: string) {
  return `${key}:${activeTenantScope}`;
}
