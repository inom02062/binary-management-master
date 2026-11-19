import { api } from './api';
import * as sync from './sync';
import { tenantStorageKey } from './tenantStorage';

export async function migrateLocalToServer(): Promise<{ migrated: boolean; message?: string }> {
  try {
    const blocksKey = tenantStorageKey('blm_blocks');
    const apartmentsKey = tenantStorageKey('blm_apts');
    const migratedKey = tenantStorageKey('blm_migrated_to_sqlite');
    if (localStorage.getItem(migratedKey)) return { migrated: false, message: 'already_migrated' };
    const blocksRaw = localStorage.getItem(blocksKey);
    const aptsRaw = localStorage.getItem(apartmentsKey);
    if (!blocksRaw && !aptsRaw) return { migrated: false, message: 'no_local_data' };

    const blocks = blocksRaw ? JSON.parse(blocksRaw) : [];
    const apts = aptsRaw ? JSON.parse(aptsRaw) : [];

    if (!Array.isArray(blocks) || !Array.isArray(apts)) return { migrated: false, message: 'invalid_local_format' };

    const payloadBlocks = blocks.map((b: any) => {
      const apartments = apts.filter((a: any) => a.blockId === b.id).map((a: any) => ({
        id: a.id,
        blockId: a.blockId,
        floor: a.floor,
        number: a.number,
        status: a.status || 'EMPTY',
        tenantName: a.tenantName || null,
        tenantSurname: a.tenantSurname || null,
        totalAmount: a.totalAmount ?? null,
        downPayment: a.downPayment ?? 0,
        firstDueDate: a.firstDueDate ?? a.contractStartDate ?? null,
        installmentMonths: a.installmentMonths ?? null,
        scheduleBasePaid: a.scheduleBasePaid ?? 0,
        gracePeriodDays: a.gracePeriodDays ?? 0,
        payments: Array.isArray(a.payments) ? a.payments : []
      }));
      return { ...b, apartments };
    });

    // Before importing, ensure pending ops are flushed. If not flushed, attempt to flush; if still present, abort.
    try {
      await sync.flushPending();
    } catch (e) {
      // If flush failed, do not attempt import
      return { migrated: false, message: 'pending_flush_failed' };
    }

    const ok = await api.importDb(JSON.stringify({ blocks: payloadBlocks }));
    if (!ok) return { migrated: false, message: 'import_failed' };
    // Clear any pending ops (they should've been flushed before) and clear local mock DB keys
    try {
      await sync.flushPending();
    } catch (e) { /* ignore */ }
    // clear local storage mock DB keys
    localStorage.removeItem(blocksKey);
    localStorage.removeItem(apartmentsKey);
    localStorage.removeItem(tenantStorageKey('blm_pending_ops'));
    localStorage.setItem(migratedKey, new Date().toISOString());
    return { migrated: true };
  } catch (e: any) {
    console.warn('Migration to server failed:', e);
    return { migrated: false, message: String(e) };
  }
}

export function hasLocalData(): boolean {
  return !!(localStorage.getItem(tenantStorageKey('blm_blocks')) || localStorage.getItem(tenantStorageKey('blm_apts')));
}

export function getLocalCounts(): { blocks: number; apartments: number } {
  const blocksRaw = localStorage.getItem(tenantStorageKey('blm_blocks'));
  const aptsRaw = localStorage.getItem(tenantStorageKey('blm_apts'));
  const blocks = blocksRaw ? JSON.parse(blocksRaw) : [];
  const apts = aptsRaw ? JSON.parse(aptsRaw) : [];
  return { blocks: Array.isArray(blocks) ? blocks.length : 0, apartments: Array.isArray(apts) ? apts.length : 0 };
}
