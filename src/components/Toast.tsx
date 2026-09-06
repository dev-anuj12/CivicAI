import React from 'react';

interface ToastProps {
  message: string | null;
  icon?: string;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = 'task_alt', onDismiss }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-22 left-4 right-4 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-inverse-surface text-inverse-on-surface p-3.5 rounded-xl shadow-2xl flex items-center justify-between border border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-outlined text-secondary-fixed text-[22px] shrink-0">{icon}</span>
          <span className="font-headline-md text-xs leading-snug truncate">{message}</span>
        </div>
        <button
          className="text-inverse-on-surface/70 hover:text-white p-1 cursor-pointer shrink-0 ml-2"
          onClick={onDismiss}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
};
