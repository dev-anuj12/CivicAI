import React, { useRef } from 'react';
import { TabType, UserProfile, UserRole } from '../types';
import { CIVIC_LOGO_URL } from '../data/mockData';

interface HeaderProps {
  currentTab: TabType;
  userRole: UserRole;
  currentUser: UserProfile | null;
  onRoleChange: (role: UserRole) => void;
  onShowToast: (msg: string, icon?: string) => void;
  unreadNotifs: boolean;
  onClearNotifs: () => void;
  onOpenProfile: () => void;
  onGoBack?: () => void;
  onUnlockAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  userRole,
  currentUser,
  onRoleChange,
  onShowToast,
  unreadNotifs,
  onClearNotifs,
  onOpenProfile,
  onGoBack,
  onUnlockAdmin,
}) => {
  const isReportFlow = currentTab === 'report-issue-flow';

  // Secret 5-click logo trigger for authorized administrators
  const logoClickCountRef = useRef(0);
  const logoClickTimerRef = useRef<any>(null);

  const handleLogoClick = () => {
    logoClickCountRef.current += 1;
    if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current);

    if (logoClickCountRef.current >= 5) {
      logoClickCountRef.current = 0;
      if (onUnlockAdmin) {
        onUnlockAdmin();
      }
    } else {
      logoClickTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
      }, 2500);
      onShowToast('CivicAI • One Platform. Every Civic Issue.', 'verified');
    }
  };

  let subtitle = 'Citizen Portal';
  if (currentTab === 'report-issue-flow') subtitle = 'Report Civic Issue';
  else if (currentTab === 'my-reports-tracking') subtitle = 'My Reports & Tracking';
  else if (currentTab === 'admin-command-center' || userRole === 'admin') subtitle = 'Municipal Command Center';

  // Real user initials
  const initials = currentUser?.fullName
    ? currentUser.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'G';

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl shadow-xs border-b border-slate-200/80 pt-safe transition-all">
      <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isReportFlow && (
            <button
              aria-label="Go back"
              className="w-9 h-9 -ml-1 flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0 border border-slate-200/60"
              onClick={onGoBack}
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}
          <img
            alt="CivicAI Logo"
            className="h-8 w-auto object-contain shrink-0 cursor-pointer select-none active:scale-95 transition-transform"
            src={CIVIC_LOGO_URL}
            onClick={handleLogoClick}
            title="CivicAI • Unified Citizen Platform"
          />
          <div className="flex flex-col min-w-0 truncate">
            <span className="font-headline-md text-base sm:text-lg text-slate-900 font-bold tracking-tight leading-tight">
              CivicAI
            </span>
            <span className="font-label-badge text-[11px] text-teal-800 font-semibold leading-none truncate">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Admin Mode Badge & Exit Switcher (ONLY visible when authenticated as Admin) */}
          {userRole === 'admin' ? (
            <div className="flex items-center bg-amber-50 border border-amber-300 rounded-full px-3 py-1 gap-2 shadow-xs animate-in fade-in">
              <span className="flex items-center gap-1 text-amber-900 text-xs font-bold font-label-badge">
                <span className="material-symbols-outlined text-[16px] text-amber-700">shield_person</span>
                <span>Super Admin</span>
              </span>
              <button
                type="button"
                className="text-[11px] text-amber-800 hover:text-amber-950 font-bold cursor-pointer underline ml-1"
                onClick={() => onRoleChange('citizen')}
              >
                Exit Admin
              </button>
            </div>
          ) : null}

          {/* Notifications Bell */}
          <button
            aria-label="Notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-colors cursor-pointer border border-slate-200/60"
            onClick={onClearNotifs}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadNotifs && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Citizen Profile Button */}
          <button
            aria-label="Citizen Profile"
            className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform cursor-pointer shadow-xs text-xs font-bold tracking-wider ${
              currentUser
                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
            onClick={onOpenProfile}
            title={currentUser ? `Signed in as ${currentUser.fullName}` : 'Sign In / Register'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {currentUser ? 'account_circle' : 'login'}
            </span>
            <span className="hidden sm:inline font-medium text-[11px]">
              {currentUser ? currentUser.fullName.split(' ')[0] : 'Sign In'}
            </span>
            {currentUser && <span className="sm:hidden font-bold text-[10px]">{initials}</span>}
          </button>
        </div>
      </div>
    </header>
  );
};
