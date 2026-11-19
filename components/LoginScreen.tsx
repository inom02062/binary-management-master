import { BookOpen, Moon, Sun } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { api } from '../services/api';
import { Language, Theme, User } from '../types';
import { UsageGuideModal } from './UsageGuideModal';

interface AnimationNode {
    x: number;
    y: number;
    phase: number;
    isGuide?: boolean;
}

const initialNodes: AnimationNode[] = [
    { x: 0.07, y: 0.2, phase: 0.4 }, { x: 0.16, y: 0.12, phase: 1.8 }, { x: 0.25, y: 0.23, phase: 3.2 }, { x: 0.17, y: 0.34, phase: 5.1 },
    { x: 0.74, y: 0.19, phase: 2.4 }, { x: 0.84, y: 0.12, phase: 4.3 }, { x: 0.94, y: 0.25, phase: 1.2 },
    { x: 0.07, y: 0.72, phase: 5.7 }, { x: 0.17, y: 0.83, phase: 3.7 }, { x: 0.28, y: 0.72, phase: 0.9 },
    { x: 0.73, y: 0.72, phase: 2.9 }, { x: 0.83, y: 0.84, phase: 4.8 }, { x: 0.94, y: 0.72, phase: 1.5 },
    { x: 0.29, y: 0.5, phase: 0.8, isGuide: true }, { x: 0.71, y: 0.5, phase: 2.7, isGuide: true }, { x: 0.96, y: 0.5, phase: 4.9, isGuide: true },
];
const initialConnections: [number, number][] = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [7, 8], [8, 9], [10, 11], [11, 12]];

export const LoginScreen: React.FC<{
    onLogin: (user: User) => void;
    lang: Language;
    setLang: (lang: Language) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
}> = ({ onLogin, lang, setLang, theme, setTheme }) => {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const t = TRANSLATIONS[lang];
    const openGuide = useCallback(() => setIsGuideOpen(true), []);
    const closeGuide = useCallback(() => setIsGuideOpen(false), []);
    const controlText = {
        uz: { language: 'Til', dark: 'Qorong‘i mavzuni yoqish', light: 'Yorug‘ mavzuni yoqish', dragHint: 'Sharni torting; tez tortilsa uziladi. Qora sharni bosing — qo‘llanma ochiladi.', guide: 'Dastur qo‘llanmasi' },
        ru: { language: 'Язык', dark: 'Включить тёмную тему', light: 'Включить светлую тему', dragHint: 'Перетащите шар: резкое движение отсоединит его. Нажмите чёрный шар, чтобы открыть руководство.', guide: 'Руководство по приложению' },
        en: { language: 'Language', dark: 'Enable dark theme', light: 'Enable light theme', dragHint: 'Drag a ball: a quick pull detaches it. Click a black ball to open the guide.', guide: 'App user guide' },
    }[lang];

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const nodes = initialNodes.map(node => ({ ...node }));
        let connections = initialConnections.map(([from, to]) => [from, to] as [number, number]);
        let width = 0;
        let height = 0;
        let frame = 0;
        let pointerX = 0;
        let pointerY = 0;
        let targetX = 0;
        let targetY = 0;
        let pointerActive = false;
        let pointerWeight = 0;
        let draggedIndex: number | null = null;
        let detachedFrom: Set<number> | null = null;
        let lastDragX = 0;
        let lastDragY = 0;
        let lastDragTime = 0;
        let pointerDownX = 0;
        let pointerDownY = 0;
        let didDrag = false;
        let pressedGuideNode = false;
        let renderedPoints: { x: number; y: number }[] = [];

        const getCanvasPoint = (event: PointerEvent) => {
            const bounds = canvas.getBoundingClientRect();
            return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        };

        const connectedNodes = (start: number) => {
            const connected = new Set<number>([start]);
            const pending = [start];
            while (pending.length > 0) {
                const current = pending.pop();
                if (current === undefined) continue;
                for (const [from, to] of connections) {
                    const neighbor = from === current ? to : to === current ? from : -1;
                    if (neighbor >= 0 && !connected.has(neighbor)) {
                        connected.add(neighbor);
                        pending.push(neighbor);
                    }
                }
            }
            return connected;
        };

        const joinNearestNetwork = (index: number) => {
            const point = renderedPoints[index];
            if (!point) return;
            const snapDistance = Math.max(36, Math.min(width, height) * 0.05);
            const alreadyConnected = connectedNodes(index);
            let nearestIndex = -1;
            let nearestDistance = snapDistance;
            renderedPoints.forEach((candidate, candidateIndex) => {
                if (alreadyConnected.has(candidateIndex) || detachedFrom?.has(candidateIndex)) return;
                const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
                if (distance < nearestDistance) {
                    nearestIndex = candidateIndex;
                    nearestDistance = distance;
                }
            });
            if (nearestIndex >= 0) {
                connections.push([index, nearestIndex]);
                detachedFrom = null;
            }
        };

        const resize = () => {
            const bounds = canvas.getBoundingClientRect();
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            width = bounds.width;
            height = bounds.height;
            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            renderedPoints = nodes.map(node => ({ x: node.x * width, y: node.y * height }));
            if (reducedMotion.matches) draw(0);
        };

        const onPointerMove = (event: PointerEvent) => {
            const point = getCanvasPoint(event);
            targetX = point.x;
            targetY = point.y;
            pointerActive = true;
            if (draggedIndex === null) {
                const hoveredIndex = renderedPoints.findIndex(candidate => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 24);
                canvas.style.cursor = hoveredIndex < 0 ? 'default' : nodes[hoveredIndex].isGuide ? 'pointer' : 'grab';
                return;
            }

            if (Math.hypot(point.x - pointerDownX, point.y - pointerDownY) > 7) didDrag = true;
            const now = performance.now();
            const elapsed = Math.max(now - lastDragTime, 1);
            const speed = Math.hypot(point.x - lastDragX, point.y - lastDragY) / elapsed;
            if (detachedFrom === null && speed > 0.85 && connections.some(([from, to]) => from === draggedIndex || to === draggedIndex)) {
                detachedFrom = connectedNodes(draggedIndex);
                connections = connections.filter(([from, to]) => from !== draggedIndex && to !== draggedIndex);
            }
            lastDragX = point.x;
            lastDragY = point.y;
            lastDragTime = now;
            if (renderedPoints[draggedIndex]) renderedPoints[draggedIndex] = point;
            joinNearestNetwork(draggedIndex);
            if (reducedMotion.matches) draw(0);
        };
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            const point = getCanvasPoint(event);
            let nearestIndex = -1;
            let nearestDistance = 24;
            renderedPoints.forEach((candidate, index) => {
                const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
                if (distance < nearestDistance) {
                    nearestIndex = index;
                    nearestDistance = distance;
                }
            });
            if (nearestIndex < 0) return;

            draggedIndex = nearestIndex;
            detachedFrom = null;
            pressedGuideNode = nodes[nearestIndex].isGuide === true;
            didDrag = false;
            pointerDownX = point.x;
            pointerDownY = point.y;
            pointerActive = true;
            targetX = pointerX = point.x;
            targetY = pointerY = point.y;
            lastDragX = point.x;
            lastDragY = point.y;
            lastDragTime = performance.now();
            canvas.style.cursor = 'grabbing';
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
            if (reducedMotion.matches) draw(0);
        };

        const onPointerUp = (event: PointerEvent) => {
            if (draggedIndex === null) {
                pointerActive = false;
                return;
            }
            const index = draggedIndex;
            const point = getCanvasPoint(event);
            const shouldOpenGuide = event.type === 'pointerup' && pressedGuideNode && !didDrag;
            targetX = point.x;
            targetY = point.y;
            if (width > 0 && height > 0) {
                nodes[index].x = point.x / width;
                nodes[index].y = point.y / height;
            }
            if (renderedPoints[index]) renderedPoints[index] = point;
            joinNearestNetwork(index);
            draggedIndex = null;
            detachedFrom = null;
            pressedGuideNode = false;
            pointerActive = false;
            canvas.style.cursor = 'default';
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            if (reducedMotion.matches) draw(0);
            if (shouldOpenGuide) openGuide();
        };

        const onPointerLeave = () => {
            if (draggedIndex === null) pointerActive = false;
            if (reducedMotion.matches) draw(0);
        };

        const draw = (time: number) => {
            context.clearRect(0, 0, width, height);
            pointerX += (targetX - pointerX) * 0.1;
            pointerY += (targetY - pointerY) * 0.1;
            pointerWeight += ((pointerActive ? 1 : 0) - pointerWeight) * 0.085;

            const scale = Math.min(width, height);
            renderedPoints = nodes.map((node, index) => {
                if (index === draggedIndex) return { x: targetX, y: targetY };
                const baseX = node.x * width;
                const baseY = node.y * height;
                const dx = pointerX - baseX;
                const dy = pointerY - baseY;
                const distance = Math.hypot(dx, dy);
                const pull = Math.max(0, 1 - distance / (scale * 0.62)) * pointerWeight * 0.12;
                const drift = reducedMotion.matches ? 0 : 9;
                return {
                    x: baseX + dx * pull + Math.sin(time * 0.0008 + node.phase) * drift,
                    y: baseY + dy * pull + Math.cos(time * 0.00065 + node.phase) * drift,
                };
            });

            context.lineWidth = 1;
            context.strokeStyle = theme === 'dark' ? 'rgba(125, 211, 252, 0.28)' : 'rgba(59, 130, 246, 0.25)';
            for (const [from, to] of connections) {
                context.beginPath();
                context.moveTo(renderedPoints[from].x, renderedPoints[from].y);
                context.lineTo(renderedPoints[to].x, renderedPoints[to].y);
                context.stroke();
            }

            renderedPoints.forEach((point, index) => {
                const radius = 7.5 + (Math.sin(time * 0.0018 + nodes[index].phase) + 1) * 1.5;
                if (nodes[index].isGuide) {
                    const halo = context.createRadialGradient(point.x, point.y, radius * 0.6, point.x, point.y, radius * 2.5);
                    halo.addColorStop(0, theme === 'dark' ? 'rgba(148, 163, 184, 0.55)' : 'rgba(15, 23, 42, 0.42)');
                    halo.addColorStop(1, theme === 'dark' ? 'rgba(148, 163, 184, 0)' : 'rgba(15, 23, 42, 0)');
                    context.fillStyle = halo;
                    context.beginPath();
                    context.arc(point.x, point.y, radius * 2.5, 0, Math.PI * 2);
                    context.fill();
                    context.beginPath();
                    context.arc(point.x, point.y, radius * 0.9, 0, Math.PI * 2);
                    context.fillStyle = '#020617';
                    context.fill();
                    context.strokeStyle = theme === 'dark' ? 'rgba(226, 232, 240, 0.9)' : 'rgba(15, 23, 42, 0.8)';
                    context.lineWidth = 1.5;
                    context.stroke();
                    return;
                }
                const glow = context.createRadialGradient(point.x - radius * 0.35, point.y - radius * 0.35, 1, point.x, point.y, radius * 2.5);
                glow.addColorStop(0, theme === 'dark' ? 'rgba(224, 242, 254, 0.8)' : 'rgba(255, 255, 255, 0.95)');
                glow.addColorStop(0.35, theme === 'dark' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(59, 130, 246, 0.42)');
                glow.addColorStop(1, theme === 'dark' ? 'rgba(56, 189, 248, 0)' : 'rgba(59, 130, 246, 0)');
                context.fillStyle = glow;
                context.beginPath();
                context.arc(point.x, point.y, radius * 2.5, 0, Math.PI * 2);
                context.fill();
            });
        };

        const animate = (time: number) => {
            draw(time);
            if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
        };
        const startAnimation = () => {
            window.cancelAnimationFrame(frame);
            if (reducedMotion.matches) draw(0);
            else frame = window.requestAnimationFrame(animate);
        };

        resize();
        startAnimation();
        window.addEventListener('resize', resize);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        reducedMotion.addEventListener('change', startAnimation);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerleave', onPointerLeave);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            reducedMotion.removeEventListener('change', startAnimation);
        };
    }, [openGuide, theme]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await api.login(user, pass);
        if (res.ok) {
            if (res.user) onLogin(res.user);
        } else {
            setError(res.reason || 'invalid_credentials');
        }
    };

    const errorText = error === 'password_reset_required'
        ? lang === 'uz' ? 'Standart admin paroli bloklangan. Yangi parol uchun administrator reset yo‘riqnomasiga amal qiling.' : lang === 'ru' ? 'Стандартный пароль администратора отключен. Задайте новый пароль по инструкции сброса в README.' : 'The default admin password is disabled. Set a new password using the reset steps in README.'
        : error === 'server_unavailable'
            ? lang === 'uz' ? 'Serverga ulanib bo‘lmadi.' : lang === 'ru' ? 'Не удалось подключиться к серверу.' : 'Could not connect to the server.'
            : lang === 'uz' ? 'Login yoki parol noto‘g‘ri.' : lang === 'ru' ? 'Неверный логин или пароль.' : 'Invalid username or password.';

    return (
        <div className="relative isolate min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-950 p-4 transition-colors">
            <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-auto absolute inset-0 h-full w-full touch-none" />
            <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                <label htmlFor="login-language" className="sr-only">{controlText.language}</label>
                <select
                    id="login-language"
                    value={lang}
                    onChange={event => setLang(event.target.value as Language)}
                    className="h-10 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-bold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                >
                    <option value="uz">UZ</option>
                    <option value="ru">RU</option>
                    <option value="en">EN</option>
                </select>
                <button
                    type="button"
                    aria-label={theme === 'light' ? controlText.dark : controlText.light}
                    title={theme === 'light' ? controlText.dark : controlText.light}
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
                </button>
            </div>
            <div className="relative z-10 w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-black italic text-xl shadow-lg shadow-blue-500/20">BL</div>
                    <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">MANAGEMENT</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Enterprise Access</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder={t.login}
                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm dark:text-white"
                        value={user}
                        onChange={e => setUser(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder={t.password}
                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm dark:text-white"
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                    />
                    {error && <p role="alert" className="text-red-600 text-xs font-semibold text-center">{errorText}</p>}
                    <button
                        type="submit"
                        className="w-full py-3.5 bg-slate-900 dark:bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-xl shadow-blue-500/10"
                    >
                        {t.enter}
                    </button>
                </form>
                <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">{controlText.dragHint}</p>
                <button
                    type="button"
                    onClick={openGuide}
                    className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
                >
                    <BookOpen size={13} />
                    {controlText.guide}
                </button>
            </div>
            {isGuideOpen && <UsageGuideModal lang={lang} onClose={closeGuide} />}
        </div>
    );
};
