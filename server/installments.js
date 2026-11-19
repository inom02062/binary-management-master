const toCents = (amount) => Math.round((Number(amount) || 0) * 100);
const fromCents = (amount) => amount / 100;

function dateMonthsAfter(date, offset) {
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)));
}

export function buildInstallmentSchedule(balance, months, firstDueDate, scheduleAnchorDay = null) {
  const monthCount = Number(months);
  const firstDate = new Date(`${firstDueDate}T00:00:00.000Z`);
  const balanceCents = toCents(balance);
  if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 360) throw new Error('term_must_be_1_to_360_months');
  if (!Number.isFinite(firstDate.getTime())) throw new Error('invalid_first_due_date');
  if (balanceCents <= 0) throw new Error('balance_must_be_positive');

  const baseCents = Math.floor(balanceCents / monthCount);
  const remainderCents = balanceCents - baseCents * monthCount;
  const anchorDay = scheduleAnchorDay || firstDate.getUTCDate();

  return Array.from({ length: monthCount }, (_, index) => {
    const monthStart = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + index, 1));
    const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const dueDate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(anchorDay, lastDay)));
    const cents = baseCents + (index < remainderCents ? 1 : 0);
    return {
      id: `plan-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      amount: fromCents(cents),
      date: dueDate.toISOString().slice(0, 10),
      note: `Installment ${index + 1}/${monthCount}`,
      status: 'PLANNED'
    };
  });
}

export function buildContractSchedule(contractBalance, downPayment, paidToDate, months, firstDueDate) {
  const remainingCents = toCents(contractBalance);
  if (remainingCents <= 0) return [];
  const unpaidDeposit = Math.min(remainingCents, Math.max(0, toCents(downPayment) - toCents(paidToDate)));
  const monthlyBalance = remainingCents - unpaidDeposit;
  const schedule = [];

  if (unpaidDeposit > 0) {
    schedule.push({
      id: `deposit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      amount: fromCents(unpaidDeposit),
      date: firstDueDate,
      note: 'Down payment',
      status: 'PLANNED'
    });
  }

  if (monthlyBalance > 0) {
    const anchor = new Date(`${firstDueDate}T00:00:00.000Z`);
    if (!Number.isFinite(anchor.getTime())) throw new Error('invalid_first_due_date');
    const monthOffset = unpaidDeposit > 0 ? 1 : 0;
    const monthlyStart = dateMonthsAfter(anchor, monthOffset);
    schedule.push(...buildInstallmentSchedule(fromCents(monthlyBalance), months, monthlyStart.toISOString().slice(0, 10), anchor.getUTCDate()));
  }

  return schedule;
}

export function getLegacyScheduleContext(payments = [], contractAmount = 0) {
  const legacyPaidInstallments = payments.filter((payment) => payment.status !== 'PLANNED' && payment.status !== 'CANCELLED' && /\d+\s*\/\s*\d+/.test(payment.note || ''));
  const receipts = payments.filter((payment) => payment.status !== 'PLANNED' && payment.status !== 'CANCELLED' && !legacyPaidInstallments.includes(payment));
  const plannedTotal = payments.filter((payment) => payment.status === 'PLANNED').reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const legacySchedulePaidAmount = legacyPaidInstallments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const termMonths = payments.reduce((maxMonths, payment) => {
    const match = (payment.note || '').match(/\d+\s*\/\s*(\d+)/);
    return match ? Math.max(maxMonths, Number(match[1]) || 0) : maxMonths;
  }, 0);

  return {
    receipts,
    legacySchedulePaidAmount,
    paidBeforeSchedule: Math.max(0, (Number(contractAmount) || 0) - plannedTotal - legacySchedulePaidAmount),
    termMonths
  };
}

export function calculateInstallmentLedger(schedule, receipts, paidBeforeSchedule = 0, asOf = new Date(), graceDays = 0) {
  const rows = (schedule || [])
    .filter((payment) => payment.status === 'PLANNED')
    .map((payment) => ({ ...payment, paidAmount: 0 }))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const validReceipts = (receipts || [])
    .filter((payment) => payment.status !== 'PLANNED' && payment.status !== 'CANCELLED' && Number(payment.amount) > 0)
    .slice()
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));

  let paidBeforeScheduleRemaining = toCents(paidBeforeSchedule);
  let scheduleRemaining = rows.reduce((sum, row) => sum + toCents(row.amount), 0);
  let appliedToSchedule = 0;

  for (const receipt of validReceipts) {
    let receiptRemaining = toCents(receipt.amount);
    const previouslyPaid = Math.min(receiptRemaining, paidBeforeScheduleRemaining);
    receiptRemaining -= previouslyPaid;
    paidBeforeScheduleRemaining -= previouslyPaid;

    for (const row of rows) {
      if (receiptRemaining <= 0) break;
      const outstanding = toCents(row.amount) - toCents(row.paidAmount);
      const applied = Math.min(receiptRemaining, outstanding);
      row.paidAmount = fromCents(toCents(row.paidAmount) + applied);
      receiptRemaining -= applied;
      scheduleRemaining -= applied;
      appliedToSchedule += applied;
    }
  }

  const asOfDay = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const graceMs = Math.max(0, Number(graceDays) || 0) * 86400000;
  const installments = rows.map((row) => {
    const dueDay = Date.parse(`${String(row.date).slice(0, 10)}T00:00:00.000Z`);
    const outstanding = Math.max(0, toCents(row.amount) - toCents(row.paidAmount));
    const lateByMs = asOfDay - dueDay - graceMs - 1;
    const daysLate = outstanding > 0 && lateByMs >= 0 ? Math.floor(lateByMs / 86400000) + 1 : 0;
    const status = outstanding === 0 ? 'PAID' : row.paidAmount > 0 ? 'PARTIAL' : daysLate > 0 ? 'OVERDUE' : 'UPCOMING';
    return { ...row, remainingAmount: fromCents(outstanding), status, daysLate };
  });

  return {
    installments,
    scheduledTotal: fromCents(rows.reduce((sum, row) => sum + toCents(row.amount), 0)),
    appliedToSchedule: fromCents(appliedToSchedule),
    scheduleBalance: fromCents(scheduleRemaining),
    overdueBalance: fromCents(installments.filter((row) => row.status === 'OVERDUE' || (row.status === 'PARTIAL' && row.daysLate > 0)).reduce((sum, row) => sum + toCents(row.remainingAmount), 0))
  };
}