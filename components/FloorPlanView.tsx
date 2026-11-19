import { Maximize2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Apartment, ApartmentStatus, Language } from '../types';

const PLAN_WIDTH = 1000;
const PLAN_HEIGHT = 700;

interface FloorPlanViewProps {
  apartments: Apartment[];
  lang: Language;
  isReadOnly?: boolean;
  onApartmentClick: (apartment: Apartment) => void;
  onApartmentSaved: (apartment: Apartment) => Promise<void>;
}

const labels = {
  en: { empty: 'Vacant', paid: 'Paid', paying: 'Paying', late: 'Overdue', saved: 'Plan saved', saveError: 'Could not save apartment position' },
  ru: { empty: 'Свободна', paid: 'Оплачена', paying: 'Платит', late: 'Долг', saved: 'План сохранен', saveError: 'Не удалось сохранить место квартиры' },
  uz: { empty: 'Bo‘sh', paid: 'To‘langan', paying: 'To‘layapti', late: 'Qarzdor', saved: 'Reja saqlandi', saveError: 'Xonadon joyini saqlab bo‘lmadi' },
};

const withDefaultLayout = (apartments: Apartment[]): Apartment[] => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(apartments.length * PLAN_WIDTH / PLAN_HEIGHT)));
  const rows = Math.max(1, Math.ceil(apartments.length / columns));
  const cellWidth = (PLAN_WIDTH - 80) / columns;
  const cellHeight = (PLAN_HEIGHT - 80) / rows;

  return [...apartments]
    .sort((first, second) => first.number - second.number)
    .map((apartment, index) => ({
      ...apartment,
      layoutX: apartment.layoutX ?? 40 + (index % columns) * cellWidth + 5,
      layoutY: apartment.layoutY ?? 40 + Math.floor(index / columns) * cellHeight + 5,
      layoutWidth: apartment.layoutWidth ?? Math.max(80, cellWidth - 10),
      layoutHeight: apartment.layoutHeight ?? Math.max(70, cellHeight - 10),
    }));
};

const statusClass: Record<ApartmentStatus, string> = {
  [ApartmentStatus.EMPTY]: 'border-slate-300 bg-white text-slate-800 hover:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  [ApartmentStatus.PAID]: 'border-emerald-400 bg-emerald-50 text-emerald-950 hover:border-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100',
  [ApartmentStatus.PAYING]: 'border-sky-400 bg-sky-50 text-sky-950 hover:border-sky-600 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100',
  [ApartmentStatus.LATE]: 'border-rose-400 bg-rose-50 text-rose-950 hover:border-rose-600 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-100',
};

export const FloorPlanView: React.FC<FloorPlanViewProps> = ({ apartments, lang, isReadOnly = false, onApartmentClick, onApartmentSaved }) => {
  const [placedApartments, setPlacedApartments] = useState(() => withDefaultLayout(apartments));
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    pointerX: number;
    pointerY: number;
    initial: Apartment;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setPlacedApartments(withDefaultLayout(apartments));
  }, [apartments]);

  const labelsForLanguage = labels[lang];
  const getStatusLabel = (status: ApartmentStatus) => {
    if (status === ApartmentStatus.PAID) return labelsForLanguage.paid;
    if (status === ApartmentStatus.PAYING) return labelsForLanguage.paying;
    if (status === ApartmentStatus.LATE) return labelsForLanguage.late;
    return labelsForLanguage.empty;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, apartment: Apartment, mode: 'move' | 'resize') => {
    if (isReadOnly || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: apartment.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      initial: apartment,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;

    const bounds = stage.getBoundingClientRect();
    const deltaX = (event.clientX - drag.pointerX) * PLAN_WIDTH / bounds.width;
    const deltaY = (event.clientY - drag.pointerY) * PLAN_HEIGHT / bounds.height;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) drag.moved = true;

    setPlacedApartments(current => current.map(apartment => {
      if (apartment.id !== drag.id) return apartment;
      if (drag.mode === 'move') {
        return {
          ...apartment,
          layoutX: Math.max(0, Math.min(PLAN_WIDTH - (drag.initial.layoutWidth ?? 100), (drag.initial.layoutX ?? 0) + deltaX)),
          layoutY: Math.max(0, Math.min(PLAN_HEIGHT - (drag.initial.layoutHeight ?? 90), (drag.initial.layoutY ?? 0) + deltaY)),
        };
      }
      return {
        ...apartment,
        layoutWidth: Math.max(80, Math.min(PLAN_WIDTH - (drag.initial.layoutX ?? 0), (drag.initial.layoutWidth ?? 100) + deltaX)),
        layoutHeight: Math.max(65, Math.min(PLAN_HEIGHT - (drag.initial.layoutY ?? 0), (drag.initial.layoutHeight ?? 90) + deltaY)),
      };
    }));
  };

  const handlePointerUp = async (event: React.PointerEvent<HTMLButtonElement>, apartment: Apartment) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== apartment.id) return;
    dragRef.current = null;
    if (!drag.moved) {
      onApartmentClick(apartment);
      return;
    }

    const updatedApartment = placedApartments.find(item => item.id === apartment.id);
    if (!updatedApartment) return;
    const savedApartment = { ...updatedApartment };
    await onApartmentSaved(savedApartment).then(
      () => setSaveState('saved'),
      () => setSaveState('error')
    );
    window.setTimeout(() => setSaveState('idle'), 1800);
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800" />{labelsForLanguage.empty}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />{labelsForLanguage.paid}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-400" />{labelsForLanguage.paying}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-400" />{labelsForLanguage.late}</span>
        </div>
        <span aria-live="polite" className={saveState === 'error' ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}>
          {saveState === 'saved' ? labelsForLanguage.saved : saveState === 'error' ? labelsForLanguage.saveError : `${apartments.length}`}
        </span>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-300 bg-slate-200 p-2 dark:border-slate-700 dark:bg-slate-950">
        <div
          ref={stageRef}
          className="relative mx-auto min-w-[620px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900"
          style={{ aspectRatio: `${PLAN_WIDTH} / ${PLAN_HEIGHT}`, backgroundImage: 'linear-gradient(to right, rgba(100,116,139,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,.10) 1px, transparent 1px)', backgroundSize: '5% 7.142%' }}
        >
          <div className="pointer-events-none absolute inset-3 rounded border-2 border-dashed border-slate-300 dark:border-slate-700" />
          {placedApartments.map(apartment => (
            <button
              key={apartment.id}
              type="button"
              onPointerDown={event => handlePointerDown(event, apartment, 'move')}
              onPointerMove={handlePointerMove}
              onPointerUp={event => void handlePointerUp(event, apartment)}
              onPointerCancel={() => { dragRef.current = null; }}
              aria-label={`${lang === 'uz' ? 'Xonadon' : lang === 'ru' ? 'Квартира' : 'Apartment'} ${apartment.number}, ${getStatusLabel(apartment.status)}`}
              className={`group absolute flex touch-none flex-col items-center justify-center overflow-hidden rounded-md border-2 shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:z-10 hover:shadow-lg active:z-20 ${statusClass[apartment.status]} ${!isReadOnly ? 'cursor-move' : 'cursor-pointer'}`}
              style={{
                left: `${(apartment.layoutX ?? 0) / PLAN_WIDTH * 100}%`,
                top: `${(apartment.layoutY ?? 0) / PLAN_HEIGHT * 100}%`,
                width: `${(apartment.layoutWidth ?? 100) / PLAN_WIDTH * 100}%`,
                height: `${(apartment.layoutHeight ?? 90) / PLAN_HEIGHT * 100}%`,
                animation: 'floor-plan-enter 360ms cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <span className="text-[clamp(12px,2vw,21px)] font-black tabular-nums">{apartment.number}</span>
              <span className="max-w-full truncate px-1 text-[clamp(8px,1vw,11px)] font-bold uppercase opacity-65">{getStatusLabel(apartment.status)}</span>
              {apartment.tenantName && <span className="max-w-full truncate px-1 text-[clamp(8px,1vw,10px)] opacity-70">{apartment.tenantName}</span>}
              {!isReadOnly && (
                <span
                  role="button"
                  aria-label={lang === 'uz' ? 'Razmerni o‘zgartirish' : lang === 'ru' ? 'Изменить размер' : 'Resize apartment'}
                  onPointerDown={event => handlePointerDown(event, apartment, 'resize')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={event => { event.stopPropagation(); void handlePointerUp(event, apartment); }}
                  onPointerCancel={() => { dragRef.current = null; }}
                  className="absolute bottom-0 right-0 flex h-6 w-6 cursor-nwse-resize items-end justify-end rounded-tl-md bg-black/10 p-1 opacity-70 transition-opacity hover:opacity-100"
                >
                  <Maximize2 size={11} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <style>{'@keyframes floor-plan-enter { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }'}</style>
    </div>
  );
};
