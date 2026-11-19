import { Banknote, CircleHelp, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { Apartment, ApartmentStatus, Payment } from '../types';

interface ApartmentModalProps {
  apartment: Apartment;
  onSave: (apt: Apartment) => void;
  onClose: () => void;
  lang: 'en' | 'ru' | 'uz';
  readOnly?: boolean;
  onGuide?: () => void;
}

export const ApartmentModal: React.FC<ApartmentModalProps> = ({ apartment, onSave, onClose, lang, readOnly = false, onGuide }) => {
  const [data, setData] = useState(apartment);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');

  const t = TRANSLATIONS[lang];
  const totalPaid = useMemo(() => {
    return (data.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').reduce((sum, p) => sum + p.amount, 0);
  }, [data.payments]);

  // Serious, accessible colors
  const statusColors = {
    [ApartmentStatus.EMPTY]: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
    [ApartmentStatus.PAID]: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    [ApartmentStatus.PAYING]: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    [ApartmentStatus.LATE]: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  };

  const handleStatusChange = (status: ApartmentStatus) => {
    setData({ ...data, status });
  };

  const handleAddPayment = () => {
    if (!newPaymentAmount) return;
    const payment: Payment = {
      id: Math.random().toString(),
      amount: parseFloat(newPaymentAmount),
      date: new Date().toISOString().split('T')[0],
      note: 'Manual Entry'
    };
    setData({
      ...data,
      payments: [payment, ...data.payments] // Newest first
    });
    setNewPaymentAmount('');
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-100 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Apartment
              </h2>
              <input
                type="number"
                disabled={readOnly}
                className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                value={data.number}
                onChange={(e) => setData({ ...data, number: parseInt(e.target.value) || 0 })}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Floor {data.floor}</span>
          </div>
          <div className="flex items-center gap-1">
            {onGuide && (
              <button type="button" onClick={onGuide} title={lang === 'uz' ? 'Xonadon instruksiyasi' : lang === 'ru' ? 'Инструкция по квартире' : 'Apartment instructions'} aria-label={lang === 'uz' ? 'Instruksiya' : lang === 'ru' ? 'Инструкция' : 'Instructions'} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-blue-600 dark:hover:bg-slate-700">
                <CircleHelp size={17} />
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status Selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 block">{t.paymentStatus}</label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ApartmentStatus) as ApartmentStatus[]).map((s) => (
                <button
                  key={s}
                  disabled={readOnly}
                  onClick={() => handleStatusChange(s)}
                  className={`py-2 px-3 rounded-md text-sm font-semibold transition-all border ${data.status === s
                    ? statusColors[s] + ' ring-1 ring-offset-0 ring-current'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}
                >
                  {s === 'EMPTY' ? t.empty : s === 'PAID' ? t.paid : s === 'PAYING' ? t.paying : t.late}
                </button>
              ))}
            </div>
          </div>

          {/* Tenant Info */}
          {data.status !== ApartmentStatus.EMPTY && (
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block">{t.tenant}</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm dark:text-white"
                    disabled={readOnly}
                    placeholder={t.firstName}
                    value={data.tenantName || ''}
                    onChange={(e) => setData({ ...data, tenantName: e.target.value })}
                  />
                </div>
                <div>
                  <input
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm dark:text-white"
                    disabled={readOnly}
                    placeholder={t.lastName}
                    value={data.tenantSurname || ''}
                    onChange={(e) => setData({ ...data, tenantSurname: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payments */}
          {data.status !== ApartmentStatus.EMPTY && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block">{t.payments}</label>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">{t.totalPaid}:</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{totalPaid.toLocaleString()}</span>
                </div>
              </div>

              {!readOnly && <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Banknote className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm dark:text-white"
                    value={newPaymentAmount}
                    onChange={e => setNewPaymentAmount(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleAddPayment}
                  className="bg-slate-800 dark:bg-blue-600 text-white px-4 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors"
                >
                  {t.addPay}
                </button>
              </div>}

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {(data.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').length === 0 && <p className="text-center text-slate-400 text-xs py-4 italic">No payment records found.</p>}
                {(data.payments || []).filter(p => p.status !== 'PLANNED' && p.status !== 'CANCELLED').map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2.5 bg-slate-100 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 rounded-md text-sm">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">{p.date}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{p.amount.toLocaleString()} so'm</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          {!readOnly && <button
            onClick={() => onSave(data)}
            className="w-full bg-blue-600 text-white py-2.5 rounded-md font-semibold hover:bg-blue-700 active:scale-[0.99] transition-all shadow-sm"
          >
            {t.save}
          </button>}
        </div>
      </div>
    </div>
  );
};