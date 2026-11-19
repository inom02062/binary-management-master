import React, { useState, useMemo } from 'react';
import { User } from 'lucide-react';
import { Apartment, ApartmentStatus } from '../types';

export const SearchComponent: React.FC<{ t: any, allApartments: Apartment[], onSelectApt: (a: Apartment) => void }> = ({ t, allApartments, onSelectApt }) => {
    const [q, setQ] = useState('');
    const results = useMemo(() => {
        if (q.length < 1) return []; // Changed to 1 char minimum
        const low = q.toLowerCase();
        return allApartments.filter(a =>
            (a.tenantName?.toLowerCase().includes(low) ||
                a.tenantSurname?.toLowerCase().includes(low) ||
                a.number.toString().includes(low)) && // Added search by number
            a.status !== ApartmentStatus.EMPTY
        );
    }, [q, allApartments]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <input autoFocus placeholder={t.searchPlaceholder} className="w-full px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all" value={q} onChange={e => setQ(e.target.value)} />
            <div className="space-y-3">
                {results.map(a => (
                    <button key={a.id} onClick={() => onSelectApt(a)} className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-blue-500 transition-all text-left">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><User size={20} /></div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">{a.tenantName} {a.tenantSurname}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Apt {a.number} • Floor {a.floor}</p>
                            </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${a.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>{a.status}</span>
                    </button>
                ))}
                {q.length > 0 && results.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">No results found for "{q}"</p>
                )}
            </div>
        </div>
    );
};
