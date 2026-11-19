import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContractSchedule, buildInstallmentSchedule, calculateInstallmentLedger, getLegacyScheduleContext } from './installments.js';

test('schedule keeps the full term, clamps calendar dates, and reconciles rounding', () => {
  const schedule = buildInstallmentSchedule(100, 3, '2026-01-31');
  assert.deepEqual(schedule.map((row) => row.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(schedule.map((row) => row.amount), [33.34, 33.33, 33.33]);
  assert.equal(schedule.reduce((sum, row) => sum + row.amount, 0), 100);
});

test('contract schedule separates an unpaid deposit and starts monthly dues next month', () => {
  const schedule = buildContractSchedule(1000, 200, 0, 4, '2026-01-31');
  assert.deepEqual(schedule.map((row) => row.date), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  assert.deepEqual(schedule.map((row) => row.amount), [200, 200, 200, 200, 200]);
  assert.equal(schedule.reduce((sum, row) => sum + row.amount, 0), 1000);
});

test('new schedule reflects deposit receipts already collected before schedule creation', () => {
  const schedule = buildContractSchedule(900, 200, 100, 4, '2026-01-15');
  const ledger = calculateInstallmentLedger(schedule, [{ amount: 100, date: '2026-01-01', status: 'PAID' }], 100, new Date('2026-01-20T00:00:00.000Z'));
  assert.equal(ledger.scheduledTotal, 900);
  assert.equal(ledger.appliedToSchedule, 0);
  assert.equal(ledger.scheduleBalance, 900);
  assert.equal(ledger.installments[0].amount, 100);
});

test('ledger accounts for deposit, partial receipts, and overdue installments without deleting rows', () => {
  const schedule = [
    { id: 's1', amount: 500, date: '2026-08-01', status: 'PLANNED' },
    { id: 's2', amount: 500, date: '2026-09-01', status: 'PLANNED' },
    { id: 's3', amount: 500, date: '2026-10-01', status: 'PLANNED' }
  ];
  const receipts = [
    { id: 'r1', amount: 400, date: '2026-07-01', status: 'PAID' },
    { id: 'r2', amount: 700, date: '2026-08-01', status: 'PAID' },
    { id: 'r3', amount: 100, date: '2026-09-01', status: 'PAID' }
  ];
  const ledger = calculateInstallmentLedger(schedule, receipts, 400, new Date('2026-10-13T00:00:00.000Z'), 0);

  assert.equal(ledger.installments.length, 3);
  assert.deepEqual(ledger.installments.map((row) => row.status), ['PAID', 'PARTIAL', 'OVERDUE']);
  assert.deepEqual(ledger.installments.map((row) => row.paidAmount), [500, 300, 0]);
  assert.equal(ledger.overdueBalance, 700);
  assert.equal(ledger.scheduleBalance, 700);
});

test('ledger honors a grace period before marking a due date overdue', () => {
  const [row] = calculateInstallmentLedger(
    [{ id: 's1', amount: 100, date: '2026-10-01', status: 'PLANNED' }],
    [],
    0,
    new Date('2026-10-13T00:00:00.000Z'),
    15
  ).installments;

  assert.equal(row.status, 'UPCOMING');
  assert.equal(row.daysLate, 0);
});

test('legacy marked-paid installments recover the term and are not counted twice', () => {
  const payments = [
    { id: 'paid-1', amount: 200, date: '2026-01-01', note: 'Monthly Payment 1/4', status: 'PAID' },
    { id: 'receipt-1', amount: 100, date: '2026-01-02', note: 'Manual', status: 'PAID' },
    { id: 'plan-2', amount: 700, date: '2026-02-01', note: 'Monthly Payment 2/4', status: 'PLANNED' }
  ];
  const context = getLegacyScheduleContext(payments, 1000);
  const ledger = calculateInstallmentLedger(payments, context.receipts, context.paidBeforeSchedule, new Date('2026-01-15T00:00:00.000Z'));

  assert.equal(context.termMonths, 4);
  assert.equal(context.legacySchedulePaidAmount, 200);
  assert.equal(context.paidBeforeSchedule, 100);
  assert.deepEqual(context.receipts.map((payment) => payment.id), ['receipt-1']);
  assert.equal(ledger.installments[0].paidAmount, 0);
});