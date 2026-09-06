import React, { useState } from 'react';
import { CivicReport } from '../types';

interface CivicGisMapProps {
  mode: 'citizen' | 'admin';
  reports: CivicReport[];
  onSelectReport?: (report: CivicReport) => void;
  title?: string;
  subtitle?: string;
}

export const CivicGisMap: React.FC<CivicGisMapProps> = ({
  mode,
  reports,
  onSelectReport,
  title,
  subtitle,
}) => {
  const [selectedPin, setSelectedPin] = useState<CivicReport | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Convert report coordinates or ID into normalized X/Y percentages (10% to 90%)
  const getPinCoordinates = (report: CivicReport, index: number) => {
    if (report.latitude && report.longitude) {
      // Scale lat/long around reference center
      const latRef = 21.1458;
      const lonRef = 79.0882;
      const x = 50 + ((report.longitude - lonRef) * 650);
      const y = 50 - ((report.latitude - latRef) * 650);
      return {
        x: Math.max(12, Math.min(88, x)),
        y: Math.max(12, Math.min(88, y)),
      };
    }

    // Deterministic position based on report ID hash
    let hash = 0;
    for (let i = 0; i < report.id.length; i++) {
      hash = (hash << 5) - hash + report.id.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    const x = 18 + (seed % 68) + ((index * 7) % 15);
    const y = 18 + ((seed >> 4) % 62) + ((index * 5) % 15);

    return {
      x: Math.max(12, Math.min(88, x)),
      y: Math.max(12, Math.min(88, y)),
    };
  };

  // Filter reports based on active mode & filter
  const visibleReports = reports.filter((r) => {
    if (activeFilter === 'all') return true;

    if (mode === 'citizen') {
      if (activeFilter === 'resolved') return r.status === 'RESOLVED';
      if (activeFilter === 'progress') return r.status === 'IN PROGRESS' || r.status === 'ASSIGNED';
      if (activeFilter === 'reported') return r.status === 'REPORTED';
    } else {
      if (activeFilter === 'critical') return r.priority === 'CRITICAL';
      if (activeFilter === 'high') return r.priority === 'HIGH';
      if (activeFilter === 'medium') return r.priority === 'MEDIUM';
      if (activeFilter === 'low') return r.priority === 'LOW';
    }
    return true;
  });

  // Get color for pin based on mode
  const getPinColor = (report: CivicReport) => {
    if (mode === 'citizen') {
      // Citizen mode: By Status
      if (report.status === 'RESOLVED') {
        return {
          bg: 'bg-emerald-500',
          border: 'border-emerald-300',
          ring: 'ring-emerald-400/40',
          label: 'Complete',
          icon: 'check_circle',
          textColor: 'text-emerald-500',
        };
      }
      if (report.status === 'IN PROGRESS' || report.status === 'ASSIGNED') {
        return {
          bg: 'bg-amber-500',
          border: 'border-amber-300',
          ring: 'ring-amber-400/40',
          label: 'In Progress',
          icon: 'construction',
          textColor: 'text-amber-500',
        };
      }
      return {
        bg: 'bg-indigo-600',
        border: 'border-indigo-300',
        ring: 'ring-indigo-400/40',
        label: 'Reported',
        icon: 'pending',
        textColor: 'text-indigo-600',
      };
    } else {
      // Admin mode: By Severity (Critical: Red, High: Orange, Medium: Yellow, Low: Green)
      if (report.priority === 'CRITICAL') {
        return {
          bg: 'bg-rose-600',
          border: 'border-rose-300',
          ring: 'ring-rose-500/50',
          label: 'Critical',
          icon: 'warning',
          textColor: 'text-rose-600',
        };
      }
      if (report.priority === 'HIGH') {
        return {
          bg: 'bg-orange-500',
          border: 'border-orange-300',
          ring: 'ring-orange-400/40',
          label: 'High',
          icon: 'priority_high',
          textColor: 'text-orange-500',
        };
      }
      if (report.priority === 'MEDIUM') {
        return {
          bg: 'bg-amber-400',
          border: 'border-amber-200',
          ring: 'ring-amber-300/40',
          label: 'Medium',
          icon: 'remove',
          textColor: 'text-amber-500',
        };
      }
      return {
        bg: 'bg-emerald-500',
        border: 'border-emerald-300',
        ring: 'ring-emerald-400/40',
        label: 'Low',
        icon: 'check',
        textColor: 'text-emerald-500',
      };
    }
  };

  return (
    <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Map Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {title || (mode === 'citizen' ? 'Live Community GIS Incident Map' : 'Municipal Severity Heatmap')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {subtitle ||
              (mode === 'citizen'
                ? 'Geolocated civic issue spots across municipal wards with status markers'
                : 'Priority triage map color-coded by hazard severity')}
          </p>
        </div>

        {/* Filter Controls on Map */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Spots ({reports.length})
          </button>

          {mode === 'citizen' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveFilter('resolved')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Resolved ({reports.filter((r) => r.status === 'RESOLVED').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('progress')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'progress'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>In Progress ({reports.filter((r) => r.status === 'IN PROGRESS' || r.status === 'ASSIGNED').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('reported')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'reported'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span>Reported ({reports.filter((r) => r.status === 'REPORTED').length})</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveFilter('critical')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'critical'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>Critical: Red ({reports.filter((r) => r.priority === 'CRITICAL').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('high')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'high'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-white text-orange-700 hover:bg-orange-50 border border-orange-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>High: Orange ({reports.filter((r) => r.priority === 'HIGH').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('medium')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'medium'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Medium: Yellow ({reports.filter((r) => r.priority === 'MEDIUM').length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('low')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeFilter === 'low'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Low: Green ({reports.filter((r) => r.priority === 'LOW').length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Map Interactive Canvas Viewport */}
      <div className="relative w-full h-80 sm:h-96 bg-slate-900 overflow-hidden select-none">
        {/* Dark Modern Vector Grid & Streets Simulation */}
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />

          {/* Simulated Municipal Roads & Transit Arteries (SVG) */}
          <svg className="absolute inset-0 w-full h-full stroke-slate-700/60 fill-none" xmlns="http://www.w3.org/2000/svg">
            {/* Main Corridors */}
            <path d="M 0 160 Q 200 140 400 200 T 800 240 T 1200 220" strokeWidth="6" className="stroke-slate-700" />
            <path d="M 0 160 Q 200 140 400 200 T 800 240 T 1200 220" strokeWidth="2" className="stroke-teal-900/50" />
            <path d="M 280 0 Q 320 200 360 400" strokeWidth="5" className="stroke-slate-700" />
            <path d="M 620 0 Q 580 200 640 400" strokeWidth="5" className="stroke-slate-700" />
            <path d="M 0 320 Q 300 280 600 330 T 1200 310" strokeWidth="4" className="stroke-slate-700" />

            {/* Municipal Ward Circles */}
            <circle cx="280" cy="170" r="90" strokeWidth="1" className="stroke-teal-500/20" strokeDasharray="4 4" />
            <circle cx="620" cy="220" r="110" strokeWidth="1" className="stroke-indigo-500/20" strokeDasharray="4 4" />
            <circle cx="450" cy="300" r="80" strokeWidth="1" className="stroke-amber-500/20" strokeDasharray="4 4" />
          </svg>

          {/* Municipal Ward Labels */}
          <div className="absolute top-12 left-16 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
            Zone 1 • North Sector
          </div>
          <div className="absolute top-20 right-20 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
            Zone 2 • Transit Corridor
          </div>
          <div className="absolute bottom-16 left-28 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
            Zone 3 • Central Ward
          </div>
          <div className="absolute bottom-20 right-36 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
            Zone 4 • Industrial Belt
          </div>

          {/* Empty State Overlay when no reports */}
          {visibleReports.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center mb-2 ring-4 ring-teal-500/20">
                <span className="material-symbols-outlined text-[24px]">explore</span>
              </div>
              <p className="text-white text-xs font-bold">No Issue Spots for Selected Filter</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Spots appear automatically as civic reports are registered.</p>
            </div>
          )}

          {/* Pin Spots */}
          {visibleReports.map((report, idx) => {
            const { x, y } = getPinCoordinates(report, idx);
            const style = getPinColor(report);
            const isSelected = selectedPin?.id === report.id;

            return (
              <div
                key={report.id}
                onClick={() => {
                  setSelectedPin(report);
                  if (onSelectReport) onSelectReport(report);
                }}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
              >
                {/* Ping / Radar ring animation for active/critical spots */}
                {((mode === 'citizen' && report.status !== 'RESOLVED') ||
                  (mode === 'admin' && report.priority === 'CRITICAL')) && (
                  <span
                    className={`absolute inset-0 rounded-full animate-ping opacity-75 ${
                      mode === 'admin' && report.priority === 'CRITICAL'
                        ? 'bg-rose-500'
                        : style.bg
                    }`}
                  />
                )}

                {/* Pin Head Spot */}
                <div
                  className={`w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg border-2 transition-all group-hover:scale-125 ${
                    style.bg
                  } ${style.border} ${isSelected ? 'scale-125 ring-4 ring-white' : ''}`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {style.icon}
                  </span>
                </div>

                {/* Spot Tag Badge */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
                  {report.id} • {style.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Map Control Buttons */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.25))}
            className="w-8 h-8 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 flex items-center justify-center shadow cursor-pointer border border-slate-700 active:scale-95"
            title="Zoom in"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.25))}
            className="w-8 h-8 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 flex items-center justify-center shadow cursor-pointer border border-slate-700 active:scale-95"
            title="Zoom out"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setSelectedPin(null);
            }}
            className="w-8 h-8 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 flex items-center justify-center shadow cursor-pointer border border-slate-700 active:scale-95"
            title="Reset view"
          >
            <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
          </button>
        </div>

        {/* Selected Pin Floating Card */}
        {selectedPin && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs z-30 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                {selectedPin.id}
              </span>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{selectedPin.title}</h4>
            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{selectedPin.location}</p>

            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs">
              <span
                className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                  mode === 'citizen'
                    ? selectedPin.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedPin.status === 'IN PROGRESS'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                    : selectedPin.priority === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800'
                    : selectedPin.priority === 'HIGH'
                    ? 'bg-orange-100 text-orange-800'
                    : selectedPin.priority === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {mode === 'citizen' ? selectedPin.status : `${selectedPin.priority} Priority`}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (onSelectReport) onSelectReport(selectedPin);
                }}
                className="text-teal-700 hover:text-teal-900 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer"
              >
                <span>Inspect</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 font-bold text-slate-700">
          <span className="material-symbols-outlined text-[16px] text-slate-500">legend_toggle</span>
          <span>Legend:</span>
        </div>

        {mode === 'citizen' ? (
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <span>Complete / Resolved</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
              <span>In Progress / Assigned</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200" />
              <span>Reported / Queued</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-rose-300" />
              <strong className="text-rose-700">Critical: Red</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-300" />
              <strong className="text-orange-700">High: Orange</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200" />
              <strong className="text-amber-700">Medium: Yellow</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
              <strong className="text-emerald-700">Low: Green</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
