import React from 'react';

interface CivicLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CivicLogo: React.FC<CivicLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  onClick,
}) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-base', sub: 'text-[9px]' },
    md: { icon: 'w-9 h-9', text: 'text-lg', sub: 'text-[10px]' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${className}`}
    >
      {/* Vector Logo Emblem */}
      <div className={`${currentSize.icon} shrink-0 relative flex items-center justify-center`}>
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-xs">
          <defs>
            <linearGradient id="logoEmblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0D9488" />
              <stop offset="50%" stopColor="#0F766E" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
            <linearGradient id="logoEmblemAccent" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          {/* Hexagon / Shield Base */}
          <rect x="4" y="4" width="92" height="92" rx="28" fill="url(#logoEmblemGrad)" />

          {/* City Architecture Silhouette */}
          <path d="M22 74 V50 H36 V34 H50 V44 H64 V56 H78 V74 Z" fill="#ffffff" fillOpacity="0.22" />

          {/* Neural AI Vector Route */}
          <path
            d="M26 68 L42 50 L54 58 L72 36"
            stroke="url(#logoEmblemAccent)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Intelligence Nodes */}
          <circle cx="26" cy="68" r="5" fill="#34D399" />
          <circle cx="42" cy="50" r="5" fill="#38BDF8" />
          <circle cx="54" cy="58" r="5" fill="#34D399" />
          <circle cx="72" cy="36" r="6" fill="#FFFFFF" stroke="#0D9488" strokeWidth="2.5" />

          {/* AI Spark Star */}
          <path d="M72 20 L74.5 26 L81 28 L74.5 30 L72 36 L69.5 30 L63 28 L69.5 26 Z" fill="#FDE047" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className={`font-bold tracking-tight text-slate-900 leading-tight ${currentSize.text}`}>
            Civic<span className="text-teal-700">AI</span>
          </div>
          <span className={`font-bold uppercase tracking-wider text-teal-800 leading-none ${currentSize.sub}`}>
            Civic Intelligence
          </span>
        </div>
      )}
    </div>
  );
};
