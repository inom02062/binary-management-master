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
    <div className="h-dvh min-h-0 overflow-hidden bg-[#f5f5f7] text-slate-800 dark:bg-[#090b10] dark:text-slate-100 flex flex-col w-full mx-auto transition-colors duration-200">
      <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200/70 bg-white/85 backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-950/85 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="layout-header-inner mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="layout-header-title flex min-w-0 items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Go back"
                className="layout-back-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="layout-title-divider h-7 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
            <h1 className="truncate text-lg font-black tracking-tight text-slate-800 dark:text-white">{title}</h1>
          </div>

          <div className="layout-header-actions flex min-w-0 items-center gap-2">
            {actions}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain w-full custom-scrollbar">
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};