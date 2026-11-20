import { AlertCircle, Banknote, Building, ChevronRight, Grid, Maximize2, Minimize2, PieChart, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Apartment, ApartmentStatus, Block, Language, ViewState } from '../types';
import { MapCanvas } from './MapCanvas';

export const Dashboard: React.FC<{ blocks: Block[], apartments: Apartment[], lang: Language, t: any, onNavigate: (view: ViewState) => void, onRefresh: () => Promise<void>, canWrite?: boolean }> = ({ blocks, apartments, lang, t, onNavigate, onRefresh, canWrite = true }) => {
    const [mapExpansion, setMapExpansion] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
    const isMapExpanded = mapExpansion !== 'closed';
    const stats = useMemo(() => {
        const total = apartments.length;
        if (total === 0) return { total: 0, occupied: 0, empty: 0, late: 0, occupancyRate: 0, totalRevenue: 0 };
        const empty = apartments.filter(a => a.status === ApartmentStatus.EMPTY).length;
        const late = apartments.filter(a => a.status === ApartmentStatus.LATE).length;
        const occupied = total - empty;

        const totalRevenue = apartments.reduce((sum, apt) => {
            return sum + (apt.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        return { total, occupied, empty, late, occupancyRate: Math.round((occupied / total) * 100), totalRevenue };
    }, [apartments]);

    useEffect(() => {
        if (mapExpansion === 'opening') {
            const frame = requestAnimationFrame(() => {
                setMapExpansion(current => current === 'opening' ? 'open' : current);
            });
            return () => cancelAnimationFrame(frame);
        }
        if (mapExpansion === 'closing') {
            const timeout = window.setTimeout(() => setMapExpansion('closed'), 300);
            return () => window.clearTimeout(timeout);
        }
    }, [mapExpansion]);

    useEffect(() => {
        if (!isMapExpanded) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMapExpansion('closing');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMapExpanded]);

    const mapExpandLabel = isMapExpanded
        ? (lang === 'uz' ? 'Kichraytirish' : lang === 'ru' ? 'Свернуть карту' : 'Shrink map')
        : (lang === 'uz' ? 'Kattalashtirish' : lang === 'ru' ? 'Развернуть карту' : 'Expand map');

    return (
        <div className="dashboard-mobile space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="max-w-xl mx-auto">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <button
                        onClick={() => onNavigate({ type: 'SEARCH' })}
                        className="w-full border border-slate-200 bg-white/80 py-3.5 pl-12 pr-6 text-left text-sm font-medium text-slate-500 shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-slate-900"
                    >
                        {t.searchPlaceholder}
                    </button>
                </div>
            </div>

            <div className="dashboard-stats grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: t.totalApts, val: stats.total, icon: Building, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800/80', accent: 'from-slate-500 to-slate-600' },
                    { label: t.occupancyRate, val: `${stats.occupancyRate}%`, icon: PieChart, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', accent: 'from-emerald-500 to-emerald-600', progress: stats.occupancyRate },
                    { label: "Jami tushum", val: `${stats.totalRevenue.toLocaleString()} so'm`, icon: Banknote, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', accent: 'from-blue-500 to-blue-600' },
                    { label: t.debtors, val: stats.late, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', accent: 'from-red-500 to-red-600' }
                ].map((s, i) => (
                    <div key={i} className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-5 shadow-[0_15px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(30,64,175,0.08)] dark:border-slate-800 dark:bg-slate-900/85">
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{s.label}</span>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${s.accent} ${s.color}`}>
                                <s.icon className="h-4 w-4 text-white" />
                            </div>
                        </div>
                        <p className={`text-2xl font-black tracking-tight ${s.label === t.debtors && stats.late > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{s.val}</p>
                        {s.progress !== undefined && (
                            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000" style={{ width: `${s.progress}%` }}></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="dashboard-map-grid grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className={`${isMapExpanded ? `fixed inset-6 z-[120] flex origin-center flex-col transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:inset-8 lg:inset-12 ${mapExpansion === 'open' ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'}` : 'lg:col-span-2'} overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-[0_20px_70px_rgba(15,23,42,0.2)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95`}>
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                            <Grid size={14} className="text-blue-500" />
                            {t.map}
                        </h2>
                        <div className="flex items-center gap-2">
                            {canWrite && <button onClick={() => onNavigate({ type: 'MAP_EDITOR' })} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">Edit Plan</button>}
                            <button
                                type="button"
                                onClick={() => setMapExpansion(current => current === 'closed' ? 'opening' : 'closing')}
                                title={mapExpandLabel}
                                aria-label={mapExpandLabel}
                                aria-pressed={isMapExpanded}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
                            >
                                {isMapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className={`relative ${isMapExpanded ? 'min-h-0 flex-1' : 'h-[430px]'} bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950`}>
                        <MapCanvas blocks={blocks} setBlocks={() => {}} apartments={apartments} onRefresh={onRefresh} isReadOnly={true} onBlockClick={(id) => onNavigate({ type: 'BLOCK_DETAILS', blockId: id })} lang={lang} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">{t.blocks}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{blocks.length}</span>
                    </div>
                    <div className="space-y-3 overflow-y-auto pr-1 max-h-[380px] custom-scrollbar">
                        {blocks.map(block => (
                            <button
                                key={block.id}
                                onClick={() => onNavigate({ type: 'BLOCK_DETAILS', blockId: block.id })}
                                className="group flex w-full items-center gap-4 rounded-[1.2rem] border border-slate-200 bg-white/85 p-4 text-left shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-[0_18px_30px_rgba(59,130,246,0.08)] dark:border-slate-800 dark:bg-slate-900/85 dark:hover:border-blue-500/40 dark:hover:bg-slate-900"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black text-white shadow-inner" style={{ background: `linear-gradient(135deg, ${block.color}, ${block.color}dd)` }}>
                                    {block.name.substring(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="truncate text-sm font-bold text-slate-800 dark:text-white">{block.name}</h4>
                                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{block.floorsCount}F • {block.aptsPerFloor * block.floorsCount} Units</p>
                                </div>
                                <ChevronRight size={14} className="text-slate-300 transition group-hover:text-blue-500" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
