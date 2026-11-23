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

    const copy = {
        en: {
            eyebrow: 'PROPERTY OVERVIEW',
            heading: 'Your portfolio at a glance',
            description: 'Buildings, apartments and payments — all in one place.',
            revenue: 'Total revenue',
            currency: 'UZS',
            buildingSummary: (count: string) => `Buildings: ${count}`,
            editPlan: 'Edit plan',
            emptyBuildings: 'No buildings yet',
            emptyHint: 'Your properties will appear here once they are added.',
            floorUnits: (floors: number, units: number) => `${floors} floors · ${units} units`,
        },
        ru: {
            eyebrow: 'ОБЗОР НЕДВИЖИМОСТИ',
            heading: 'Портфель под контролем',
            description: 'Здания, квартиры и платежи — в одном месте.',
            revenue: 'Общий доход',
            currency: 'сум',
            buildingSummary: (count: string) => `Объектов: ${count}`,
            editPlan: 'Изменить план',
            emptyBuildings: 'Пока нет зданий',
            emptyHint: 'Добавленные объекты появятся здесь.',
            floorUnits: (floors: number, units: number) => `${floors} этажей · ${units} квартир`,
        },
        uz: {
            eyebrow: 'KO‘CHMAS MULK SHARHI',
            heading: 'Portfelingiz bir qarashda',
            description: 'Binolar, xonadonlar va to‘lovlar — barchasi bir joyda.',
            revenue: 'Jami tushum',
            currency: 'so‘m',
            buildingSummary: (count: string) => `Binolar: ${count}`,
            editPlan: 'Rejani tahrirlash',
            emptyBuildings: 'Hozircha binolar yo‘q',
            emptyHint: 'Qo‘shilgan binolar shu yerda ko‘rinadi.',
            floorUnits: (floors: number, units: number) => `${floors} qavat · ${units} xonadon`,
        },
    }[lang];
    const numberLocale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';
    const mapExpandLabel = isMapExpanded
        ? (lang === 'uz' ? 'Kichraytirish' : lang === 'ru' ? 'Свернуть карту' : 'Shrink map')
        : (lang === 'uz' ? 'Kattalashtirish' : lang === 'ru' ? 'Развернуть карту' : 'Expand map');

    const statCards = [
        {
            key: 'apartments',
            label: t.totalApts,
            value: stats.total.toLocaleString(numberLocale),
            detail: copy.buildingSummary(blocks.length.toLocaleString(numberLocale)),
            icon: Building,
            color: 'blue',
        },
        {
            key: 'occupancy',
            label: t.occupancyRate,
            value: `${stats.occupancyRate}%`,
            detail: `${stats.occupied.toLocaleString(numberLocale)} / ${stats.total.toLocaleString(numberLocale)} ${lang === 'uz' ? 'band' : lang === 'ru' ? 'занято' : 'occupied'}`,
            icon: PieChart,
            color: 'green',
            progress: stats.occupancyRate,
        },
        {
            key: 'revenue',
            label: copy.revenue,
            value: `${stats.totalRevenue.toLocaleString(numberLocale)} ${copy.currency}`,
            detail: lang === 'uz' ? 'Qabul qilingan to‘lovlar' : lang === 'ru' ? 'Полученные платежи' : 'Payments received',
            icon: Banknote,
            color: 'violet',
        },
        {
            key: 'debtors',
            label: t.debtors,
            value: stats.late.toLocaleString(numberLocale),
            detail: lang === 'uz' ? 'E’tibor talab qiladi' : lang === 'ru' ? 'Требуют внимания' : 'Need attention',
            icon: AlertCircle,
            color: 'orange',
            alert: stats.late > 0,
        },
    ];

    return (
        <div className="dashboard-mobile space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <section className="dashboard-intro">
                <span className="dashboard-eyebrow"><span aria-hidden="true" />{copy.eyebrow}</span>
                <h2>{copy.heading}</h2>
                <p>{copy.description}</p>
            </section>

            <div className="dashboard-search">
                <button
                    type="button"
                    onClick={() => onNavigate({ type: 'SEARCH' })}
                    aria-label={t.searchPlaceholder}
                >
                    <Search aria-hidden="true" size={19} />
                    <span>{t.searchPlaceholder}</span>
                    <ChevronRight aria-hidden="true" size={17} />
                </button>
            </div>

            <section className="dashboard-stats grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={copy.eyebrow}>
                {statCards.map(stat => (
                    <article key={stat.key} className={`dashboard-stat-card dashboard-stat-${stat.color}`}>
                        <div className="dashboard-stat-top">
                            <span className="dashboard-stat-label">{stat.label}</span>
                            <span className="dashboard-stat-icon"><stat.icon aria-hidden="true" size={18} /></span>
                        </div>
                        <p className={`dashboard-stat-value ${stat.alert ? 'dashboard-stat-alert' : ''}`}>{stat.value}</p>
                        <span className="dashboard-stat-detail">{stat.detail}</span>
                        {stat.progress !== undefined && (
                            <div
                                className="dashboard-progress"
                                role="progressbar"
                                aria-label={stat.label}
                                aria-valuenow={stat.progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <span style={{ width: `${stat.progress}%` }} />
                            </div>
                        )}
                    </article>
                ))}
            </section>

            <div className="dashboard-map-grid grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className={`${isMapExpanded ? `fixed inset-3 z-[120] flex origin-center flex-col transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:inset-6 lg:inset-12 ${mapExpansion === 'open' ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'}` : 'lg:col-span-2'} dashboard-surface dashboard-map-card`}>
                    <div className="dashboard-map-heading">
                        <div className="dashboard-section-title">
                            <span className="dashboard-section-icon"><Grid aria-hidden="true" size={17} /></span>
                            <div>
                                <h3>{t.map}</h3>
                                <p>{lang === 'uz' ? 'Bino joylashuvi va reja' : lang === 'ru' ? 'Расположение и план зданий' : 'Building locations and layout'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {canWrite && (
                                <button type="button" onClick={() => onNavigate({ type: 'MAP_EDITOR' })} className="dashboard-edit-button">
                                    {copy.editPlan}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setMapExpansion(current => current === 'closed' ? 'opening' : 'closing')}
                                title={mapExpandLabel}
                                aria-label={mapExpandLabel}
                                aria-pressed={isMapExpanded}
                                className="dashboard-expand-button"
                            >
                                {isMapExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                            </button>
                        </div>
                    </div>
                    <div className={`dashboard-map-viewport ${isMapExpanded ? 'min-h-0 flex-1' : ''}`}>
                        <MapCanvas blocks={blocks} setBlocks={() => {}} apartments={apartments} onRefresh={onRefresh} isReadOnly={true} onBlockClick={(id) => onNavigate({ type: 'BLOCK_DETAILS', blockId: id })} lang={lang} />
                    </div>
                </section>

                <section className="dashboard-buildings">
                    <div className="dashboard-buildings-heading">
                        <div>
                            <h3>{t.blocks}</h3>
                            <p>{lang === 'uz' ? 'Boshqaruvdagi obyektlar' : lang === 'ru' ? 'Объекты под управлением' : 'Properties you manage'}</p>
                        </div>
                        <span className="dashboard-count">{blocks.length.toLocaleString(numberLocale)}</span>
                    </div>
                    <div className="dashboard-building-list">
                        {blocks.length > 0 ? blocks.map(block => (
                            <button
                                key={block.id}
                                type="button"
                                onClick={() => onNavigate({ type: 'BLOCK_DETAILS', blockId: block.id })}
                                className="dashboard-building-row"
                            >
                                <span className="dashboard-building-icon" style={{ backgroundColor: block.color || '#2563eb' }}>
                                    {block.name.substring(0, 1).toUpperCase()}
                                </span>
                                <span className="dashboard-building-copy">
                                    <span className="dashboard-building-name">{block.name}</span>
                                    <span className="dashboard-building-meta">{copy.floorUnits(block.floorsCount, block.aptsPerFloor * block.floorsCount)}</span>
                                </span>
                                <ChevronRight aria-hidden="true" size={17} />
                            </button>
                        )) : (
                            <div className="dashboard-empty-buildings">
                                <span className="dashboard-building-icon"><Building aria-hidden="true" size={19} /></span>
                                <strong>{copy.emptyBuildings}</strong>
                                <p>{copy.emptyHint}</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
