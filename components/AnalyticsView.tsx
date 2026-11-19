import { Calendar, ChevronRight, DollarSign, Search, TrendingUp, User, Users } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { Apartment, Block } from '../types';

type TimeInterval = 'day' | 'week' | 'month' | 'year';

interface ChartPoint {
    label: string;
    value: number;
    fullDate: Date;
}

interface AnalyticsViewProps {
    blocks: Block[];
    apartments: Apartment[];
    t: any;
    onSelectApt: (apt: Apartment) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ blocks, apartments, t, onSelectApt }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewInterval, setViewInterval] = useState<TimeInterval>('month');
    const [offset, setOffset] = useState(0);
    const dateInputRef = useRef<HTMLInputElement>(null);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = new Date(e.target.value);
        if (isNaN(selectedDate.getTime())) return;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        let newOffset = 0;
        if (viewInterval === 'day') {
            const diffTime = now.getTime() - selectedDate.getTime();
            newOffset = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        } else if (viewInterval === 'week') {
            const diffTime = now.getTime() - selectedDate.getTime();
            newOffset = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        } else if (viewInterval === 'month') {
            newOffset = (now.getFullYear() - selectedDate.getFullYear()) * 12 + (now.getMonth() - selectedDate.getMonth());
        } else if (viewInterval === 'year') {
            newOffset = now.getFullYear() - selectedDate.getFullYear();
        }

        setOffset(newOffset);
    };

    const [showPrediction, setShowPrediction] = useState(false);
    const [predictionWindow, setPredictionWindow] = useState(3);

    const chartData = useMemo(() => {
        const now = new Date();
        const points: ChartPoint[] = [];

        // Number of points to show per view
        const config = {
            day: { count: 14, step: 1, futurePadding: 3 },
            week: { count: 12, step: 1, futurePadding: 2 },
            month: { count: 10, step: 1, futurePadding: 2 },
            year: { count: 6, step: 1, futurePadding: 1 }
        }[viewInterval];

        for (let i = config.count - 1; i >= 0; i--) {
            let date = new Date(now);
            let label = '';

            // shift determines the window position.
            const shift = offset * config.step;

            // i=config.futurePadding should be TODAY when offset=0
            const dateOffset = i - config.futurePadding + shift;

            if (viewInterval === 'day') {
                date.setDate(date.getDate() - dateOffset);
                label = date.toLocaleDateString('default', { day: '2-digit', month: 'short' });
            } else if (viewInterval === 'week') {
                date.setDate(date.getDate() - (dateOffset * 7));
                label = `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('default', { month: 'short' })}`;
            } else if (viewInterval === 'month') {
                date = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
                label = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            } else if (viewInterval === 'year') {
                date = new Date(now.getFullYear() - dateOffset, 0, 1);
                label = date.getFullYear().toString();
            }

            let value = 0;
            apartments.forEach(apt => {
                (apt.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').forEach(p => {
                    const pDate = new Date(p.date);
                    let isMatch = false;

                    if (viewInterval === 'day') {
                        isMatch = pDate.toDateString() === date.toDateString();
                    } else if (viewInterval === 'week') {
                        const start = new Date(date);
                        start.setDate(date.getDate() - date.getDay()); // Sunday
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6); // Saturday
                        isMatch = pDate >= start && pDate <= end;
                    } else if (viewInterval === 'month') {
                        isMatch = pDate.getMonth() === date.getMonth() && pDate.getFullYear() === date.getFullYear();
                    } else if (viewInterval === 'year') {
                        isMatch = pDate.getFullYear() === date.getFullYear();
                    }

                    if (isMatch) value += p.amount;
                });
            });

            points.push({ label, value, fullDate: date });
        }

        return points;
    }, [apartments, viewInterval, offset]);

    const stats = useMemo(() => {
        const totalApts = apartments.length;
        const occupied = apartments.filter(a => a.status !== 'EMPTY').length;
        const occupancyRate = totalApts > 0 ? (occupied / totalApts) * 100 : 0;

        let totalRevenue = 0;
        const tenantData: Record<string, { name: string, surname: string, total: number, lastPayment: string, apartment: Apartment }> = {};
        const paymentsByMonth: Record<string, number> = {};

        apartments.forEach(apt => {
            (apt.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').forEach(p => {
                totalRevenue += p.amount;

                // Monthly stats
                const month = new Date(p.date).toLocaleString('default', { month: 'short', year: '2-digit' });
                paymentsByMonth[month] = (paymentsByMonth[month] || 0) + p.amount;

                // Tenant stats
                if (apt.tenantName || apt.tenantSurname) {
                    const key = `${apt.tenantName}-${apt.tenantSurname}`;
                    if (!tenantData[key]) {
                        tenantData[key] = {
                            name: apt.tenantName || '',
                            surname: apt.tenantSurname || '',
                            total: 0,
                            lastPayment: '',
                            apartment: apt
                        };
                    }
                    tenantData[key].total += p.amount;
                    if (!tenantData[key].lastPayment || new Date(p.date) > new Date(tenantData[key].lastPayment)) {
                        tenantData[key].lastPayment = p.date;
                    }
                }
            });
        });

        const sortedTenants = Object.values(tenantData)
            .filter(tenant =>
                tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tenant.surname.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => b.total - a.total);

        const monthlyRevenue = Object.entries(paymentsByMonth)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .slice(-6);

        return {
            totalApts,
            occupied,
            occupancyRate,
            totalRevenue,
            sortedTenants,
            monthlyRevenue
        };
    }, [apartments, searchQuery]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.totalRevenue}</p>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">{stats.totalRevenue.toLocaleString()} UZS</h3>
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.occupied}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white">{stats.occupied} / {stats.totalApts}</h3>
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.occupancyRate}%` }}></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.occupancyRate}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white">{stats.occupancyRate.toFixed(1)}%</h3>
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${stats.occupancyRate}%` }}></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.recentPayments}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white">{stats.monthlyRevenue.length} mos</h3>
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '70%' }}></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Advanced Line Chart */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    {/* Background Decorative Gradient */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
                        <div className="flex items-center gap-6">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">{t.revenueAnalysis || 'Revenue Analysis'}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interactive Cashflow Tracking</p>
                            </div>

                            {showPrediction && (
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Vaqt Oralig'i</span>
                                        <span className="text-[10px] font-black text-blue-500">{predictionWindow} {viewInterval}{predictionWindow > 1 ? 's' : ''}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={predictionWindow}
                                        onChange={(e) => setPredictionWindow(parseInt(e.target.value))}
                                        className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Navigation Buttons */}
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setOffset(o => o + 1)}
                                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-400 hover:text-blue-500 active:scale-95"
                                    title="Back"
                                >
                                    <ChevronRight className="rotate-180" size={18} />
                                </button>
                                <button
                                    onClick={() => dateInputRef.current?.showPicker()}
                                    className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors relative"
                                >
                                    Today
                                    <input
                                        type="date"
                                        ref={dateInputRef}
                                        className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                                        onChange={handleDateChange}
                                    />
                                </button>
                                <button
                                    onClick={() => setOffset(o => o - 1)}
                                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-400 hover:text-blue-500 active:scale-95"
                                    title="Forward"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            {/* Interval Selector */}
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                                {(['day', 'week', 'month', 'year'] as const).map((int) => (
                                    <button
                                        key={int}
                                        onClick={() => { setViewInterval(int); setOffset(0); }}
                                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${viewInterval === int
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        {int}
                                    </button>
                                ))}
                            </div>

                            {/* Prediction Toggle */}
                            <button
                                onClick={() => setShowPrediction(!showPrediction)}
                                className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all border flex items-center gap-2 active:scale-95 ${showPrediction
                                    ? 'bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/20'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${showPrediction ? 'bg-white animate-pulse' : 'bg-rose-500'}`}></div>
                                {showPrediction ? 'Tahmin: ON' : 'Tahmin'}
                            </button>
                        </div>
                    </div>

                    <div className="h-[300px] w-full relative">
                        <PremiumLineChart data={chartData} t={t} showPrediction={showPrediction} predictionWindow={predictionWindow} />
                    </div>
                </div>

                {/* Top Tenants List */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight whitespace-nowrap">{t.tenantStats}</h4>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder={t.search}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium dark:text-white"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {stats.sortedTenants.map((tenant, i) => (
                            <div key={i} onClick={() => onSelectApt(tenant.apartment)} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group cursor-pointer active:scale-[0.98]">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors shadow-sm">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-800 dark:text-white">{tenant.name} {tenant.surname}</h5>
                                        <p className="text-[10px] text-slate-400 font-medium">Last: {new Date(tenant.lastPayment).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{tenant.total.toLocaleString()} UZS</p>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Lifetime Total</p>
                                </div>
                            </div>
                        ))}
                        {stats.sortedTenants.length === 0 && (
                            <div className="text-center py-20 opacity-50">
                                <p className="text-sm font-medium">No tenants found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PremiumLineChart: React.FC<{ data: ChartPoint[], t: any, showPrediction?: boolean, predictionWindow?: number }> = ({ data, t, showPrediction, predictionWindow = 3 }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Safety check for empty data
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs">
                No data available for this period
            </div>
        );
    }

    const maxVal = Math.max(...data.map(p => p.value), 1000); // Default min max for empty/low data
    const avgVal = data.reduce((acc, curr) => acc + curr.value, 0) / data.length;

    const width = 1000;
    const height = 300;
    const padding = 40;

    const getX = (index: number) => {
        if (data.length <= 1) return width / 2;
        // Adjust width to leave room for prediction if active
        const effectiveWidth = showPrediction ? width - padding * 4 : width - padding * 2;
        return padding + (index * effectiveWidth) / (data.length - 1);
    };

    const getY = (value: number) => height - padding - (value * (height - 2 * padding)) / Math.max(maxVal, 1);

    // Smooth Bezier path for ACTUAL data
    const bezierPath = data.reduce((acc, p, i, arr) => {
        if (i === 0) return `M ${getX(i)},${getY(p.value)}`;
        if (data.length === 1) return `M ${getX(i) - 10},${getY(p.value)} L ${getX(i) + 10},${getY(p.value)}`;

        const prevX = getX(i - 1);
        const prevY = getY(arr[i - 1].value);
        const currX = getX(i);
        const currY = getY(p.value);
        const cp1x = prevX + (currX - prevX) / 2;
        const cp2x = prevX + (currX - prevX) / 2;
        return `${acc} C ${cp1x},${prevY} ${cp2x},${currY} ${currX},${currY}`;
    }, "");

    const areaPath = data.length > 1
        ? `${bezierPath} L ${getX(data.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`
        : "";

    // PREDICTION LOGIC (Advanced)
    let predictionPath = "";
    let predictionIndicator: { trend: 'up' | 'down', percent: number } | null = null;

    if (showPrediction && data.length >= 2) {
        // Use last 4 points for better trend sensing
        const lastPoints = data.slice(-4);
        const last = lastPoints[lastPoints.length - 1];
        const first = lastPoints[0];
        const totalDiff = last.value - first.value;
        const trendPerPoint = totalDiff / (lastPoints.length - 1);

        const startX = getX(data.length - 1);
        const startY = getY(last.value);

        let currentX = startX;
        let currentValue = last.value;

        predictionPath = `M ${startX},${startY}`;

        // Dynamic step width based on window
        const stepWidth = (width - padding * 2 - startX) / (predictionWindow + 0.5);

        for (let j = 1; j <= predictionWindow; j++) {
            currentX += stepWidth;
            currentValue = Math.max(0, currentValue + trendPerPoint);
            predictionPath += ` L ${currentX},${getY(currentValue)}`;
        }

        const percentChange = first.value > 0 ? (totalDiff / first.value) * 100 : 0;
        predictionIndicator = {
            trend: totalDiff >= 0 ? 'up' : 'down',
            percent: Math.abs(percentChange)
        };
    }

    return (
        <div className="w-full h-full relative cursor-crosshair">
            {/* Prediction Indicator Badge */}
            {predictionIndicator && (
                <div className={`absolute top-0 right-10 px-4 py-1.5 rounded-full border flex items-center gap-2 animate-in slide-in-from-right-4 duration-500 z-20 shadow-lg ${predictionIndicator.trend === 'up'
                    ? 'bg-emerald-500 border-emerald-600 text-white'
                    : 'bg-rose-500 border-rose-600 text-white'
                    }`}>
                    <TrendingUp size={14} className={predictionIndicator.trend === 'down' ? 'rotate-180' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        Kelajak: {predictionIndicator.trend === 'up' ? 'O\'sish' : 'Tushish'}
                    </span>
                    <div className="w-px h-3 bg-white/30 mx-1"></div>
                    <span className="text-[10px] font-black">{predictionIndicator.percent.toFixed(0)}%</span>
                </div>
            )}

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="predGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Grid Lines (Horizontal) */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                    <line
                        key={i}
                        x1={padding}
                        y1={padding + p * (height - 2 * padding)}
                        x2={width - padding}
                        y2={padding + p * (height - 2 * padding)}
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        className="text-slate-100 dark:text-slate-800"
                        strokeWidth="1"
                    />
                ))}

                {/* Average Reference Line */}
                <line
                    x1={padding}
                    y1={getY(avgVal)}
                    x2={width - padding}
                    y2={getY(avgVal)}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="8 4"
                    className="opacity-40"
                />

                {/* Area under curve */}
                <path d={areaPath} fill="url(#chartGradient)" />

                {/* Prediction Line (RED / Continuation) */}
                {predictionPath && (
                    <path
                        d={predictionPath}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="4"
                        strokeDasharray="10 6"
                        strokeLinecap="round"
                        className="animate-pulse"
                        filter="url(#predGlow)"
                    />
                )}

                {/* Main Line (Blue) */}
                <path
                    d={bezierPath}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow)"
                />

                {/* Points and Interaction Areas */}
                {data.map((p, i) => (
                    <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                        {/* Invisible large hover area */}
                        <rect
                            x={getX(i) - 20}
                            y={0}
                            width={40}
                            height={height}
                            fill="transparent"
                        />

                        {/* Actual Visible Point */}
                        <circle
                            cx={getX(i)}
                            cy={getY(p.value)}
                            r={hoveredIndex === i ? 7 : 4}
                            className={`${hoveredIndex === i ? 'fill-blue-600' : 'fill-white dark:fill-slate-900'} transition-all`}
                            stroke="#3b82f6"
                            strokeWidth="3"
                        />

                        {/* Labels */}
                        <text
                            x={getX(i)}
                            y={height - 10}
                            textAnchor="middle"
                            className={`text-[10px] font-bold fill-slate-400 dark:fill-slate-500 uppercase transition-colors ${hoveredIndex === i ? 'fill-blue-500 dark:fill-blue-400' : ''}`}
                        >
                            {p.label}
                        </text>
                    </g>
                ))}
            </svg>

            {/* Tooltip Overlay */}
            {hoveredIndex !== null && (
                <div
                    className="absolute pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200 z-10"
                    style={{
                        left: `${(getX(hoveredIndex) / width) * 100}%`,
                        top: `${(getY(data[hoveredIndex].value) / height) * 100}%`,
                        transform: 'translate(-50%, -120%)'
                    }}
                >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {data[hoveredIndex].fullDate.toLocaleDateString('default', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm font-black text-slate-800 dark:text-white whitespace-nowrap">{data[hoveredIndex].value.toLocaleString()} UZS</p>
                </div>
            )}
        </div>
    );
};
