import React, { useState } from 'react';
import { CivicReport, TabType } from '../types';

interface MyReportsTrackingViewProps {
  reports: CivicReport[];
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onUpvoteReport: (id: string) => void;
  onUpdateReportStatus: (id: string, newStatus: CivicReport['status']) => void;
  onAddComment: (reportId: string, text: string) => void;
}

export const MyReportsTrackingView: React.FC<MyReportsTrackingViewProps> = ({
  reports,
  onNavigate,
  onShowToast,
  onUpvoteReport,
  onAddComment,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCommentText, setActiveCommentText] = useState<Record<string, string>>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchLoc = r.location.toLowerCase().includes(q);
      const matchDept = r.department.toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchLoc && !matchDept) return false;
    }

    if (filter === 'active') return r.status !== 'RESOLVED';
    if (filter === 'resolved') return r.status === 'RESOLVED';
    return true;
  });

  const activeReport =
    reports.find((r) => r.id === selectedReportId) || filteredReports[0] || reports[0];

  const handlePostComment = (reportId: string) => {
    const text = activeCommentText[reportId];
    if (!text || !text.trim()) return;

    onAddComment(reportId, text.trim());
    setActiveCommentText((prev) => ({ ...prev, [reportId]: '' }));
    onShowToast('Citizen note added to public municipal audit trail', 'chat');
  };

  return (
    <div className="flex flex-col w-full gap-5 pb-28 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col gap-4 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-label-badge text-xs uppercase tracking-wider text-teal-800 font-bold bg-teal-50 px-3 py-1 rounded-full border border-teal-200/80">
              Municipal Resolution Ledger
            </span>
            <h1 className="font-headline-lg text-2xl sm:text-3xl text-slate-900 font-bold tracking-tight mt-2">
              Citizen Report Tracking
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 px-3.5 py-1.5 rounded-full text-teal-800 font-label-code text-xs font-bold w-fit border border-teal-200">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            <span>Telemetry Synchronized</span>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          Track each civic resolution step from optical AI capture and departmental triage to field crew dispatch and verified resolution.
        </p>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <div className="relative flex-1 flex items-center">
            <span className="material-symbols-outlined text-[20px] text-slate-400 absolute left-3.5 pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Find report by ID (CIV-2026-XXXXX), street, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-slate-900 text-sm pl-10 pr-10 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'active' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({reports.filter((r) => r.status !== 'RESOLVED').length})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === 'resolved' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resolved ({reports.filter((r) => r.status === 'RESOLVED').length})
            </button>
          </div>
        </div>
      </div>

      {/* When ZERO Reports exist: Clean empty state */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-[32px] p-8 sm:p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center max-w-lg mx-auto my-4 w-full">
          <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4 ring-8 ring-teal-50/50">
            <span className="material-symbols-outlined text-[32px]">receipt_long</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Reports Filed Yet</h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-2 leading-relaxed max-w-md">
            You haven't submitted any civic issue reports yet. Reports you file will appear here with an interactive, real-time audit resolution timeline.
          </p>
          <button
            onClick={() => onNavigate('report-issue-flow')}
            className="mt-6 px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
            <span>Report an Issue</span>
          </button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <p className="text-slate-500 text-sm">No reports match your search query "{searchQuery}".</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilter('all');
            }}
            className="mt-3 text-xs text-teal-700 font-bold hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Reports List */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Select Ticket to Inspect ({filteredReports.length})
            </span>
            {filteredReports.map((report) => {
              const isSelected = (activeReport && activeReport.id === report.id) || false;
              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-700 ring-1 ring-teal-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {report.imageUrl ? (
                      <img src={report.imageUrl} alt={report.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-[24px]">image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-label-code text-[11px] font-bold text-teal-900 bg-teal-100/70 px-2 py-0.5 rounded">
                          {report.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            report.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : report.status === 'IN PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {report.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs truncate">{report.title}</h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{report.location}</p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>{report.category}</span>
                      <span>{report.timestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Live Audit Timeline for Selected Report */}
          {activeReport && (
            <div className="lg:col-span-7 bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-code text-sm font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg">
                      {activeReport.id}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        activeReport.status === 'RESOLVED'
                          ? 'bg-emerald-500 text-white'
                          : activeReport.status === 'IN PROGRESS'
                          ? 'bg-amber-500 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {activeReport.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mt-1">{activeReport.title}</h3>
                  <p className="text-xs text-slate-500">{activeReport.location} • {activeReport.ward}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onUpvoteReport(activeReport.id)}
                  className={`self-start px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeReport.hasUpvoted
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                  <span>{activeReport.upvotes || 0} Priority Upvotes</span>
                </button>
              </div>

              {/* Photographic Visual Evidence */}
              {activeReport.imageUrl && (
                <div className="h-52 w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 relative">
                  <img
                    src={activeReport.imageUrl}
                    alt={activeReport.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-lg text-white text-[11px] font-label-code">
                    AI Confidence: {activeReport.confidenceScore}% • {activeReport.priority} Priority
                  </div>
                </div>
              )}

              {/* Department & Description */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center font-semibold text-slate-700">
                  <span>Routing Authority:</span>
                  <span className="text-teal-800 font-bold">{activeReport.department}</span>
                </div>
                {activeReport.assignedCrew && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Dispatched Crew:</span>
                    <span className="font-bold text-amber-800">{activeReport.assignedCrew}</span>
                  </div>
                )}
                <p className="text-slate-600 pt-1 leading-relaxed border-t border-slate-200/60">
                  {activeReport.description}
                </p>
              </div>

              {/* Multi-Step Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Audit Lifecycle Timeline
                </h4>
                <div className="relative pl-6 space-y-4 border-l-2 border-teal-200 ml-2">
                  {activeReport.auditTrail.map((step, idx) => (
                    <div key={step.id || idx} className="relative">
                      <span
                        className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                          step.isComplete ? 'bg-teal-700' : 'bg-slate-300'
                        }`}
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{step.stage}</span>
                        <span className="text-[10px] text-slate-400 font-label-code">{step.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Citizen Notes & Comments */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Citizen & Authority Notes ({activeReport.comments?.length || 0})
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeReport.comments?.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs">
                      <div className="flex items-center justify-between font-semibold mb-1">
                        <span className="text-slate-900 font-bold">{c.author}</span>
                        <span className="text-[10px] text-slate-400">{c.timestamp}</span>
                      </div>
                      <p className="text-slate-600">{c.text}</p>
                    </div>
                  ))}
                </div>

                {/* Add Comment Input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add an inspection note or update..."
                    value={activeCommentText[activeReport.id] || ''}
                    onChange={(e) =>
                      setActiveCommentText((prev) => ({ ...prev, [activeReport.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePostComment(activeReport.id);
                    }}
                    className="flex-1 bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => handlePostComment(activeReport.id)}
                    className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    Post Note
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
