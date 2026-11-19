import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, History } from 'lucide-react';
import { api } from '../services/api';

export const PaymentsList: React.FC<{ t: any }> = ({ t }) => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');

    useEffect(() => {
        (async () => {
            const data = await api.getPayments();
            setPayments(data);
            setLoading(false);
        })();
    }, []);

    const filtered = useMemo(() => {
        if (!q.trim()) return payments;
        const low = q.toLowerCase();
        return payments.filter(p =>
            p.apartment?.tenantName?.toLowerCase().includes(low) ||
            p.apartment?.tenantSurname?.toLowerCase().includes(low) ||
            p.apartment?.number?.toString().includes(low) ||
            p.apartment?.block?.name?.toLowerCase().includes(low)
        );
    }, [q, payments]);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                    placeholder={t.searchPayments}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-6 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all shadow-sm"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.date}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.tenant}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.apartments}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">{t.amount}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtered.map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{new Date(p.date).toLocaleDateString()}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                            {p.apartment?.tenantName?.[0]}{p.apartment?.tenantSurname?.[0]}
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{p.apartment?.tenantName} {p.apartment?.tenantSurname}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.apartment?.block?.name} • Apt {p.apartment?.number}</p>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{t.floors} {p.apartment?.floor}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{p.amount.toLocaleString()} so'm</p>
                                    {p.note && <p className="text-[10px] text-slate-400 truncate max-w-[120px] ml-auto">{p.note}</p>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="p-12 text-center">
                        <History className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-400">No payments found</p>
                    </div>
                )}
            </div>
        </div>
    );
};
