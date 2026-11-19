
import { tenantStorageKey } from './tenantStorage';

const PENDING_KEY = 'blm_pending_ops';

type Op =
  | { type: 'saveBlock'; payload: any }
  | { type: 'deleteBlock'; payload: { id: string } }
  | { type: 'saveApartment'; payload: any }
  | { type: 'createPayment'; payload: any };

function readQueue(key = tenantStorageKey(PENDING_KEY)): Op[] {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function writeQueue(q: Op[], key = tenantStorageKey(PENDING_KEY)) {
  localStorage.setItem(key, JSON.stringify(q));
}

export function enqueue(op: Op) {
  const q = readQueue();
  q.push(op);
  writeQueue(q);
}

export function clearQueue() {
  localStorage.removeItem(tenantStorageKey(PENDING_KEY));
}

export function removeOpsForEntity(type: Op['type'], idField: string, id: string) {
  const key = tenantStorageKey(PENDING_KEY);
  const q = readQueue(key);
  const filtered = q.filter(op => {
    if (op.type !== type) return true;
    // for deleteBlock payload is { id }
    if (op.type === 'deleteBlock') return (op.payload?.id !== id);
    // for saveBlock/saveApartment/createPayment payloads may have id
    return op.payload?.id !== id;
  });
  writeQueue(filtered, key);
}

export function getPendingCount() {
  return readQueue().length;
}

export async function flushPending(): Promise<{ ok: boolean; details?: any }> {
  const queueKey = tenantStorageKey(PENDING_KEY);
  const q = readQueue(queueKey);
  if (q.length === 0) return { ok: true };

  const failures: any[] = [];
  const nonRetryable: any[] = [];
  for (const op of q) {
    try {
      const BASE = ((import.meta as any).env?.VITE_API_URL) || 'http://localhost:4000';
      let res: Response | null = null;
      if (op.type === 'saveBlock') {
        // POST /api/blocks handles create or update
        res = await fetch(`${BASE}/api/blocks`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) });
      } else if (op.type === 'deleteBlock') {
        res = await fetch(`${BASE}/api/blocks/${op.payload.id}`, { method: 'DELETE', credentials: 'include' });
      } else if (op.type === 'saveApartment') {
        res = await fetch(`${BASE}/api/apartments`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) });
      } else if (op.type === 'createPayment') {
        const { apartmentId, amount, date, note } = op.payload;
        res = await fetch(`${BASE}/api/apartments/${apartmentId}/payments`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, date, note }) });
      }

      if (res && !res.ok) {
        // parse body for details
        let body: any = null;
        try { body = await res.json(); } catch (e) { body = await res.text(); }
        // non-retryable client errors (validation) -> drop from queue
        if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403) {
          nonRetryable.push({ op, status: res.status, body });
          continue; // do not add to failures
        }
        // server errors -> retry later
        failures.push({ op, status: res.status, body });
      }
    } catch (e) {
      failures.push({ op, error: String(e) });
    }
  }

  if (failures.length === 0 && nonRetryable.length === 0) {
    localStorage.removeItem(queueKey);
    return { ok: true };
  }

  // requeue only the retryable failures
  const failedOps = failures.map(f => f.op);
  writeQueue(failedOps, queueKey);
  return { ok: false, details: { failures, nonRetryable } };
}
