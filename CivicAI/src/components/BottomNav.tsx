import React from 'react';
import { TabType, UserRole } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  userRole: UserRole;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, userRole, onSelectTab }) => {
  const isAdmin = userRole === 'admin';

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-white/95 backdrop-blur-xl shadow-[0_-4px_16px_rgba(15,23,42,0.06)] border-t border-slate-200/80">
      <div className={`max-w-md mx-auto flex items-center ${isAdmin ? 'justify-around' : 'justify-evenly'} h-16 px-4`}>
        {/* Home */}
        <button
          type="button"
          aria-current={currentTab === 'citizen-portal' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-all cursor-pointer ${
            currentTab === 'citizen-portal' ? 'text-teal-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => onSelectTab('citizen-portal')}
        >
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="font-label-badge text-[11px] font-semibold mt-0.5">Home</span>
        </button>

        {/* Report (Prominent Bento Trigger) */}
        <button
          type="button"
          className="relative -top-3 flex flex-col items-center justify-center min-w-[56px] min-h-[44px] group cursor-pointer"
          onClick={() => onSelectTab('report-issue-flow')}
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(15,118,110,0.35)] transition-all group-hover:scale-105 group-active:scale-95 border-2 border-white">
            <span className="material-symbols-outlined text-[24px]">photo_camera</span>
          </div>
          <span
            className={`font-label-badge text-[11px] mt-1 font-bold ${
              currentTab === 'report-issue-flow' ? 'text-teal-700' : 'text-slate-700'
            }`}
          >
            Report
          </span>
        </button>

        {/* My Reports */}
        <button
          type="button"
          aria-current={currentTab === 'my-reports-tracking' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-all cursor-pointer ${
            currentTab === 'my-reports-tracking' ? 'text-teal-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => onSelectTab('my-reports-tracking')}
        >
          <span className="material-symbols-outlined text-[24px]">receipt_long</span>
          <span className="font-label-badge text-[11px] font-semibold mt-0.5">My Reports</span>
        </button>

        {/* Admin Command Center (ONLY visible when authenticated as admin) */}
        {isAdmin && (
          <button
            type="button"
            aria-current={currentTab === 'admin-command-center' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-all cursor-pointer animate-in fade-in ${
              currentTab === 'admin-command-center' ? 'text-amber-700 font-bold scale-105' : 'text-amber-600 hover:text-amber-900'
            }`}
            onClick={() => onSelectTab('admin-command-center')}
          >
            <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
            <span className="font-label-badge text-[11px] font-bold mt-0.5">Admin Hub</span>
          </button>
        )}
      </div>
    </nav>
  );
};
