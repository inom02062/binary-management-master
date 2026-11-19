import React, { useState } from 'react';
import { Block, Apartment, Language, ApartmentStatus } from '../types';
import { api } from '../services/api';
import { TRANSLATIONS } from '../constants';
import { Plus, Minus, Trash2, Building, Layers, Loader2, Save } from 'lucide-react';

interface BlockStructureModalProps {
    block: Block;
    apartments: Apartment[];
    lang: Language;
    onClose: () => void;
    onUpdate: () => void;
}

export const BlockStructureModal: React.FC<BlockStructureModalProps> = ({ block, apartments, lang, onClose, onUpdate }) => {
    const t = TRANSLATIONS[lang];
    const [loading, setLoading] = useState(false);

    const blockApts = apartments.filter(a => a.blockId === block.id);

    const handleAddFloor = async () => {
        setLoading(true);
        const updatedBlock = { ...block, floorsCount: block.floorsCount + 1 };
        await api.saveBlock(updatedBlock);
        onUpdate();
        setLoading(false);
    };

    const handleRemoveTopFloor = async () => {
        if (block.floorsCount <= 1) return;
        if (!window.confirm(t.removeFloor + '?')) return;

        setLoading(true);
        // Delete all apartments on the top floor
        const topFloorApts = blockApts.filter(a => a.floor === block.floorsCount);
        for (const apt of topFloorApts) {
            await api.deleteApartment(apt.id);
        }

        const updatedBlock = { ...block, floorsCount: block.floorsCount - 1 };
        await api.saveBlock(updatedBlock);
        onUpdate();
        setLoading(false);
    };

    const handleAddUnit = async (floor: number) => {
        setLoading(true);
        const floorApts = blockApts.filter(a => a.floor === floor);
        const nextNumber = floorApts.length > 0 ? Math.max(...floorApts.map(a => a.number)) + 1 : 1;

        const newApt: Apartment = {
            id: Math.random().toString(36).substr(2, 9),
            blockId: block.id,
            floor,
            number: nextNumber,
            status: ApartmentStatus.EMPTY,
            payments: []
        };

        await api.saveApartment(newApt);
        onUpdate();
        setLoading(false);
    };

    const handleRemoveUnit = async (floor: number) => {
        const floorApts = blockApts.filter(a => a.floor === floor).sort((a, b) => b.number - a.number);
        if (floorApts.length === 0) return;

        const lastApt = floorApts[0];
        if (lastApt.status !== ApartmentStatus.EMPTY && !window.confirm('Unit is not empty. Delete anyway?')) return;

        setLoading(true);
        await api.deleteApartment(lastApt.id);
        onUpdate();
        setLoading(false);
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <Building className="w-4 h-4 text-blue-500" />
                        {block.name}: {t.manageStructure}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {Array.from({ length: block.floorsCount }, (_, i) => block.floorsCount - i).map(floor => {
                        const floorApts = blockApts.filter(a => a.floor === floor);
                        return (
                            <div key={floor} className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-500 shadow-sm">
                                        {floor}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">{t.floors}</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{floorApts.length} {t.apartments}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={loading || floorApts.length === 0}
                                        onClick={() => handleRemoveUnit(floor)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors disabled:opacity-30"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <button
                                        disabled={loading}
                                        onClick={() => handleAddUnit(floor)}
                                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded-lg transition-colors disabled:opacity-30"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        disabled={loading}
                        onClick={handleAddFloor}
                        className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers size={14} />}
                        {t.addFloor}
                    </button>
                    <button
                        disabled={loading || block.floorsCount <= 1}
                        onClick={handleRemoveTopFloor}
                        className="flex items-center justify-center gap-2 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-200 dark:hover:bg-red-900/40 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={14} />}
                        {t.removeFloor}
                    </button>
                </div>
            </div>
        </div>
    );
};
