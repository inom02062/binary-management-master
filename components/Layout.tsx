import { ArrowLeft } from 'lucide-react';
import React from 'react';

interface LayoutProps {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ title, onBack, children, actions }) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_35%),linear-gradient(to_bottom,_#f8fafc,_#eef4ff_40%,_#f8fafc)] dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.12),_transparent_28%),linear-gradient(to_bottom,_#020817,_#0f172a_35%,_#020817)] text-slate-800 dark:text-slate-100 flex flex-col w-full mx-auto transition-colors duration-200">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
            <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {actions}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};