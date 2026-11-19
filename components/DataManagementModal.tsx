import { CheckCircle2, CircleHelp, Database, Download, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { TRANSLATIONS } from '../constants';
import { api } from '../services/api';
import * as sync from '../services/sync';
import { Language } from '../types';

export const DataManagementModal: React.FC<{ onClose: () => void, lang: Language, onImport: () => void, canExport: boolean, canImport: boolean, canReset: boolean, onGuide?: () => void }> = ({ onClose, lang, onImport, canExport, canImport, canReset, onGuide }) => {
    const t = TRANSLATIONS[lang];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [migrating, setMigrating] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [localCounts, setLocalCounts] = useState<{ blocks: number; apartments: number }>({ blocks: 0, apartments: 0 });
    const [serverCounts, setServerCounts] = useState<{ blocks: number; apartments: number }>({ blocks: 0, apartments: 0 });
    const [hasLocal, setHasLocal] = useState(false);
    const [pending, setPending] = useState(0);
    const [serverAvailable, setServerAvailable] = useState(false);

    useEffect(() => {
        // Check localStorage and server counts
        try {
            import('../services/migrator').then(m => {
                setHasLocal(m.hasLocalData());
                setLocalCounts(m.getLocalCounts());
            });
            (async () => {
                try {
                    const b = await api.getBlocks();
                    const a = await api.getApartments();
                    setServerCounts({ blocks: b.length, apartments: a.length });
                    setPending(sync.getPendingCount());
                    setServerAvailable(true);
                } catch (e) {
                    setServerCounts({ blocks: 0, apartments: 0 });
                    setServerAvailable(false);
                }
            })();
        } catch (e) { /* ignore */ }
    }, []);

    const handleExportExcel = async () => {
        setStatus('loading');
        try {
            const blocks = await api.getBlocks();
            const apartments = await api.getApartments();

            const data = apartments.map(apt => {
                const block = blocks.find(b => b.id === apt.blockId);
                return {
                    'Block Name': block?.name || 'N/A',
                    'Floor': apt.floor,
                    'Apt Number': apt.number,
                    'Status': apt.status,
                    'Tenant Name': apt.tenantName || '',
                    'Tenant Surname': apt.tenantSurname || '',
                    'Contract Price': apt.totalAmount || 0,
                    'Down Payment': apt.downPayment || 0,
                    'Term (Months)': apt.installmentMonths || 0,
                    'First Due Date': apt.firstDueDate || '',
                    'Total Paid': (apt.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').reduce((sum, p) => sum + p.amount, 0),
                    'Last Payment': apt.payments?.filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').length ? new Date(Math.max(...apt.payments.filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').map(p => new Date(p.date).getTime()))).toLocaleDateString() : 'N/A'
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Apartments');

            XLSX.writeFile(workbook, `report_${new Date().toISOString().split('T')[0]}.xlsx`);
            setStatus('success');
        } catch (e) {
            console.error('Excel export failed', e);
            setStatus('error');
        }
        setTimeout(() => setStatus('idle'), 2000);
    };

    const handleExport = async () => {
        setStatus('loading');
        const json = await api.exportDb();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStatus('loading');
        const reader = new FileReader();
        reader.onload = async (event) => {
            const success = await api.importDb(event.target?.result as string);
            if (success) {
                onImport();
                setStatus('success');
                setTimeout(onClose, 800);
            } else {
                setStatus('error');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        {t.settings}
                    </h3>
                    <div className="flex items-center gap-1">
                        {onGuide && <button type="button" onClick={onGuide} title={lang === 'uz' ? 'Sozlamalar instruksiyasi' : lang === 'ru' ? 'Инструкция по настройкам' : 'Settings instructions'} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"><CircleHelp size={17} /></button>}
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-light">&times;</button>
                    </div>
                </div>

                {/* DB Status Badge */}
                <div className="mb-6 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Database Link</span>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${serverAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`}></span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-400">{serverAvailable ? 'SERVER (SQLite)' : 'OFFLINE (LocalStorage)'}</span>
                    </div>
                </div>

                {canReset && (
                    <button
                        type="button"
                        disabled={migrating === 'loading'}
                        onClick={async () => {
                            if (!window.confirm(t.clearCompanyConfirm)) return;
                            setMigrating('loading');
                            try {
                                const success = await api.clearDb();
                                if (!success) throw new Error(t.error);
                                setHasLocal(false);
                                setLocalCounts({ blocks: 0, apartments: 0 });
                                setServerCounts({ blocks: 0, apartments: 0 });
                                setPending(sync.getPendingCount());
                                onImport();
                                setMigrating('success');
                            } catch (error) {
                                setMigrating('error');
                                alert(`${t.error}: ${error instanceof Error ? error.message : String(error)}`);
                            }
                        }}
                        className="mb-4 flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                        <div className="text-left">
                            <p className="text-xs font-bold">{t.clearCompany}</p>
                            <p className="mt-1 text-[10px] opacity-70">
                                {lang === 'uz'
                                    ? 'Faqat shu kompaniyaning binolari, xonadonlari va to‘lovlari'
                                    : lang === 'ru'
                                        ? 'Удаляются только здания, квартиры и платежи этой компании'
                                        : 'Deletes only this company’s buildings, apartments, and payments'}
                            </p>
                        </div>
                        {migrating === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={18} />}
                    </button>
                )}

                <div className="space-y-4">
                    {canImport && <div className="mb-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">{hasLocal ? `${t.import}:` : t.importDesc}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-3">
                            <div>{t.localLabel}: <span className="font-black text-slate-700">{localCounts.blocks} {t.blocks}, {localCounts.apartments} {t.apartments}</span></div>
                            <div>{t.serverLabel}: <span className="font-black text-slate-700">{serverCounts.blocks} {t.blocks}, {serverCounts.apartments} {t.apartments}</span></div>
                        </div>
                        {hasLocal ? (
                            <div className="flex gap-2">
                                <button disabled={migrating === 'loading'} onClick={async () => {
                                    setMigrating('loading');
                                    try {
                                        const m = await import('../services/migrator');
                                        const res = await m.migrateLocalToServer();
                                        if (res.migrated) {
                                            setMigrating('success'); setHasLocal(false); setLocalCounts({ blocks: 0, apartments: 0 }); onImport(); alert(t.migrateSuccess);
                                        } else {
                                            setMigrating('error');
                                            // Map known messages to user-friendly translations
                                            if (res.message === 'pending_flush_failed') alert(t.pendingFlushFailed);
                                            else if (res.message === 'import_failed') alert(t.importFailed);
                                            else alert(t.migrateError + ': ' + (res.message || ''));
                                        }
                                    } catch (e) {
                                        setMigrating('error');
                                        alert(t.migrateError + ': ' + String(e));
                                    }
                                    setTimeout(() => setMigrating('idle'), 2000);
                                }} className="flex-1 p-3 bg-blue-500 text-white rounded-xl font-black text-xs uppercase">{t.migrateLocal}</button>
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-400">{t.noLocalData}</p>
                        )}
                        <div className="mt-3 text-[10px] text-slate-500">Pending ops: <span className="font-black text-red-600">{pending}</span> <button onClick={async () => { setPending(await (async () => { const r = await sync.flushPending(); await onImport(); return sync.getPendingCount(); })()); }} className="ml-2 text-xs font-black text-blue-500">Sync now</button></div>
                    </div>}
                    {canExport && <button
                        disabled={status === 'loading'}
                        onClick={handleExportExcel}
                        className="w-full flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors border border-emerald-100 dark:border-emerald-900/20 group disabled:opacity-50"
                    >
                        <div className="text-left">
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{t.exportExcel}</p>
                            <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">{t.exportExcelDesc}</p>
                        </div>
                        {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <FileSpreadsheet size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" />}
                    </button>}

                    {canExport && <button
                        disabled={status === 'loading'}
                        onClick={handleExport}
                        className="w-full flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-100 dark:border-slate-800 group disabled:opacity-50"
                    >
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.export}</p>
                            <p className="text-[10px] text-slate-400">{t.exportDesc}</p>
                        </div>
                        {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Download size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />}
                    </button>}

                    {canImport && <button
                        disabled={status === 'loading'}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors border border-red-100 dark:border-red-900/20 group disabled:opacity-50"
                    >
                        <div className="text-left">
                            <p className="text-xs font-bold text-red-700 dark:text-red-400">{t.import}</p>
                            <p className="text-[10px] text-red-600/60 dark:text-red-400/60">{t.importDesc}</p>
                        </div>
                        <Upload size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                    </button>}

                    {status === 'success' && (
                        <div className="flex items-center justify-center gap-2 text-emerald-500 animate-in zoom-in-95">
                            <CheckCircle2 size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t.success}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
