import { BarChart3, CircleHelp, CreditCard, Loader2, LogOut, Moon, Search, Settings2, ShieldCheck, Sun } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AdminUsersView } from './components/AdminUsersView';
import { AnalyticsView } from './components/AnalyticsView';
import { ApartmentModal } from './components/ApartmentModal';
import { Dashboard } from './components/Dashboard';
import { DataManagementModal } from './components/DataManagementModal';
import { FloorPlanView } from './components/FloorPlanView';
import { InstallmentsManager } from './components/InstallmentsManager';
import { Layout } from './components/Layout';
import { LoginScreen } from './components/LoginScreen';
import { MapCanvas } from './components/MapCanvas';
import { SearchComponent } from './components/SearchComponent';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { UsageGuideModal, GuideContext } from './components/UsageGuideModal';
import { TRANSLATIONS } from './constants';
import { api } from './services/api';
import { Apartment, Block, Language, Theme, User, ViewState } from './types';

const API_URL = ((import.meta as any).env?.VITE_API_URL) || 'http://localhost:4000';
const isControlPath = () => window.location.pathname.replace(/\/+$/, '') === '/control';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('ru');
  const [theme, setTheme] = useState<Theme>('light');
  const [view, setView] = useState<ViewState>({ type: 'LOGIN' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [allApartments, setAllApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentApartment, setCurrentApartment] = useState<Apartment | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideContextOverride, setGuideContextOverride] = useState<GuideContext | null>(null);

  const t = TRANSLATIONS[lang];

  const refreshData = async () => {
    setLoading(true);
    try {
      const [b, a] = await Promise.all([api.getBlocks(), api.getApartments()]);
      setBlocks(b);
      setAllApartments(a);
    } finally {
      setLoading(false);
    }
  };

  const acceptLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'SUPERADMIN') {
      if (!isControlPath()) window.history.replaceState(null, '', '/control');
      setView({ type: 'CONTROL_PANEL' });
    } else {
      if (isControlPath()) window.history.replaceState(null, '', '/');
      setView({ type: 'DASHBOARD' });
      void refreshData();
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await api.getSession();
        if (!mounted) return;
        if (user) {
          if (user.role === 'SUPERADMIN') {
            if (!isControlPath()) window.history.replaceState(null, '', '/control');
            setCurrentUser(user);
            setView({ type: 'CONTROL_PANEL' });
          } else if (isControlPath()) {
            window.history.replaceState(null, '', '/');
            setCurrentUser(user);
            setView({ type: 'DASHBOARD' });
            await refreshData();
          } else {
            setCurrentUser(user);
            setView({ type: 'DASHBOARD' });
            await refreshData();
          }
        }
      } catch (e) {
        console.warn('Could not restore authenticated session', e);
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) setTheme(savedTheme);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const socket = io(API_URL, { withCredentials: true });
    socket.on('connect', () => console.log('[WS] Connected to server'));
    socket.on('data_updated', () => {
      console.log('[WS] Data updated, refreshing...');
      refreshData();
    });
    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  useEffect(() => {
    const onUnauthorized = () => {
      setCurrentUser(null);
      setIsDataModalOpen(false);
      setView({ type: 'LOGIN' });
    };
    window.addEventListener('blm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('blm:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const headerActions = (
    <div className="flex items-center gap-1">
      {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />}
      <button onClick={() => { setGuideContextOverride(null); setIsGuideOpen(true); }} title={lang === 'uz' ? 'Bu oynaning instruksiyasi' : lang === 'ru' ? 'Инструкция для этого окна' : 'Instructions for this window'} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-500 transition-colors"><CircleHelp size={16} /></button>
      <button onClick={() => setLang(l => l === 'ru' ? 'en' : l === 'en' ? 'uz' : 'ru')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black text-slate-500 transition-colors uppercase">{lang}</button>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
      {currentUser?.role !== 'VIEWER' && <button onClick={() => setIsDataModalOpen(true)} title={t.settings} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Settings2 size={16} /></button>}
      <button onClick={() => setView({ type: 'SEARCH' })} title={t.search} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Search size={16} /></button>
      <button onClick={() => setView({ type: 'INSTALLMENTS_MANAGER' })} title={t.installmentsManager} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><CreditCard size={16} /></button>
      <button onClick={() => setView({ type: 'ANALYTICS' })} title={t.analytics} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><BarChart3 size={16} /></button>
      {(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'HYPERADMIN') && <button onClick={() => setView({ type: 'ADMIN_USERS' })} title={lang === 'uz' ? 'Foydalanuvchilar' : lang === 'ru' ? 'Пользователи' : 'Users'} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-500 transition-colors"><ShieldCheck size={16} /></button>}
      <button onClick={async () => { try { await api.logout(); } finally { setCurrentUser(null); setIsDataModalOpen(false); setView({ type: 'LOGIN' }); } }} title="Log out" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
    </div>
  );

  const guideContext = view.type === 'CONTROL_PANEL'
    ? 'control'
    : view.type === 'MAP_EDITOR'
      ? 'map'
      : view.type === 'BLOCK_DETAILS'
        ? 'block'
        : view.type === 'FLOOR_DETAILS'
          ? 'floor'
          : view.type === 'SEARCH'
            ? 'search'
            : view.type === 'INSTALLMENTS_MANAGER'
              ? 'installments'
              : view.type === 'ANALYTICS'
                ? 'analytics'
                : view.type === 'ADMIN_USERS'
                  ? 'users'
                  : 'dashboard';

  const renderContent = () => {
    switch (view.type) {
      case 'LOGIN': return <LoginScreen onLogin={acceptLogin} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />;
      case 'CONTROL_PANEL': return (
        <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8">
          <header className="mx-auto mb-8 flex max-w-6xl items-center justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">BL Management</p>
              <h1 className="mt-1 text-xl font-black">{lang === 'uz' ? 'Super-admin boshqaruv paneli' : lang === 'ru' ? 'Панель суперадминистратора' : 'Super-admin control panel'}</h1>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="control-language" className="sr-only">{lang === 'uz' ? 'Til' : lang === 'ru' ? 'Язык' : 'Language'}</label>
              <select
                id="control-language"
                value={lang}
                onChange={event => setLang(event.target.value as Language)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="uz">UZ</option>
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
              <button
                type="button"
                onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
                title={theme === 'light'
                  ? lang === 'uz' ? 'Qorong‘i mavzu' : lang === 'ru' ? 'Тёмная тема' : 'Dark theme'
                  : lang === 'uz' ? 'Yorug‘ mavzu' : lang === 'ru' ? 'Светлая тема' : 'Light theme'}
                aria-label={theme === 'light'
                  ? lang === 'uz' ? 'Qorong‘i mavzuni yoqish' : lang === 'ru' ? 'Включить тёмную тему' : 'Enable dark theme'
                  : lang === 'uz' ? 'Yorug‘ mavzuni yoqish' : lang === 'ru' ? 'Включить светлую тему' : 'Enable light theme'}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button
                type="button"
                onClick={() => { setGuideContextOverride(null); setIsGuideOpen(true); }}
                title={lang === 'uz' ? 'Bu oynaning instruksiyasi' : lang === 'ru' ? 'Инструкция для этого окна' : 'Instructions for this window'}
                aria-label={lang === 'uz' ? 'Instruksiya' : lang === 'ru' ? 'Инструкция' : 'Instructions'}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <CircleHelp size={16} />
              </button>
              <button
                onClick={async () => { try { await api.logout(); } finally { setCurrentUser(null); setView({ type: 'LOGIN' }); } }}
                className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <LogOut size={14} />{lang === 'uz' ? 'Chiqish' : lang === 'ru' ? 'Выйти' : 'Log out'}
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-6xl">
            <SuperAdminPanel lang={lang} />
          </main>
        </div>
      );
      case 'DASHBOARD': return <Layout title={t.dashboard} actions={headerActions}><Dashboard blocks={blocks} apartments={allApartments} lang={lang} t={t} onNavigate={setView} onRefresh={refreshData} canWrite={currentUser?.role !== 'VIEWER'} /></Layout>;
      case 'MAP_EDITOR': return <Layout title={t.map} onBack={() => setView({ type: 'DASHBOARD' })} actions={headerActions}><div className="h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner overflow-hidden"><MapCanvas blocks={blocks} setBlocks={setBlocks} apartments={allApartments} onRefresh={refreshData} lang={lang} theme={theme} setTheme={setTheme} onBlockClick={(id) => setView({ type: 'BLOCK_DETAILS', blockId: id })} onFloorClick={(blockId, floor) => setView({ type: 'FLOOR_DETAILS', blockId, floor })} /></div></Layout>;
      case 'BLOCK_DETAILS':
        const block = blocks.find(b => b.id === view.blockId);
        if (!block) return null;
        return (
          <Layout title={block.name} onBack={() => setView({ type: 'DASHBOARD' })} actions={headerActions}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {Array.from({ length: block.floorsCount }, (_, i) => block.floorsCount - i).map(floor => (
                <button key={floor} onClick={() => setView({ type: 'FLOOR_DETAILS', blockId: block.id, floor })} style={{ animationDelay: `${Math.min((block.floorsCount - floor) * 35, 280)}ms` }} className="animate-in fade-in slide-in-from-bottom-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center hover:border-blue-500 transition-all shadow-sm group active:scale-95">
                  <p className="text-2xl font-black text-slate-800 dark:text-white mb-1">{floor}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.floors}</p>
                </button>
              ))}
            </div>
          </Layout>
        );
      case 'FLOOR_DETAILS':
        const fb = blocks.find(b => b.id === view.blockId);
        if (!fb) return null;
        const apts = allApartments.filter(a => a.blockId === fb.id && a.floor === view.floor);
        return (
          <Layout title={`${fb.name} • ${t.floors} ${view.floor}`} onBack={() => setView({ type: 'BLOCK_DETAILS', blockId: fb.id })} actions={headerActions}>
            <FloorPlanView
              apartments={apts}
              lang={lang}
              isReadOnly={currentUser?.role === 'VIEWER'}
              onApartmentClick={setCurrentApartment}
              onApartmentSaved={async apartment => {
                const savedApartment = await api.saveApartment(apartment);
                setAllApartments(current => current.map(item => item.id === savedApartment.id ? savedApartment : item));
              }}
            />
            {currentApartment && <ApartmentModal apartment={currentApartment} lang={lang} readOnly={currentUser?.role === 'VIEWER'} onGuide={() => { setGuideContextOverride('apartment'); setIsGuideOpen(true); }} onClose={() => setCurrentApartment(null)} onSave={async (u) => { try { await api.saveApartment(u); setCurrentApartment(null); await refreshData(); } catch (e: any) { alert(e?.message || 'Save failed'); } }} />}
          </Layout>
        );
      case 'SEARCH': return <Layout title={t.search} onBack={() => setView({ type: 'DASHBOARD' })} actions={headerActions}><SearchComponent t={t} allApartments={allApartments} onSelectApt={setCurrentApartment} /></Layout>;
      case 'INSTALLMENTS_MANAGER': return <Layout title={t.installmentsManager} onBack={() => setView({ type: 'DASHBOARD' })} actions={headerActions}><InstallmentsManager apartments={allApartments} t={t} onRefresh={refreshData} canWrite={currentUser?.role !== 'VIEWER'} /></Layout>;
      case 'ANALYTICS': return <Layout title={t.analytics} onBack={() => setView({ type: 'DASHBOARD' })} actions={headerActions}><AnalyticsView blocks={blocks} apartments={allApartments} t={t} onSelectApt={setCurrentApartment} /></Layout>;
      case 'ADMIN_USERS': return currentUser?.role === 'HYPERADMIN' ? <Layout title={lang === 'uz' ? 'Kompaniya foydalanuvchilari' : lang === 'ru' ? 'Пользователи компании' : 'Company users'} onBack={() => setView({ type: 'DASHBOARD' })} actions={headerActions}><AdminUsersView currentUser={currentUser} lang={lang} /></Layout> : null;
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans selection:bg-blue-500/20">
      {!currentUser ? <LoginScreen onLogin={acceptLogin} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} /> : <>{renderContent()}
      {isDataModalOpen && <DataManagementModal onClose={() => setIsDataModalOpen(false)} lang={lang} onImport={refreshData} canExport={currentUser.role !== 'VIEWER'} canImport={currentUser.role === 'SUPERADMIN'} canReset={currentUser.role === 'HYPERADMIN'} onGuide={() => { setGuideContextOverride('settings'); setIsGuideOpen(true); }} />}
      {currentApartment && view.type === 'SEARCH' && <ApartmentModal apartment={currentApartment} lang={lang} readOnly={currentUser.role === 'VIEWER'} onGuide={() => { setGuideContextOverride('apartment'); setIsGuideOpen(true); }} onClose={() => setCurrentApartment(null)} onSave={async (u) => { try { await api.saveApartment(u); setCurrentApartment(null); await refreshData(); } catch (e: any) { alert(e?.message || 'Save failed'); } }} />}
      {isGuideOpen && <UsageGuideModal lang={lang} context={guideContextOverride || (guideContext as GuideContext)} onClose={() => { setIsGuideOpen(false); setGuideContextOverride(null); }} />}</>}
    </div>
  );
};

export default App;
