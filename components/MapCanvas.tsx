import { ArrowUpRight, Image as ImageIcon, Loader2, Maximize2, Moon, Plus, RotateCcw, Settings, SlidersHorizontal, Sun, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import React, { lazy, Suspense, useRef, useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { api } from '../services/api';
import { Apartment, Block, Language, Theme } from '../types';
import { BlockStructureModal } from './BlockStructureModal';
import type { Map3DSettings } from './Map3DView';
const Map3DView = lazy(() => import('./Map3DView').then(module => ({ default: module.Map3DView })));

const DEFAULT_3D_SETTINGS: Map3DSettings = {
  widthScale: 1,
  depthScale: 1,
  floorHeightScale: 1.45,
  showFloorLines: true,
  showShadows: true,
  showFloorCount: true,
  showFloorNumbers: true,
};

interface MapCanvasProps {
  blocks: Block[];
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  isReadOnly?: boolean;
  onBlockClick?: (blockId: string) => void;
  onFloorClick?: (blockId: string, floor: number) => void;
  lang?: Language;
  apartments: Apartment[];
  onRefresh: () => Promise<void>;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({ blocks, setBlocks, apartments, onRefresh, theme, setTheme, isReadOnly = false, onBlockClick, onFloorClick, lang = 'ru' }) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isManagingStructure, setIsManagingStructure] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newBlockData, setNewBlockData] = useState({ name: '', floors: 5, apts: 4 });
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [is3DSettingsOpen, setIs3DSettingsOpen] = useState(false);
  const [map3DSettings, setMap3DSettings] = useState<Map3DSettings>(DEFAULT_3D_SETTINGS);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragRef = useRef<{
    mode: 'IDLE' | 'DRAG' | 'RESIZE' | 'PAN';
    blockId: string | null;
    startX: number;
    startY: number;
    initialBlock: Block | null;
    initialOffset: { x: number, y: number } | null;
    hasMoved: boolean;
  }>({
    mode: 'IDLE',
    blockId: null,
    startX: 0,
    startY: 0,
    initialBlock: null,
    initialOffset: null,
    hasMoved: false
  });

  const t = TRANSLATIONS[lang];
  const colorBlock = blocks.find(block => block.id === selectedBlockId) ?? blocks[0];
  const modelLabels = {
    en: { settings: '3D settings', width: 'Building width', depth: 'Building depth', floorHeight: 'Floor height', floorLines: 'Floor separators', floorCount: 'Show floor counts', floorNumbers: 'Number each floor', shadows: 'Shadows', reset: 'Reset defaults', building: 'Building color', selectBuilding: 'Select building', theme: 'Map theme' },
    ru: { settings: 'Настройки 3D', width: 'Ширина здания', depth: 'Глубина здания', floorHeight: 'Высота этажа', floorLines: 'Разделители этажей', floorCount: 'Показывать число этажей', floorNumbers: 'Номер на каждом этаже', shadows: 'Тени', reset: 'Сбросить настройки', building: 'Цвет здания', selectBuilding: 'Выберите здание', theme: 'Тема карты' },
    uz: { settings: '3D sozlamalar', width: 'Bino eni', depth: 'Bino chuqurligi', floorHeight: 'Qavat balandligi', floorLines: 'Qavat ajratgichlari', floorCount: 'Qavatlar sonini ko‘rsatish', floorNumbers: 'Har qavat raqamini ko‘rsatish', shadows: 'Soyalar', reset: 'Standart holatga qaytarish', building: 'Bino rangi', selectBuilding: 'Binoni tanlang', theme: 'Xarita mavzusi' },
  }[lang];

  const saveBuildingColor = async (block: Block, color: string) => {
    const updatedBlock = { ...block, color };
    setBlocks(current => current.map(item => item.id === block.id ? updatedBlock : item));
    await api.saveBlock(updatedBlock);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current.mode === 'IDLE') return;

    const { startX, startY, initialBlock, initialOffset, mode } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragRef.current.hasMoved = true;
    }

    if (mode === 'PAN') {
      if (initialOffset) {
        setOffset({
          x: initialOffset.x + deltaX,
          y: initialOffset.y + deltaY
        });
      }
      return;
    }

    if (!initialBlock) return;

    setBlocks(prev => prev.map(b => {
      if (b.id !== initialBlock.id) return b;
      if (mode === 'DRAG') {
        return {
          ...b,
          x: Math.max(0, initialBlock.x + deltaX / zoom),
          y: Math.max(0, initialBlock.y + deltaY / zoom)
        };
      } else {
        return {
          ...b,
          width: Math.max(80, initialBlock.width + deltaX / zoom),
          height: Math.max(80, initialBlock.height + deltaY / zoom)
        };
      }
    }));
  };

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const touchRef = useRef<{ initialDist: number | null }>({ initialDist: null });
  const lastTouchTapRef = useRef<{ blockId: string; time: number; x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchRef.current.initialDist = dist;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragRef.current = {
        mode: 'PAN',
        blockId: null,
        startX: touch.clientX,
        startY: touch.clientY,
        initialBlock: null,
        initialOffset: { ...offset },
        hasMoved: false
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current.initialDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchRef.current.initialDist;
      const newZoom = Math.min(Math.max(0.1, zoom * factor), 5);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const newOffsetX = midX - (midX - offset.x) * (newZoom / zoom);
        const newOffsetY = midY - (midY - offset.y) * (newZoom / zoom);

        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
        touchRef.current.initialDist = dist;
      }
    } else if (e.touches.length === 1 && dragRef.current.mode === 'PAN') {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragRef.current.startX;
      const deltaY = touch.clientY - dragRef.current.startY;
      setOffset({
        x: dragRef.current.initialOffset!.x + deltaX,
        y: dragRef.current.initialOffset!.y + deltaY
      });
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    const { blockId, mode, hasMoved } = dragRef.current;

    if (mode !== 'IDLE' && blockId && hasMoved) {
      // Use blocksRef to get the most recent state from setBlocks
      const currentBlock = blocksRef.current.find(b => b.id === blockId);
      if (currentBlock) {
        await api.saveBlock(currentBlock);
      }
    }

    if (e.pointerType === 'touch' && mode === 'DRAG' && blockId && !hasMoved) {
      const previousTap = lastTouchTapRef.current;
      const isDoubleTap = previousTap?.blockId === blockId
        && e.timeStamp - previousTap.time < 450
        && Math.hypot(e.clientX - previousTap.x, e.clientY - previousTap.y) < 32;

      if (isDoubleTap) {
        lastTouchTapRef.current = null;
        onBlockClick?.(blockId);
      } else {
        lastTouchTapRef.current = { blockId, time: e.timeStamp, x: e.clientX, y: e.clientY };
      }
    } else if (e.pointerType === 'touch') {
      lastTouchTapRef.current = null;
    }

    dragRef.current = {
      mode: 'IDLE',
      blockId: null,
      startX: 0,
      startY: 0,
      initialBlock: null,
      initialOffset: null,
      hasMoved: false
    };
  };

  const startInteraction = (e: React.PointerEvent, block: Block, mode: 'DRAG' | 'RESIZE') => {
    if (isReadOnly) {
      if (onBlockClick) onBlockClick(block.id);
      return;
    }

    e.stopPropagation();
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);

    setSelectedBlockId(block.id);
    dragRef.current = {
      mode,
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      initialBlock: { ...block },
      initialOffset: null,
      hasMoved: false
    };
  };

  const startPanning = (e: React.PointerEvent) => {
    // Allow panning with left(0), middle(1), right(2) buttons
    if (e.button !== 0 && e.button !== 1 && e.button !== 2 && !e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);

    dragRef.current = {
      mode: 'PAN',
      blockId: null,
      startX: e.clientX,
      startY: e.clientY,
      initialBlock: null,
      initialOffset: { ...offset },
      hasMoved: false
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      const newZoom = Math.min(Math.max(0.1, zoom * factor), 5);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newOffsetX = mouseX - (mouseX - offset.x) * (newZoom / zoom);
        const newOffsetY = mouseY - (mouseY - offset.y) * (newZoom / zoom);

        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.delete + '?')) {
      await api.deleteBlock(id);
      setBlocks(prev => prev.filter(b => b.id !== id));
      setSelectedBlockId(null);
    }
  };

  const handleCreateBlock = async () => {
    const newBlock: Block = {
      id: Math.random().toString(36).substr(2, 9),
      name: newBlockData.name || `Building ${blocks.length + 1}`,
      x: 50, y: 50, width: 120, height: 120,
      floorsCount: newBlockData.floors,
      aptsPerFloor: newBlockData.apts,
      color: '#3b82f6'
    };
    await api.saveBlock(newBlock);
    setBlocks(prev => [...prev, newBlock]);
    setIsCreating(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBlockId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const block = blocks.find(b => b.id === selectedBlockId);
      if (block) {
        setUploadingId(selectedBlockId);
        const updatedBlock = { ...block, imageUrl: base64 };
        await api.saveBlock(updatedBlock);
        setBlocks(prev => prev.map(b => b.id === selectedBlockId ? updatedBlock : b));
        setUploadingId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      ref={canvasRef}
      className="flex flex-col h-full w-full relative overflow-hidden bg-slate-100 dark:bg-slate-950"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { touchRef.current.initialDist = null; dragRef.current.mode = 'IDLE'; }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2">
        {viewMode === '2D' && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-xl flex flex-col gap-1">
          <button
            onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev / 1.2))}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <div className="h-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>}
        {viewMode === '2D' && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-lg text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
          {Math.round(zoom * 100)}%
        </div>}
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-lg shadow-lg" role="group" aria-label="Map view">
        {(['2D', '3D'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            aria-pressed={viewMode === mode}
            title={`${mode} view`}
            className={`min-w-10 h-8 px-2 rounded-md text-xs font-bold transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300'}`}
          >
            {mode}
          </button>
        ))}
        {viewMode === '3D' && <button
          type="button"
          onClick={() => setIs3DSettingsOpen(open => !open)}
          aria-label={modelLabels.settings}
          aria-expanded={is3DSettingsOpen}
          title={modelLabels.settings}
          className={`ml-1 flex h-8 w-8 items-center justify-center rounded-md transition-colors ${is3DSettingsOpen ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
        >
          <SlidersHorizontal size={16} />
        </button>}
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          type="button"
          onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
          title={modelLabels.theme}
          aria-label={modelLabels.theme}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      {viewMode === '3D' && is3DSettingsOpen && <section className="absolute right-4 top-16 z-40 w-[min(19rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-bold text-slate-800 dark:text-white">{modelLabels.settings}</h2>
        <div className="space-y-4">
          {blocks.length > 0 && <div className="flex items-center gap-3">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{modelLabels.building}</span>
              <select
                value={selectedBlockId ?? blocks[0].id}
                onChange={event => setSelectedBlockId(event.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                aria-label={modelLabels.selectBuilding}
              >
                {blocks.map(block => <option key={block.id} value={block.id}>{block.name}</option>)}
              </select>
            </label>
            {colorBlock && <input
              type="color"
              value={colorBlock.color}
              onChange={event => void saveBuildingColor(colorBlock, event.target.value)}
              aria-label={modelLabels.building}
              className="mt-5 h-9 w-10 cursor-pointer rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
            />}
          </div>}
          {([
            { key: 'widthScale', label: modelLabels.width, min: 0.6, max: 2.2, step: 0.05 },
            { key: 'depthScale', label: modelLabels.depth, min: 0.6, max: 2.2, step: 0.05 },
            { key: 'floorHeightScale', label: modelLabels.floorHeight, min: 0.65, max: 2.4, step: 0.05 },
          ] as const).map(control => (
            <label key={control.key} className="block">
              <span className="mb-1.5 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                <span>{control.label}</span>
                <span className="tabular-nums">{Math.round(map3DSettings[control.key] * 100)}%</span>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={map3DSettings[control.key]}
                onChange={event => setMap3DSettings(current => ({ ...current, [control.key]: Number(event.target.value) }))}
                className="h-2 w-full cursor-pointer accent-blue-600"
              />
            </label>
          ))}
          {([
            { key: 'showFloorCount', label: modelLabels.floorCount },
            { key: 'showFloorNumbers', label: modelLabels.floorNumbers },
            { key: 'showFloorLines', label: modelLabels.floorLines },
            { key: 'showShadows', label: modelLabels.shadows },
          ] as const).map(toggle => (
            <label key={toggle.key} className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>{toggle.label}</span>
              <input
                type="checkbox"
                checked={map3DSettings[toggle.key]}
                onChange={event => setMap3DSettings(current => ({ ...current, [toggle.key]: event.target.checked }))}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => setMap3DSettings(DEFAULT_3D_SETTINGS)}
            className="w-full border-t border-slate-200 pt-3 text-left text-xs font-semibold text-blue-600 hover:text-blue-700 dark:border-slate-700 dark:text-blue-400"
          >
            {modelLabels.reset}
          </button>
        </div>
      </section>}

      {!isReadOnly && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-full shadow-lg">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Plus size={14} />
            {t.createBlock}
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <div className="text-[10px] text-slate-400 px-3 uppercase tracking-wider font-bold">
            {t.instructions}
          </div>
        </div>
      )}

      {viewMode === '3D' ? (
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-950"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
            <Map3DView
              blocks={blocks}
              settings={map3DSettings}
              lang={lang}
              theme={theme}
              onBlockClick={(blockId, floor) => {
                if (floor !== undefined && onFloorClick) onFloorClick(blockId, floor);
                else onBlockClick?.(blockId);
              }}
            />
          </Suspense>
        </div>
      ) : <div
        className="flex-1 relative cursor-crosshair select-none touch-none overflow-hidden"
        onPointerDown={(e) => {
          // Allow panning with left (0), middle (1), or right (2) click
          // Always deselect when clicking on background
          setSelectedBlockId(null);
          startPanning(e);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out origin-top-left"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px', width: '5000px', height: '5000px' }} />

          {blocks.map(block => (
            <div
              key={block.id}
              onPointerDown={(e) => {
                if (e.button === 0 && !e.shiftKey) {
                  startInteraction(e, block, 'DRAG');
                }
              }}
              onDoubleClick={() => onBlockClick?.(block.id)}
              className={`absolute rounded-lg bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center justify-center border transition-shadow duration-200
              ${selectedBlockId === block.id ? 'ring-2 ring-blue-500 z-20 shadow-xl border-transparent' : 'border-slate-200 dark:border-slate-700 z-10'}
              ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:border-blue-400'}
            `}
              style={{
                left: block.x,
                top: block.y,
                width: block.width,
                height: block.height,
                backgroundImage: block.imageUrl ? `linear-gradient(${block.color}28, ${block.color}28), url(${block.imageUrl})` : 'none',
                backgroundColor: block.imageUrl ? undefined : `${block.color}20`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center'
              }}
            >
              {selectedBlockId === block.id && <input
                type="color"
                value={block.color}
                disabled={isReadOnly}
                onPointerDown={event => event.stopPropagation()}
                onChange={event => void saveBuildingColor(block, event.target.value)}
                aria-label={modelLabels.building}
                title={modelLabels.building}
                className="absolute right-2 top-2 z-10 h-7 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800"
              />}
              {!block.imageUrl && <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: block.color }}></div>}

              <div className={`flex flex-col items-center pointer-events-none px-2 text-center overflow-hidden ${block.imageUrl ? 'bg-black/40 backdrop-blur-[2px] rounded-md py-1' : ''}`}>
                <span className={`font-bold text-[11px] md:text-xs truncate w-full ${block.imageUrl ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                  {block.name}
                </span>
                <span className={`text-[9px] font-black uppercase mt-0.5 ${block.imageUrl ? 'text-slate-200' : 'text-slate-400'}`}>
                  {block.floorsCount}F • {block.aptsPerFloor}A
                </span>
              </div>

              {!isReadOnly && selectedBlockId === block.id && (
                <>
                  <div
                    className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-slate-300 hover:text-blue-500 transition-colors"
                    onPointerDown={(e) => startInteraction(e, block, 'RESIZE')}
                  >
                    <Maximize2 size={12} className="rotate-90" />
                  </div>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onPointerUp={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(block.id); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
                  >
                    <Trash2 size={10} />
                  </button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onPointerUp={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); setIsManagingStructure(block.id); }}
                    className="absolute -top-2 -left-2 bg-blue-500 text-white p-1 rounded-full shadow-lg hover:bg-blue-600 transition-all hover:scale-110"
                  >
                    <Settings size={10} />
                  </button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onPointerUp={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white p-1 rounded-full shadow-lg hover:bg-emerald-600 transition-all hover:scale-110"
                  >
                    {uploadingId === block.id ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                  </button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onPointerUp={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); onBlockClick?.(block.id); }}
                    title={lang === 'uz' ? 'Binoni ochish' : lang === 'ru' ? 'Открыть здание' : 'Open building'}
                    className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg transition-colors hover:bg-slate-900 dark:bg-slate-500 dark:hover:bg-slate-400"
                  >
                    <ArrowUpRight size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        </div>
      </div>}

      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-xs border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black mb-6 text-slate-800 dark:text-white uppercase tracking-widest text-center">{t.createBlock}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">{t.name}</label>
                <input
                  className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                  value={newBlockData.name}
                  onChange={e => setNewBlockData({ ...newBlockData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">{t.floors}</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                    value={newBlockData.floors}
                    onChange={e => setNewBlockData({ ...newBlockData, floors: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">Apts</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                    value={newBlockData.apts}
                    onChange={e => setNewBlockData({ ...newBlockData, apts: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-8">
              <button onClick={() => setIsCreating(false)} className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">{t.cancel}</button>
              <button onClick={handleCreateBlock} className="flex-1 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{t.create}</button>
            </div>
          </div>
        </div>
      )}

      {isManagingStructure && (
        <BlockStructureModal
          block={blocks.find(b => b.id === isManagingStructure)!}
          apartments={apartments}
          lang={lang}
          onClose={() => setIsManagingStructure(null)}
          onUpdate={onRefresh}
        />
      )}

    </div>
  );
};
