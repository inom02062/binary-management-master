import { Apartment, AuditLogEntry, Block, Payment, TenantAccount, User } from '../types';
import { db as mockDb } from './mockDb';
import * as sync from './sync';
import { API_BASE_URL } from './apiBase';
import { setTenantStorageScope, tenantStorageKey } from './tenantStorage';

/**
 * API SERVICE (BRIDGE TO PRISMA/SQLITE)
 * 
 * To switch back to mock database, replace implementation with mockDb calls
 */

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const fetchApi = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include' });
  if (res.status === 401 && !['/api/login', '/api/me', '/api/logout'].includes(path)) {
    window.dispatchEvent(new Event('blm:unauthorized'));
  }
  return res;
};

const json = async (res: Response) => {
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export const api = {
  // --- BUILDINGS (BLOCKS) ---
  getBlocks: async (): Promise<Block[]> => {
    try {
      const res = await fetchApi('/api/blocks');
      const blocks = await json(res);
      // Sync local cache
      localStorage.setItem(tenantStorageKey('blm_blocks'), JSON.stringify(blocks));
      return blocks;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, using mockDb', e);
      return mockDb.getBlocks();
    }
  },

  saveBlock: async (block: Block): Promise<Block> => {
    try {
      const res = await fetchApi('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });
      const saved = await json(res) as Block;

      // Update local cache immediately with server response
      mockDb.saveBlock(saved);

      return saved;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, queueing op and using mockDb', e);
      sync.enqueue({ type: 'saveBlock', payload: block });
      mockDb.saveBlock(block);
      return block;
    }
  },

  deleteBlock: async (id: string): Promise<void> => {
    try {
      await json(await fetchApi(`/api/blocks/${id}`, { method: 'DELETE' }));
      // on success remove any pending delete for this id and remove local data
      sync.removeOpsForEntity('deleteBlock', 'id', id);
      mockDb.deleteBlock(id);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, queueing delete and using mockDb', e);
      sync.enqueue({ type: 'deleteBlock', payload: { id } });
      mockDb.deleteBlock(id);
    }
  },

  // --- APARTMENTS ---
  getApartments: async (): Promise<Apartment[]> => {
    try {
      const res = await fetchApi('/api/apartments');
      const apts = await json(res);
      // Sync local cache
      localStorage.setItem(tenantStorageKey('blm_apts'), JSON.stringify(apts));
      return apts;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, using mockDb', e);
      return mockDb.getApartments();
    }
  },

  getApartmentsByBlock: async (blockId: string): Promise<Apartment[]> => {
    try {
      const res = await fetchApi(`/api/blocks/${blockId}/apartments`);
      return json(res);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, using mockDb', e);
      return mockDb.getApartmentsByBlock(blockId);
    }
  },

  saveApartment: async (apt: Apartment): Promise<Apartment> => {
    try {
      const res = await fetchApi('/api/apartments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apt) });
      const saved = await json(res) as Apartment;
      try {
        sync.removeOpsForEntity('saveApartment', 'id', saved.id);
        mockDb.saveApartment(saved);
      } catch (e) {
        console.warn('Reconcile after saveApartment failed', e);
      }
      return saved;
    } catch (e: any) {
      if (e instanceof ApiError) throw e;
      // Do not queue validation errors originating from server
      if (e?.message === 'block_not_found' || e?.message === 'invalid_foreign_key') {
        throw e;
      }

      console.warn('Backend unavailable, queueing op and using mockDb', e);
      sync.enqueue({ type: 'saveApartment', payload: apt });
      mockDb.saveApartment(apt);
      return apt;
    }
  },

  deleteApartment: async (id: string): Promise<void> => {
    try {
      await json(await fetchApi(`/api/apartments/${id}`, { method: 'DELETE' }));
      mockDb.saveApartment({ id, status: 'DELETED' } as any); // Simple sync hack or just ignore if mock isn't key
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable during deleteApartment', e);
    }
  },

  // --- SYSTEM ---
  exportDb: async (): Promise<string> => {
    try {
      const res = await fetchApi('/api/export');
      return JSON.stringify(await json(res), null, 2);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, using mockDb', e);
      return mockDb.exportDatabase();
    }
  },

  importDb: async (jsonStr: string): Promise<boolean> => {
    try {
      const payload = JSON.parse(jsonStr);
      const res = await fetchApi('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return (await json(res)).ok === true;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable during import, using mockDb', e);
      // If server not reachable, fall back to importing into mockDb (local only)
      return mockDb.importDatabase(jsonStr);
    }
  },

  getPayments: async (): Promise<any[]> => {
    try {
      const res = await fetchApi('/api/payments');
      return json(res);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable, using local payments fallback', e);
      // Fallback: extract payments from local apartments data
      const apts = mockDb.getApartments();
      const blocks = mockDb.getBlocks();
      const payments: any[] = [];
      apts.forEach(a => {
        const block = blocks.find(b => b.id === a.blockId);
        (a.payments || []).forEach(p => {
          payments.push({
            ...p,
            apartment: { ...a, block }
          });
        });
      });
      return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  },
  // --- PAYMENTS ---
  addPayment: async (aptId: string, payment: Partial<Payment>): Promise<Payment> => {
    try {
      const res = await fetchApi(`/api/apartments/${aptId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
      });
      return json(res);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable during addPayment', e);
      // Local fallback for addPayment could be complex with manual ID generation
      throw e;
    }
  },

  updatePayment: async (id: string, payment: Partial<Payment>): Promise<Payment> => {
    try {
      const res = await fetchApi(`/api/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
      });
      return json(res);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable during updatePayment', e);
      throw e;
    }
  },

  deletePayment: async (id: string): Promise<void> => {
    try {
      await json(await fetchApi(`/api/payments/${id}`, { method: 'DELETE' }));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn('Backend unavailable during deletePayment', e);
      throw e;
    }
  },

  login: async (username: string, password: string): Promise<{ ok: boolean, user?: User, reason?: string }> => {
    try {
      const res = await fetchApi('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await json(res);
      if (result.ok) setTenantStorageScope(result.user?.tenantId);
      return result;
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) return { ok: false, reason: 'invalid_credentials' };
        if (e.status === 403 && e.message.includes('password_reset_required')) {
          return { ok: false, reason: 'password_reset_required' };
        }
        if (e.status === 429) return { ok: false, reason: 'too_many_attempts' };
      }
      return { ok: false, reason: 'server_unavailable' };
    }
  },

  getSession: async (): Promise<User | null> => {
    try {
      const user = (await json(await fetchApi('/api/me'))).user as User;
      setTenantStorageScope(user.tenantId);
      return user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setTenantStorageScope(null);
        return null;
      }
      throw e;
    }
  },

  logout: async (): Promise<void> => {
    await json(await fetchApi('/api/logout', { method: 'POST' }));
    setTenantStorageScope(null);
  },

  getAdminUsers: async () => json(await fetchApi('/api/admin/users')),

  createAdminUser: async (payload: { username: string; password: string; role: 'ADMIN' | 'VIEWER' }) => json(await fetchApi('/api/admin/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })),

  updateAdminUser: async (id: string, payload: { role?: 'ADMIN' | 'VIEWER'; isActive?: boolean }) => json(await fetchApi(`/api/admin/users/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })),

  resetAdminPassword: async (id: string, password: string) => json(await fetchApi(`/api/admin/users/${id}/password`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  })),

  deleteAdminUser: async (id: string) => json(await fetchApi(`/api/admin/users/${id}`, { method: 'DELETE' })),

  getAuditLog: async (): Promise<AuditLogEntry[]> => json(await fetchApi('/api/admin/audit')),

  clearAuditLog: async (): Promise<{ ok: boolean; deletedCount: number }> => json(await fetchApi('/api/admin/audit', { method: 'DELETE' })),

  getControlTenants: async (): Promise<TenantAccount[]> => json(await fetchApi('/api/control/tenants')),

  getControlAuditLog: async (): Promise<AuditLogEntry[]> => json(await fetchApi('/api/control/audit')),

  clearControlAuditLog: async (): Promise<{ ok: boolean; deletedCount: number }> => json(await fetchApi('/api/control/audit/platform', { method: 'DELETE' })),

  clearControlTenantAuditLog: async (tenantId: string): Promise<{ ok: boolean; deletedCount: number }> => json(await fetchApi(`/api/control/tenants/${tenantId}/audit`, { method: 'DELETE' })),

  createControlTenant: async (payload: { name: string; username: string; password: string }): Promise<{ id: string; name: string; username: string; isActive: boolean; createdAt: string }> => json(await fetchApi('/api/control/tenants', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })),

  setControlTenantActive: async (id: string, isActive: boolean) => json(await fetchApi(`/api/control/tenants/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }),
  })),

  deleteControlTenant: async (id: string) => json(await fetchApi(`/api/control/tenants/${id}`, { method: 'DELETE' })),

  resetControlTenantUserPassword: async (tenantId: string, userId: string, password: string) => json(await fetchApi(`/api/control/tenants/${tenantId}/users/${userId}/password`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  })),

  createControlTenantUser: async (tenantId: string, payload: { username: string; password: string; role: TenantAccount['users'][number]['role'] }) => json(await fetchApi(`/api/control/tenants/${tenantId}/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })),

  updateControlTenantUser: async (tenantId: string, userId: string, payload: { role?: TenantAccount['users'][number]['role']; isActive?: boolean }) => json(await fetchApi(`/api/control/tenants/${tenantId}/users/${userId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })),

  clearDb: async (): Promise<boolean> => {
    try {
      // 1. Try to clear server-side data if available
      try {
        await json(await fetchApi('/api/reset', { method: 'POST' }));
      } catch (e) {
        if (e instanceof ApiError) throw e;
        console.warn('Server reset failed or unavailable', e);
      }

      // 2. Clear all local storage keys
      const keysToClear = [
        'blm_blocks',
        'blm_apts',
        'blm_migrated_to_sqlite',
        'blm_pending_ops'
      ];
      keysToClear.forEach(key => localStorage.removeItem(tenantStorageKey(key)));

      return true;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.error('Clear DB failed', e);
      return false;
    }
  }
};
export const pendingCount = () => sync.getPendingCount();
