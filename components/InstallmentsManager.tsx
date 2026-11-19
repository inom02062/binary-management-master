import { AlertCircle, Banknote, Calendar, CheckCircle2, ChevronRight, CreditCard, Edit2, History, Search, Trash2, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { buildContractSchedule, calculateInstallmentLedger, getLegacyScheduleContext } from '../server/installments.js';
import { api } from '../services/api';
import { Apartment, ApartmentStatus, Payment } from '../types';

interface InstallmentsManagerProps {
    apartments: Apartment[];
    t: any;
    onRefresh: () => Promise<void>;
    canWrite?: boolean;
}

const todayInput = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
};

export const InstallmentsManager: React.FC<InstallmentsManagerProps> = ({ apartments, t, onRefresh, canWrite = true }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedApt, setSelectedApt] = useState<Apartment | null>(null);
    const [totalAmount, setTotalAmount] = useState<string>('');
    const [months, setMonths] = useState<string>('12');
    const [downPayment, setDownPayment] = useState<string>('0');
    const [firstDueDate, setFirstDueDate] = useState(todayInput);
    const [graceDays, setGraceDays] = useState('0');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [loading, setLoading] = useState(false);

    // New Payment State
    const [manualAmount, setManualAmount] = useState('');
    const [manualDate, setManualDate] = useState(todayInput);
    const [manualNote, setManualNote] = useState('');

    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

    const searchResults = useMemo(() => {
        const low = searchQuery.toLowerCase();
        return apartments.filter(a =>
            a.status !== ApartmentStatus.EMPTY && (!low || a.tenantName?.toLowerCase().includes(low) ||
                a.tenantSurname?.toLowerCase().includes(low) ||
                a.number.toString().includes(low))
        );
    }, [searchQuery, apartments]);

    const handleSelectApt = (apt: Apartment) => {
        setSelectedApt(apt);
        setTotalAmount(apt.totalAmount?.toString() || '');
        setDownPayment((apt.downPayment || 0).toString());
        setFirstDueDate(apt.firstDueDate || todayInput());
        setGraceDays(String(apt.gracePeriodDays || 0));
        setSearchQuery('');

        const planned = (apt.payments || []).filter(p => p.status === 'PLANNED').length;
        const legacyTerm = getLegacyScheduleContext(apt.payments || [], apt.totalAmount || 0).termMonths;
        setMonths(String(apt.installmentMonths || legacyTerm || planned || 12));
    };

    const actualPayments = useMemo(() => {
        if (!selectedApt) return [];
        return (selectedApt.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED');
    }, [selectedApt]);

    const plannedInstallments = useMemo(() => {
        if (!selectedApt) return [];
        return (selectedApt.payments || []).filter(p => p.status === 'PLANNED').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }, [selectedApt]);

    const totalPaid = useMemo(() => {
        return actualPayments.reduce((sum, p) => sum + p.amount, 0);
    }, [actualPayments]);

    const legacyScheduleContext = useMemo(() => getLegacyScheduleContext(selectedApt?.payments || [], selectedApt?.totalAmount || 0), [selectedApt]);

    const ledger = useMemo(() => calculateInstallmentLedger(
        plannedInstallments,
        legacyScheduleContext.receipts,
        selectedApt?.scheduleBasePaid ?? legacyScheduleContext.paidBeforeSchedule,
        new Date(),
        Number(graceDays)
    ), [plannedInstallments, legacyScheduleContext, selectedApt?.scheduleBasePaid, totalPaid, graceDays]);

    const contractBalance = Math.max(0, Number(totalAmount || 0) - totalPaid);
    const monthDue = ledger.installments.filter(row => {
        const due = new Date(`${row.date.slice(0, 10)}T00:00:00`);
        const now = new Date();
        return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
    }).reduce((sum, row) => sum + row.remainingAmount, 0);
    const visibleInstallments = ledger.installments.filter(row => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'OVERDUE') return row.status === 'OVERDUE' || (row.status === 'PARTIAL' && row.daysLate > 0);
        return row.status === statusFilter;
    });
    const nextUnpaidInstallment = ledger.installments.find(row => row.remainingAmount > 0);

    const handleGenerate = async () => {
        if (!selectedApt || !totalAmount || !months || !firstDueDate || !canWrite) return;
        setLoading(true);

        const total = parseFloat(totalAmount);
        const numMonths = parseInt(months);
        const deposit = Number(downPayment);
        const remaining = total - totalPaid;

        const grace = Number(graceDays);
        if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(numMonths) || numMonths < 1 || numMonths > 360 || !Number.isFinite(deposit) || deposit < 0 || deposit > total || !Number.isInteger(grace) || grace < 0 || grace > 365 || remaining <= 0) {
            alert(t.invalidContract || 'Check contract price, deposit, term, and remaining balance.');
            setLoading(false);
            return;
        }

        try {
            const newPayments = buildContractSchedule(remaining, deposit, totalPaid, numMonths, firstDueDate) as Payment[];
            const paymentsWithArchivedPlans = (selectedApt.payments || []).map(payment => payment.status === 'PLANNED' ? { ...payment, status: 'CANCELLED' as const } : payment);
            const updatedApt = {
                ...selectedApt,
                totalAmount: total,
                downPayment: deposit,
                firstDueDate,
                installmentMonths: numMonths,
                scheduleBasePaid: Math.max(0, totalPaid - legacyScheduleContext.legacySchedulePaidAmount),
                gracePeriodDays: Number(graceDays),
                payments: [...paymentsWithArchivedPlans, ...newPayments]
            };
            await api.saveApartment(updatedApt);
            await onRefresh();
            await refreshAptData();
            alert(t.success);
        } catch (e: any) {
            alert(e?.message || 'Save failed');
        } finally {
            setLoading(false);
        }
    };

    const refreshAptData = async () => {
        if (!selectedApt) return;
        const updatedApts = await api.getApartments();
        const fresh = updatedApts.find(a => a.id === selectedApt.id);
        if (fresh) {
            setSelectedApt(fresh);
            const pCount = (fresh.payments || []).filter(p => p.status === 'PLANNED').length;
            setMonths(String(fresh.installmentMonths || pCount || 12));
            setTotalAmount(fresh.totalAmount?.toString() || '');
            setDownPayment((fresh.downPayment || 0).toString());
            setFirstDueDate(fresh.firstDueDate || todayInput());
            setGraceDays(String(fresh.gracePeriodDays || 0));
        }
    };

    const handleMarkAsPaid = async (paymentId: string) => {
        if (!selectedApt || !canWrite) return;
        const installment = ledger.installments.find(row => row.id === paymentId);
        if (!installment || installment.remainingAmount <= 0) return;
        setLoading(true);
        try {
            await api.addPayment(selectedApt.id, {
                amount: installment.remainingAmount,
                date: todayInput(),
                note: `Installment ${installment.date}`,
                status: 'PAID'
            });
            await onRefresh();
            await refreshAptData();
        } catch (e: any) {
            alert(e?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAddManualPayment = async () => {
        if (!selectedApt || !manualAmount || !manualDate || !canWrite) return;
        setLoading(true);
        try {
            const paidAmount = parseFloat(manualAmount);
            if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > contractBalance) {
                alert(t.paymentExceedsBalance || 'Payment must be positive and cannot exceed the contract balance.');
                return;
            }
            await api.addPayment(selectedApt.id, {
                amount: paidAmount,
                date: manualDate,
                note: manualNote || 'Receipt',
                status: 'PAID'
            });

            setManualAmount('');
            setManualNote('');
            await onRefresh();
            await refreshAptData();
        } catch (e: any) {
            alert(e?.message || 'Add failed');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePayment = async (id: string) => {
        if (!selectedApt || !canWrite || !confirm(t.deletePaymentConfirm || 'Delete this receipt? Schedule status will be recalculated.')) return;
        setLoading(true);
        try {
            await api.deletePayment(id);
            await onRefresh();
            await refreshAptData();
        } catch (e: any) {
            alert(e?.message || 'Delete failed');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePayment = async () => {
        if (!editingPayment || !selectedApt || !canWrite || editingPayment.status === 'CANCELLED') return;
        const balanceWithoutReceipt = contractBalance + (actualPayments.find(payment => payment.id === editingPayment.id)?.amount || 0);
        if (!Number.isFinite(editingPayment.amount) || editingPayment.amount <= 0 || editingPayment.amount > balanceWithoutReceipt) {
            alert(t.paymentExceedsBalance || 'Payment must be positive and cannot exceed the contract balance.');
            return;
        }
        setLoading(true);
        try {
            await api.updatePayment(editingPayment.id, {
                amount: editingPayment.amount,
                date: editingPayment.date,
                note: editingPayment.note,
                status: editingPayment.status
            });
            setEditingPayment(null);
            await onRefresh();
            await refreshAptData();
        } catch (e: any) {
            alert(e?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left: Search & Selection (3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            placeholder={t.searchPlaceholder}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-6 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all text-sm"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {searchResults.map(a => (
                            <button
                                key={a.id}
                                onClick={() => handleSelectApt(a)}
                                className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all text-left ${selectedApt?.id === a.id ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><User size={16} /></div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-xs">{a.tenantName} {a.tenantSurname}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Apt {a.number} • Floor {a.floor}</p>
                                        <p className="mt-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">{Math.max(0, (a.totalAmount || 0) - (a.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').reduce((sum, p) => sum + p.amount, 0)).toLocaleString()} UZS</p>
                                    </div>
                                </div>
                                <ChevronRight size={14} className="text-slate-300" />
                            </button>
                        ))}
                        {searchResults.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400 dark:border-slate-700">{t.noCustomers}</p>}
                    </div>
                </div>

                {/* Right: Management & History (9 cols) */}
                <div className="lg:col-span-9 space-y-6">
                    {!selectedApt ? (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-20 text-center space-y-4 shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                                <CreditCard size={40} />
                            </div>
                            <p className="text-slate-400 font-medium">{t.selectApt}</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Header */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
                                        {selectedApt.number}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 dark:text-white text-xl">{selectedApt.tenantName} {selectedApt.tenantSurname}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apartment {selectedApt.number} • Floor {selectedApt.floor} • {t.termMonths}: {selectedApt.installmentMonths || plannedInstallments.length || '—'} {t.months.toLowerCase()}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                                    {[
                                        { label: t.totalPaid, amount: totalPaid, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                                        { label: t.contractBalance, amount: contractBalance, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                        { label: t.overdueBalance, amount: ledger.overdueBalance, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                                        { label: t.dueThisMonth, amount: monthDue, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20' }
                                    ].map(metric => (
                                        <div key={metric.label} className={`rounded-2xl border border-slate-100 p-4 dark:border-slate-800 ${metric.bg}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{metric.label}</p>
                                            <p className={`mt-1 text-lg font-black ${metric.color}`}>{metric.amount.toLocaleString()} <span className="text-[10px]">UZS</span></p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Generator & Tools */}
                                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                                        <Calendar size={14} className="text-blue-500" /> {t.installmentsManager}
                                    </h4>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.contractPrice}</label>
                                            <div className="relative">
                                                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="number"
                                                    disabled={!canWrite}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 pl-12 pr-4 font-black text-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    value={totalAmount}
                                                    onChange={e => setTotalAmount(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.downPayment}</label>
                                                <input
                                                    type="number"
                                                    disabled={!canWrite}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 font-bold text-slate-800 dark:text-white outline-none"
                                                    min="0"
                                                    value={downPayment}
                                                    onChange={e => setDownPayment(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.termMonths}</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="360"
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 font-bold text-slate-800 dark:text-white outline-none"
                                                    value={months}
                                                    onChange={e => setMonths(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.firstDueDate}</label>
                                                <input type="date" disabled={!canWrite} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-3 font-bold text-slate-800 dark:text-white outline-none disabled:opacity-60" value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.graceDays}</label>
                                                <input type="number" min="0" max="365" disabled={!canWrite} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 font-bold text-slate-800 dark:text-white outline-none disabled:opacity-60" value={graceDays} onChange={e => setGraceDays(e.target.value)} />
                                            </div>
                                        </div>

                                        <p className="text-[10px] leading-relaxed text-slate-400">{t.scheduleWarning}</p>

                                        <button
                                            onClick={handleGenerate}
                                            disabled={loading || !canWrite}
                                            className="w-full bg-slate-800 dark:bg-blue-600 hover:bg-slate-700 dark:hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
                                        >
                                            {loading ? '...' : t.generateSchedule}
                                        </button>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t.remainingForSchedule}: {contractBalance.toLocaleString()} UZS</p>
                                    </div>
                                </div>

                                {/* Payment History */}
                                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                                            <History size={14} className="text-emerald-500" /> {t.recentPayments}
                                        </h4>
                                    </div>

                                    {/* Manual Add Form */}
                                    {canWrite && <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="number"
                                                placeholder={t.amount}
                                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                                value={manualAmount}
                                                onChange={e => setManualAmount(e.target.value)}
                                            />
                                            <input
                                                type="date"
                                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                                value={manualDate}
                                                onChange={e => setManualDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <input
                                                placeholder={t.paymentNote}
                                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                                value={manualNote}
                                                onChange={e => setManualNote(e.target.value)}
                                            />
                                            <button
                                                onClick={handleAddManualPayment}
                                                disabled={loading || !manualAmount || contractBalance <= 0}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                                            >
                                                {t.addPay}
                                            </button>
                                        </div>
                                    </div>}

                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {actualPayments.length === 0 ? (
                                            <p className="text-center py-8 text-slate-400 text-[10px] italic">No payments yet</p>
                                        ) : (
                                            actualPayments.map(p => (
                                                <div key={p.id} className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.date}</p>
                                                            <span className="text-[8px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-1.5 py-0.5 rounded-full font-black uppercase">{t.paid}</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-white">{p.note || 'Manual'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{p.amount.toLocaleString()} so'm</p>
                                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                            {canWrite && <button
                                                                onClick={() => setEditingPayment(p)}
                                                                className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>}
                                                            {canWrite && <button
                                                                onClick={() => handleDeletePayment(p.id)}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Plan Breakdown */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-blue-500" /> {t.planDetails}
                                    </h4>
                                    <div className="flex gap-3 text-[10px] font-black uppercase">
                                        <span className="text-blue-500">{t.scheduleTotal}: {ledger.scheduledTotal.toLocaleString()}</span>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-emerald-500">{t.paidAmount}: {ledger.appliedToSchedule.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        <option value="ALL">{t.allStatuses}</option>
                                        <option value="OVERDUE">{t.filterOverdue}</option>
                                        <option value="PARTIAL">{t.partial}</option>
                                        <option value="UPCOMING">{t.upcoming}</option>
                                        <option value="PAID">{t.paid}</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {visibleInstallments.map((row, idx) => (
                                        <div key={row.id} className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl transition-all ${row.status === 'OVERDUE' || (row.status === 'PARTIAL' && row.daysLate > 0) ? 'border-red-200 dark:border-red-900/60' : 'border-slate-200 dark:border-slate-800'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{t.installment} {ledger.installments.findIndex(item => item.id === row.id) + 1}/{ledger.installments.length}</span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${row.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : row.status === 'OVERDUE' || (row.status === 'PARTIAL' && row.daysLate > 0) ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : row.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                                                    {row.status === 'PAID' ? t.paid : row.status === 'OVERDUE' || (row.status === 'PARTIAL' && row.daysLate > 0) ? t.overdue : row.status === 'PARTIAL' ? t.partial : t.upcoming}
                                                </span>
                                            </div>
                                            <p className="text-lg font-black text-slate-800 dark:text-white">{row.amount.toLocaleString()} <span className="text-[10px]">UZS</span></p>
                                            <div className="mt-2 grid grid-cols-2 gap-y-1 text-[10px]">
                                                <span className="text-slate-400">{t.dueDate}</span><span className="text-right font-bold text-slate-700 dark:text-slate-300">{row.date.slice(0, 10)}</span>
                                                <span className="text-slate-400">{t.paidAmount}</span><span className="text-right font-bold text-emerald-600">{row.paidAmount.toLocaleString()}</span>
                                                <span className="text-slate-400">{t.remaining}</span><span className="text-right font-black text-slate-800 dark:text-white">{row.remainingAmount.toLocaleString()}</span>
                                            </div>
                                            {row.daysLate > 0 && <p className="mt-2 text-[10px] font-bold text-red-600">{row.daysLate} {t.daysLate}</p>}
                                            {canWrite && nextUnpaidInstallment?.id === row.id && <button onClick={() => handleMarkAsPaid(row.id)} disabled={loading} className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:opacity-50">{t.markAsPaid}</button>}
                                        </div>
                                    ))}
                                    {visibleInstallments.length === 0 && (
                                        <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
                                            <p className="text-slate-400 text-xs font-medium">{t.noSchedule}</p>
                                        </div>
                                    )}
                                </div>

                                {(selectedApt.payments || []).some(payment => payment.status === 'CANCELLED') && <details className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                                    <summary className="cursor-pointer text-xs font-bold text-slate-500">{t.scheduleHistory}</summary>
                                    <div className="mt-3 space-y-2">
                                        {(selectedApt.payments || []).filter(payment => payment.status === 'CANCELLED').sort((a, b) => String(a.date).localeCompare(String(b.date))).map(payment => <div key={payment.id} className="flex items-center justify-between text-xs text-slate-400"><span>{payment.date.slice(0, 10)} · {payment.note}</span><span>{payment.amount.toLocaleString()} UZS · {t.cancelled}</span></div>)}
                                    </div>
                                </details>}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingPayment && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-sm">Edit Payment</h3>
                            <button onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.amount}</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 font-bold text-slate-800 dark:text-white"
                                    value={editingPayment.amount}
                                    onChange={e => setEditingPayment({ ...editingPayment, amount: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.date}</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 font-bold text-slate-800 dark:text-white"
                                    value={editingPayment.date ? (typeof editingPayment.date === 'string' ? editingPayment.date.split('T')[0] : new Date(editingPayment.date).toISOString().split('T')[0]) : ''}
                                    onChange={e => setEditingPayment({ ...editingPayment, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note</label>
                                <input
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 font-bold text-slate-800 dark:text-white"
                                    value={editingPayment.note || ''}
                                    onChange={e => setEditingPayment({ ...editingPayment, note: e.target.value })}
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setEditingPayment(null)}
                                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl transition-all"
                                >
                                    {t.cancel}
                                </button>
                                <button
                                    onClick={handleUpdatePayment}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs"
                                >
                                    {t.save}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
