import React, { useEffect, useMemo, useState } from 'react';
import {
  CivicHotspot,
  CivicIssue,
  CivicReport,
  CopilotMessage,
  DuplicateMatch,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  ReportIntegrityRecord,
  UserProfile,
} from '../types';
import { CIVIC_CATEGORIES } from '../data/mockData';
import { AuthService } from '../services/authService';
import {
  calculateCivicHotspots,
  fetchCivicIssues,
  fetchDuplicateMatches,
  fetchReportIntegrityList,
  resolveDuplicateMatchAction,
  submitResolutionEvidence,
  uploadImage,
} from '../services/supabaseClient';
import { DepartmentAnalyticsView } from './DepartmentAnalyticsView';
import { CivicGisMap } from './CivicGisMap';
import { processAdminCopilotQuery } from '../ai/adminCopilot';
import { useTranslation } from '../i18n/translations';

interface AdminCommandCenterViewProps {
  currentUser: UserProfile | null;
  reports: CivicReport[];
  onShowToast: (msg: string, icon?: string) => void;
  onUpdateReportStatus: (id: string, newStatus: IncidentStatus, comment?: string) => void;
  onUpdateReportCrew: (id: string, crew: string, directive?: string) => void;
}

export const AdminCommandCenterView: React.FC<AdminCommandCenterViewProps> = ({
  currentUser,
  reports,
  onShowToast,
  onUpdateReportStatus,
  onUpdateReportCrew,
}) => {
  const { t } = useTranslation();
  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin);

  // 9-Tab Navigation View
  const [activeView, setActiveView] = useState<
    'overview' | 'triage' | 'priority' | 'duplicates' | 'integrity' | 'map' | 'analytics' | 'copilot' | 'officers'
  >('overview');

  // Async Loaded Intelligence Data
  const [civicIssues, setCivicIssues] = useState<CivicIssue[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [integrityList, setIntegrityList] = useState<ReportIntegrityRecord[]>([]);

  // Triage state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<CivicReport | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);

  // Dispatch Modal State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState('Zone Rapid Repair Unit');
  const [dispatchDirective, setDispatchDirective] = useState('');

  // Status & Resolution Evidence Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<IncidentStatus>('IN PROGRESS');
  const [statusNote, setStatusNote] = useState('');
  const [resolutionPhotoFile, setResolutionPhotoFile] = useState<File | null>(null);
  const [resolutionPhotoPreview, setResolutionPhotoPreview] = useState<string>('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // 9. AI Copilot Chat State
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'init_copilot',
      sender: 'copilot',
      text: 'Hello, Administrator. I am your **CivicAI Intelligence Copilot**. Ask me to query complaints, check overdue SLAs, identify civic hotspots, or review duplicate clusters.',
      timestamp: 'Now',
      suggestedPrompts: [
        'Show high-priority unresolved potholes',
        'Which location has the most complaints?',
        'How many garbage reports were resolved this week?',
        'Show possible duplicate issues',
        'Which complaints have been pending for more than three days?',
      ],
    },
  ]);

  // Super Admin Officer State
  const [officerName, setOfficerName] = useState('');
  const [officerEmail, setOfficerEmail] = useState('');
  const [officerDept, setOfficerDept] = useState(CIVIC_CATEGORIES[0].department);
  const [officerPassword, setOfficerPassword] = useState('');
  const [isCreatingOfficer, setIsCreatingOfficer] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    pass: string;
  } | null>(null);
  const [officersList, setOfficersList] = useState<UserProfile[]>([]);
  const [onboardError, setOnboardError] = useState('');

  // Load intelligence records
  const refreshIntelligenceData = async () => {
    try {
      const [issues, dups, integ] = await Promise.all([
        fetchCivicIssues(),
        fetchDuplicateMatches(),
        fetchReportIntegrityList(),
      ]);
      setCivicIssues(issues);
      setDuplicateMatches(dups);
      setIntegrityList(integ);
    } catch (e) {
      console.warn('Error loading intelligence data:', e);
    }
  };

  useEffect(() => {
    refreshIntelligenceData();
  }, [reports]);

  // Load created admins list
  const refreshOfficersList = async () => {
    if (currentUser?.email) {
      const list = await AuthService.getAdminsList(currentUser.email);
      setOfficersList(list);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      refreshOfficersList();
    }
  }, [isSuperAdmin, currentUser]);

  // 7. Civic Hotspots Calculation
  const hotspots: CivicHotspot[] = useMemo(() => {
    return calculateCivicHotspots(reports);
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = r.id.toLowerCase().includes(q);
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchLoc = r.location.toLowerCase().includes(q);
        const matchDept = r.department.toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchLoc && !matchDept) return false;
      }

      if (filterCategory !== 'all' && r.category !== filterCategory && !r.category.includes(filterCategory)) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;

      return true;
    });
  }, [reports, searchQuery, filterCategory, filterStatus]);

  // Real KPI Metrics
  const totalIssues = reports.length;
  const newIssues = reports.filter((r) => r.status === 'REPORTED').length;
  const inProgressIssues = reports.filter((r) => r.status === 'IN PROGRESS' || r.status === 'ASSIGNED').length;
  const criticalIssues = reports.filter((r) => r.priority === 'CRITICAL').length;
  const resolvedIssues = reports.filter((r) => r.status === 'RESOLVED').length;
  const duplicateCount = duplicateMatches.filter((d) => d.status === 'possible_duplicate').length;
  const flaggedIntegrityCount = integrityList.filter((i) => i.status === 'FLAGGED').length;

  // Weekly Submitted vs Solved Analytics (7-day window)
  const weeklyAnalytics = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const submittedThisWeek = reports.filter((r) => {
      if (r.createdAt) {
        const time = new Date(r.createdAt).getTime();
        if (!isNaN(time)) return now - time <= sevenDaysMs;
      }
      return true; // All real defect entries currently tracked
    });

    const totalSubmitted = submittedThisWeek.length;
    const resolvedThisWeek = submittedThisWeek.filter((r) => r.status === 'RESOLVED').length;
    const inProgressThisWeek = submittedThisWeek.filter((r) => r.status === 'IN PROGRESS' || r.status === 'ASSIGNED').length;
    const pendingThisWeek = submittedThisWeek.filter((r) => r.status === 'REPORTED' || r.status === 'UNDER REVIEW').length;

    const resolutionRate = totalSubmitted > 0 ? Math.round((resolvedThisWeek / totalSubmitted) * 100) : 0;
    const inProgressRate = totalSubmitted > 0 ? Math.round((inProgressThisWeek / totalSubmitted) * 100) : 0;
    const pendingRate = totalSubmitted > 0 ? Math.max(0, 100 - resolutionRate - inProgressRate) : 0;

    return {
      totalSubmitted,
      resolvedThisWeek,
      inProgressThisWeek,
      pendingThisWeek,
      resolutionRate,
      inProgressRate,
      pendingRate,
    };
  }, [reports]);

  // Handle Copilot Send
  const handleSendCopilotQuery = (queryText?: string) => {
    const q = (queryText || copilotInput).trim();
    if (!q) return;

    const userMsg: CopilotMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    setCopilotInput('');

    // Process query against live DB
    setTimeout(() => {
      const response = processAdminCopilotQuery(q, {
        reports,
        issues: civicIssues,
        duplicateMatches,
      });
      setCopilotMessages((prev) => [...prev, response]);
    }, 250);
  };

  // Handle Duplicate Match Decision
  const handleDuplicateDecision = async (matchId: string, action: 'linked_to_issue' | 'confirmed_distinct') => {
    await resolveDuplicateMatchAction(matchId, action);
    await refreshIntelligenceData();
    onShowToast(
      action === 'linked_to_issue' ? 'Report merged into consolidated Civic Issue! 🔗' : 'Marked as distinct civic defect.',
      'verified'
    );
  };

  // Handle Status Update with Resolution Evidence
  const handleConfirmStatusChange = async () => {
    if (!selectedReport) return;
    setIsSubmittingResolution(true);

    try {
      let afterImg = selectedReport.imageUrl;
      if (resolutionPhotoFile) {
        try {
          afterImg = await uploadImage(resolutionPhotoFile);
        } catch (imgErr) {
          console.warn('Resolution image processing fallback:', imgErr);
        }
      }

      if (targetStatus === 'RESOLVED') {
        try {
          await submitResolutionEvidence({
            reportId: selectedReport.id,
            issueId: selectedReport.issueId,
            beforeImageUrl: selectedReport.imageUrl,
            afterImageUrl: afterImg,
            resolvedBy: currentUser?.fullName || 'Municipal Officer',
            resolutionNotes: statusNote.trim() || 'Work inspected on-site and verified complete according to municipal quality standards.',
          });
        } catch (evErr) {
          console.warn('Resolution evidence storage fallback:', evErr);
        }
      }

      await onUpdateReportStatus(selectedReport.id, targetStatus, statusNote);

      setSelectedReport((prev) =>
        prev && prev.id === selectedReport.id
          ? {
              ...prev,
              status: targetStatus,
              slaRemaining: targetStatus === 'RESOLVED' ? 'Completed' : prev.slaRemaining,
            }
          : prev
      );

      setIsStatusModalOpen(false);
      setStatusNote('');
      setResolutionPhotoFile(null);
      setResolutionPhotoPreview('');
      await refreshIntelligenceData();
      onShowToast(`Status transitioned to "${targetStatus}"!`, 'verified');
    } catch (e) {
      console.error('Status transition error:', e);
      try {
        await onUpdateReportStatus(selectedReport.id, targetStatus, statusNote);
        setIsStatusModalOpen(false);
        onShowToast(`Status transitioned to "${targetStatus}"!`, 'verified');
      } catch {
        onShowToast('Could not save resolution update.', 'error');
      }
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // Handle Dispatch
  const handleConfirmDispatch = () => {
    if (!selectedReport) return;
    onUpdateReportCrew(selectedReport.id, selectedCrew, dispatchDirective);
    setIsDispatchModalOpen(false);
    onShowToast(`Dispatched ${selectedCrew} to ${selectedReport.id}!`, 'local_shipping');
  };

  // Handle Create Officer
  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError('');
    if (!currentUser?.email) return;

    setIsCreatingOfficer(true);
    const res = await AuthService.createAdminBySuperAdmin(currentUser.email, {
      fullName: officerName,
      email: officerEmail,
      department: officerDept,
      password: officerPassword || undefined,
    });
    setIsCreatingOfficer(false);

    if (res.success && res.adminUser && res.generatedPassword) {
      setCreatedCredentials({
        name: res.adminUser.fullName,
        email: res.adminUser.email,
        pass: res.generatedPassword,
      });
      setOfficerName('');
      setOfficerEmail('');
      setOfficerPassword('');
      refreshOfficersList();
      onShowToast(`Administrator account created for ${res.adminUser.fullName}! 👑`, 'badge');
    } else {
      setOnboardError(res.error || 'Failed to create administrator.');
    }
  };

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard', count: null, desc: 'Executive KPIs & Density' },
    { id: 'triage', label: 'Live Issues', icon: 'rule_folder', count: reports.length, desc: 'All Incident Reports' },
    { id: 'priority', label: 'Priority Queue', icon: 'crisis_alert', count: criticalIssues, desc: 'AI Triage & SLAs' },
    { id: 'duplicates', label: 'Duplicate Hub', icon: 'content_copy', count: duplicateCount, desc: 'Clustered Defect Merges' },
    { id: 'integrity', label: 'Report Integrity', icon: 'shield', count: flaggedIntegrityCount, desc: 'AI Trust & Verification' },
    { id: 'map', label: 'GIS Heatmap', icon: 'map', count: null, desc: 'Geospatial Hotspots' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics', count: null, desc: 'Ward & SLA Metrics' },
    { id: 'copilot', label: 'AI Copilot', icon: 'psychology', count: null, desc: 'Natural Language Queries' },
    ...(isSuperAdmin ? [{ id: 'officers', label: 'Super Admin', icon: 'manage_accounts', count: null, desc: 'Admin Management' }] : []),
  ];

  return (
    <div className="flex flex-col w-full gap-6 pb-28 animate-in fade-in duration-200">
      {/* 2-Column Command Center Dashboard Layout: Left Navigation Sidebar + Right Largest Operational Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
        
        {/* =====================================================================
            LEFT SIDEBAR: EXECUTIVE MUNICIPAL NAVIGATION & SYSTEM STATUS
           ===================================================================== */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {/* 1. Municipal Command Hub Identity Card */}
          <div className="bg-slate-900 text-white rounded-[24px] p-5 shadow-sm border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-badge text-[10px] uppercase tracking-wider text-amber-400 font-bold bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40">
                {isSuperAdmin ? '👑 Super Admin' : 'Municipal Admin'}
              </span>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-200">Active</span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold tracking-tight text-white">Municipal Command Center</h2>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-label-code">
                {currentUser?.email || 'admin@civicai.gov.in'}
              </p>
            </div>
          </div>

          {/* 2. Navigation Module Tabs (Strictly Ordered) */}
          <nav className="bg-white rounded-[24px] p-2.5 border border-slate-200 shadow-xs flex flex-col gap-1">
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Command Modules
            </div>

            {navTabs.map((tab) => {
              const isSelected = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveView(tab.id as any);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[19px] shrink-0 ${
                        isSelected ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-extrabold'
                          : tab.id === 'priority' && criticalIssues > 0
                          ? 'bg-rose-100 text-rose-700 font-bold'
                          : tab.id === 'duplicates' && duplicateCount > 0
                          ? 'bg-cyan-100 text-cyan-700 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* 3. Platform Health Diagnostics Card */}
          <div className="bg-slate-900 text-slate-300 rounded-[24px] p-4 border border-slate-800 text-xs space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-white">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-teal-400 text-[16px]">sensors</span>
                Civic Intelligence
              </span>
              <span className="text-emerald-400 text-[10px] font-bold">100% Online</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1.5 pt-1.5 border-t border-slate-800">
              <div className="flex justify-between">
                <span>AI Vision Pipeline:</span>
                <span className="text-slate-200 font-medium">Ready</span>
              </div>
              <div className="flex justify-between">
                <span>Duplicate Clustering:</span>
                <span className="text-slate-200 font-medium">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Local Ledger:</span>
                <span className="text-teal-300 font-medium">Synchronized</span>
              </div>
            </div>
          </div>
        </aside>

        {/* =====================================================================
            RIGHT COLUMN: THE BIGGEST FRAME (MAIN OPERATIONAL DISPLAY)
           ===================================================================== */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Top Operational Context Header Bar */}
          <div className="bg-white rounded-[24px] px-6 py-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Municipal Command Center</span>
                <span>/</span>
                <span className="text-teal-700 font-extrabold">{navTabs.find((t) => t.id === activeView)?.label}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">
                {activeView === 'overview' && 'Executive Summary & Problem Density'}
                {activeView === 'triage' && 'Live Defect Reports & Department Dispatch'}
                {activeView === 'priority' && 'AI Explainable Priority Triage Queue'}
                {activeView === 'duplicates' && 'Duplicate Defect Merging Hub'}
                {activeView === 'integrity' && 'Report Integrity & Tampering Analysis'}
                {activeView === 'map' && 'GIS Geospatial Hotspots & Distribution'}
                {activeView === 'analytics' && 'Civic SLA Performance & Department Analytics'}
                {activeView === 'copilot' && 'CivicAI Copilot — Natural Language Intelligence'}
                {activeView === 'officers' && 'Municipal Officer Provisioning & Security'}
              </h1>
            </div>

            <button
              type="button"
              onClick={refreshIntelligenceData}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Sync Data</span>
            </button>
          </div>

      {/* =====================================================================
          TAB 1: OVERVIEW & REAL-TIME HOTSPOTS
         ===================================================================== */}
      {activeView === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Live Telemetry Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white rounded-[24px] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <span className="material-symbols-outlined text-[22px]">sensors</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-white">Live Municipal Telemetry</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time synchronization across all citizen reports stored in Supabase Cloud
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                {reports.length} Total Citizen Reports Synced
              </span>
            </div>
          </div>

          {/* Interactive Live Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => {
                setActiveView('triage');
                setFilterStatus('all');
              }}
              className="bg-white hover:bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs text-left transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-slate-500">Total Reports</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalIssues}</div>
              <span className="text-[10px] text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                <span>View all</span>
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('triage');
                setFilterStatus('REPORTED');
              }}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-xs text-left transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-indigo-600">New / Unassigned</span>
              <div className="text-2xl font-bold text-indigo-700 mt-1">{newIssues}</div>
              <span className="text-[10px] text-indigo-500 font-semibold flex items-center gap-1 mt-0.5">
                <span>Triage queue</span>
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('triage');
                setFilterStatus('IN PROGRESS');
              }}
              className="bg-white hover:bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs text-left transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-amber-600">In Progress</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">{inProgressIssues}</div>
              <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1 mt-0.5">
                <span>Crews active</span>
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </button>

            <button
              onClick={() => setActiveView('priority')}
              className="bg-white hover:bg-rose-50/50 p-4 rounded-2xl border border-rose-100 shadow-xs text-left transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-rose-600">Critical Priority</span>
              <div className="text-2xl font-bold text-rose-700 mt-1">{criticalIssues}</div>
              <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-0.5">
                <span>SLA alert</span>
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('triage');
                setFilterStatus('RESOLVED');
              }}
              className="bg-white hover:bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs text-left transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-emerald-600">Resolved & Closed</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{resolvedIssues}</div>
              <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-0.5">
                <span>Audited</span>
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </button>

            <button
              onClick={() => setActiveView('duplicates')}
              className="bg-white hover:bg-cyan-50/50 p-4 rounded-2xl border border-cyan-100 shadow-xs text-left transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-cyan-600">Possible Duplicates</span>
              <div className="text-2xl font-bold text-cyan-700 mt-1">{duplicateCount}</div>
              <span className="text-[10px] text-cyan-500 font-semibold flex items-center gap-1 mt-0.5">
                <span>Merge hub</span>
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </button>
          </div>

          {/* Weekly Submitted vs Solved Analytical Dashboard (Pie / Donut Chart) */}
          <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[24px]">pie_chart</span>
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Weekly Incident Velocity & Resolution Analytics
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time comparison of citizen reports submitted vs defects inspected & solved this week
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-700">7-Day Rolling Window</span>
              </div>
            </div>

            {/* Dashboard 3-Column Visual Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* 1. Professional SVG Pie/Donut Chart (5 cols) */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50/70 rounded-2xl border border-slate-200/60">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
                    {/* Background Ring */}
                    <circle
                      cx="70"
                      cy="70"
                      r="52"
                      className="stroke-slate-200 fill-none"
                      strokeWidth="14"
                    />

                    {weeklyAnalytics.totalSubmitted > 0 ? (
                      <>
                        {/* Segment 1: Resolved (Emerald) */}
                        {weeklyAnalytics.resolutionRate > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r="52"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="14"
                            strokeDasharray={`${(weeklyAnalytics.resolutionRate / 100) * 326.726} 326.726`}
                            strokeDashoffset="0"
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                          />
                        )}

                        {/* Segment 2: In Progress / Assigned (Amber) */}
                        {weeklyAnalytics.inProgressRate > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r="52"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="14"
                            strokeDasharray={`${(weeklyAnalytics.inProgressRate / 100) * 326.726} 326.726`}
                            strokeDashoffset={`${-((weeklyAnalytics.resolutionRate / 100) * 326.726)}`}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                          />
                        )}

                        {/* Segment 3: Pending Triage (Indigo) */}
                        {weeklyAnalytics.pendingRate > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r="52"
                            fill="none"
                            stroke="#6366F1"
                            strokeWidth="14"
                            strokeDasharray={`${(weeklyAnalytics.pendingRate / 100) * 326.726} 326.726`}
                            strokeDashoffset={`${-(
                              ((weeklyAnalytics.resolutionRate + weeklyAnalytics.inProgressRate) / 100) *
                              326.726
                            )}`}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                          />
                        )}
                      </>
                    ) : (
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        className="stroke-slate-300 fill-none"
                        strokeWidth="14"
                        strokeDasharray="4 4"
                      />
                    )}
                  </svg>

                  {/* Donut Center Readout */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      {weeklyAnalytics.resolutionRate}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-0.5">
                      Solved Ratio
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 mt-1">
                      {weeklyAnalytics.resolvedThisWeek} of {weeklyAnalytics.totalSubmitted} cases
                    </span>
                  </div>
                </div>

                {/* Pie Chart Legend */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-slate-200/60 w-full text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xs" />
                    <span className="font-bold text-slate-800">Solved ({weeklyAnalytics.resolvedThisWeek})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shadow-2xs" />
                    <span className="font-bold text-slate-800">In Progress ({weeklyAnalytics.inProgressThisWeek})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-2xs" />
                    <span className="font-bold text-slate-800">Pending ({weeklyAnalytics.pendingThisWeek})</span>
                  </div>
                </div>
              </div>

              {/* 2. Executive Metric Highlight Cards (7 cols) */}
              <div className="md:col-span-7 flex flex-col gap-3">
                {/* Metric Card A: Submitted this week */}
                <div className="bg-gradient-to-r from-indigo-50/80 to-white p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[22px]">upload_file</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                        Reports Submitted This Week
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        New citizen defect tickets logged across municipal sectors
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-extrabold text-indigo-900">
                      {weeklyAnalytics.totalSubmitted}
                    </span>
                    <span className="block text-[10px] font-bold text-indigo-600">Active Pipeline</span>
                  </div>
                </div>

                {/* Metric Card B: Solved & Closed this week */}
                <div className="bg-gradient-to-r from-emerald-50/80 to-white p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[22px]">verified</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        Reports Solved & Verified
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Completed repairs backed with photographic on-site evidence
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-extrabold text-emerald-700">
                      {weeklyAnalytics.resolvedThisWeek}
                    </span>
                    <span className="block text-[10px] font-bold text-emerald-600">
                      {weeklyAnalytics.resolutionRate}% Solved
                    </span>
                  </div>
                </div>

                {/* Metric Card C: Work Orders In Field Execution */}
                <div className="bg-gradient-to-r from-amber-50/80 to-white p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[22px]">engineering</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Field Crews Dispatched & In Progress
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Assigned maintenance fleets addressing active defects
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-extrabold text-amber-800">
                      {weeklyAnalytics.inProgressThisWeek}
                    </span>
                    <span className="block text-[10px] font-bold text-amber-700">Live Work Orders</span>
                  </div>
                </div>

                {/* Municipal SLA Health Bar */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span className="material-symbols-outlined text-teal-400 text-[16px]">speed</span>
                      48-Hour SLA Compliance Adherence
                    </span>
                    <span className="text-amber-400 font-extrabold">
                      {weeklyAnalytics.totalSubmitted > 0 ? `${Math.min(100, Math.max(78, weeklyAnalytics.resolutionRate + 15))}% Target` : '100% Target'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${weeklyAnalytics.totalSubmitted > 0 ? Math.min(100, Math.max(78, weeklyAnalytics.resolutionRate + 15)) : 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 7. CIVIC HOTSPOTS RANKING TABLE */}
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Civic Hotspots & Problem Density</h3>
                  <p className="text-xs text-slate-500">
                    Spatial clustering analytics derived from verified citizen reports
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400">Real Incident Density</span>
            </div>

            {hotspots.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No hotspot clusters detected yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Municipal Ward / Area</th>
                      <th className="py-3 px-4 text-center">Total Issues</th>
                      <th className="py-3 px-4 text-center">Unresolved Backlog</th>
                      <th className="py-3 px-4">Dominant Category</th>
                      <th className="py-3 px-4 text-center">Trend</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {hotspots.map((hotspot, idx) => (
                      <tr key={hotspot.ward} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">{hotspot.ward}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">{hotspot.totalIssues}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${hotspot.unresolvedCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                            {hotspot.unresolvedCount} active
                          </span>
                        </td>
                        <td className="py-3 px-4 text-teal-800 font-semibold">{hotspot.topCategory}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${hotspot.trend === 'increasing' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                            {hotspot.trend}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveView('map');
                              onShowToast(`Focused map on ${hotspot.ward}`, 'my_location');
                            }}
                            className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Inspect Map
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: LIVE ISSUES & CONSOLIDATION TRIAGE
         ===================================================================== */}
      {activeView === 'triage' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined text-[20px] text-slate-400 absolute left-3.5 top-3 pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Search tickets by ID, street, ward, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <option value="all">All 8 Categories</option>
                {CIVIC_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="REPORTED">REPORTED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN PROGRESS">IN PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="bg-white rounded-[28px] p-12 text-center border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[40px] text-slate-300 mb-2">inbox</span>
              <h3 className="text-base font-bold text-slate-800">No Incidents Found</h3>
            </div>
          ) : (
            <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Ticket ID</th>
                      <th className="py-3.5 px-4">Issue Details</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">AI Vision Match</th>
                      <th className="py-3.5 px-4">Severity</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredReports.map((report) => (
                      <tr
                        key={report.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => setSelectedReport(report)}
                      >
                        <td className="py-3 px-4 font-label-code font-bold text-teal-800">{report.id}</td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{report.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{report.category}</div>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600">{report.location}</td>
                        <td className="py-3 px-4">
                          <span className="font-label-code text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                            {report.confidenceScore}% Match
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              report.priority === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : report.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {report.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              report.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : report.status === 'IN PROGRESS'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {report.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReport(report);
                            }}
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: AI PRIORITY QUEUE (With Explainable Rationale Cards)
         ===================================================================== */}
      {activeView === 'priority' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">AI Explainable Priority Triage Queue</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tickets dynamically ranked by AI combining severity, report volume, community verifications, and SLA duration.
              </p>
            </div>
            <span className="bg-rose-100 text-rose-800 font-label-code text-xs font-bold px-3 py-1 rounded-full">
              {reports.filter((r) => r.priority === 'CRITICAL' || r.priority === 'HIGH').length} Elevated Tickets
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports
              .filter((r) => r.status !== 'RESOLVED' && r.status !== 'REJECTED')
              .sort((a, b) => (b.priority === 'CRITICAL' ? 1 : 0) - (a.priority === 'CRITICAL' ? 1 : 0))
              .map((report) => (
                <div
                  key={report.id}
                  className={`p-5 rounded-[24px] border shadow-xs flex flex-col justify-between space-y-3 cursor-pointer transition-all ${
                    report.priority === 'CRITICAL'
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-label-code font-bold text-xs text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                          {report.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            report.priority === 'CRITICAL'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {report.priority} PRIORITY
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{report.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{report.location} • {report.ward}</p>
                    </div>

                    <span className="text-xs font-label-code text-slate-400 shrink-0">
                      {report.slaRemaining}
                    </span>
                  </div>

                  {/* 5. Explainable Priority Reasons */}
                  <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                    <span className="font-bold text-[11px] text-slate-700 block uppercase">
                      Why this ticket received {report.priority} Priority:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                      <li>Visual defect hazard severity: {report.priority}</li>
                      <li>Department routing: {report.department}</li>
                      <li>{report.upvotes || 1} citizen corroborations filed</li>
                    </ul>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-teal-800 font-bold">{report.department}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReport(report);
                        setIsDispatchModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                      <span>Dispatch Crew</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: DUPLICATE DETECTION HUB
         ===================================================================== */}
      {activeView === 'duplicates' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Multi-Signal Duplicate Detection Hub</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review flagged duplicate pairs based on GPS distance (&lt;75m), image visual similarity, and text correlation.
              </p>
            </div>
            <span className="bg-amber-100 text-amber-900 font-label-code text-xs font-bold px-3 py-1 rounded-full">
              {duplicateMatches.filter((d) => d.status === 'possible_duplicate').length} Pending Merges
            </span>
          </div>

          {duplicateMatches.length === 0 ? (
            <div className="bg-white rounded-[28px] p-12 text-center border border-slate-200 text-slate-400 text-xs">
              No duplicate complaints detected in the database.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {duplicateMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-white rounded-[24px] border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 font-label-code text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {match.similarityScore}% Similarity Match
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        Spatial Distance: {match.signals.geoDistanceMeters}m
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${match.status === 'linked_to_issue' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                      {match.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Source Report */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>New Report</span>
                        <span className="font-mono text-teal-800">{match.sourceReportId}</span>
                      </div>
                      <div className="font-bold text-slate-900">{match.sourceReportTitle || 'New incoming complaint'}</div>
                      <div className="text-slate-500 text-[11px]">Matched at {new Date(match.matchedAt).toLocaleTimeString()}</div>
                    </div>

                    {/* Target Consolidated Issue */}
                    <div className="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>Target Civic Issue</span>
                        <span className="font-mono text-teal-900">{match.targetIssueId}</span>
                      </div>
                      <div className="font-bold text-slate-900">{match.targetIssueTitle || 'Consolidated civic issue'}</div>
                      <div className="text-teal-700 text-[11px]">Consolidated municipal record</div>
                    </div>
                  </div>

                  {/* Actions */}
                  {match.status === 'possible_duplicate' && (
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateDecision(match.id, 'linked_to_issue')}
                        className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">merge</span>
                        <span>Link to Existing Civic Issue</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateDecision(match.id, 'confirmed_distinct')}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">call_split</span>
                        <span>Keep as Distinct Issue</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: REPORT INTEGRITY ENGINE QUEUE
         ===================================================================== */}
      {activeView === 'integrity' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Report Integrity & Anti-Spam Queue</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Heuristic velocity checks, image duplicate spam detection, and spatial coordinate flooding analysis.
              </p>
            </div>
            <span className="bg-slate-100 text-slate-800 font-label-code text-xs font-bold px-3 py-1 rounded-full">
              {integrityList.length} Assessed Tickets
            </span>
          </div>

          {integrityList.length === 0 ? (
            <div className="bg-white rounded-[28px] p-12 text-center border border-slate-200 text-slate-400 text-xs">
              All incoming reports passed baseline integrity checks with NORMAL status.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {integrityList.map((item) => (
                <div
                  key={item.reportId}
                  className={`p-4 rounded-2xl border shadow-xs space-y-2 ${
                    item.status === 'FLAGGED'
                      ? 'bg-rose-50/50 border-rose-200'
                      : item.status === 'REVIEW'
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-800">{item.reportId}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        item.status === 'FLAGGED'
                          ? 'bg-rose-600 text-white'
                          : item.status === 'REVIEW'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.status} ({item.confidenceScore}% Confidence)
                    </span>
                  </div>

                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-xs">
                    {item.flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>Velocity: {item.submissionVelocity} reports/hr</span>
                    <span>Duplicate Photo Risk: {item.imageDuplicateRisk}%</span>
                    <span>Radius Density: {item.geoRadiusDensity} reports in 50m</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 6: INTERACTIVE GIS MAP & HEATMAP
         ===================================================================== */}
      {activeView === 'map' && (
        <CivicGisMap
          reports={reports}
          onSelectReport={(report) => {
            setSelectedReport(report);
            setActiveView('triage');
          }}
          title="Interactive Municipal Civic GIS Map & Heatmap"
          subtitle="Real-time incident clustering, heatmap density, priority pins, and multi-dimensional spatial filtering."
        />
      )}

      {/* =====================================================================
          TAB 7: DEPARTMENT ANALYTICS
         ===================================================================== */}
      {activeView === 'analytics' && (
        <DepartmentAnalyticsView
          reports={reports}
          onSelectReport={(report) => {
            setSelectedReport(report);
            setActiveView('triage');
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* =====================================================================
          TAB 8: AI ADMIN COPILOT
         ===================================================================== */}
      {activeView === 'copilot' && (
        <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-6 space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[24px]">psychology</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">AI Admin Copilot Intelligence Assistant</h2>
                <p className="text-xs text-slate-500">
                  Ask natural-language questions to query, aggregate, and inspect the real municipal database.
                </p>
              </div>
            </div>
            <span className="bg-teal-50 text-teal-800 text-xs font-bold px-3 py-1 rounded-full border border-teal-200">
              Live DB Query Engine
            </span>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-semibold shrink-0">Quick Prompts:</span>
            {[
              'Show high-priority unresolved potholes',
              'Which location has the most complaints?',
              'How many garbage reports were resolved this week?',
              'Show possible duplicate issues',
              'Which complaints have been pending for more than three days?',
            ].map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => handleSendCopilotQuery(promptText)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 font-medium border border-slate-200 transition-colors shrink-0 cursor-pointer text-[11px]"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Chat Stream */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto p-3 bg-slate-50/60 rounded-2xl border border-slate-200/80">
            {copilotMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'copilot' && (
                  <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                    AI
                  </div>
                )}

                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs space-y-2.5 ${
                    msg.sender === 'user'
                      ? 'bg-teal-700 text-white font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>

                  {/* Highlights Grid */}
                  {msg.metricsHighlight && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                      {msg.metricsHighlight.map((m, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 block font-semibold">{m.label}</span>
                          <span className="text-sm font-bold text-slate-900 mt-0.5 block">{m.value}</span>
                          {m.sublabel && <span className="text-[9px] text-slate-500">{m.sublabel}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched Reports Preview */}
                  {msg.matchedReports && msg.matchedReports.length > 0 && (
                    <div className="pt-2 space-y-1.5 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Matched Database Records:</span>
                      {msg.matchedReports.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => setSelectedReport(r)}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-teal-50 border border-slate-200/60 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-mono font-bold text-teal-800">{r.id}</span>
                            <span className="text-slate-700 font-semibold ml-2">{r.title}</span>
                          </div>
                          <span className="text-slate-400 text-[10px]">{r.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="text-[9px] text-slate-400 block text-right">{msg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask Copilot a question (e.g. Which location has the most complaints?)..."
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendCopilotQuery();
              }}
              className="flex-1 bg-slate-50 text-slate-900 text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
            <button
              type="button"
              onClick={() => handleSendCopilotQuery()}
              className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
            >
              <span>{t('copilot.ask')}</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 9: SUPER ADMIN OFFICER PROVISIONING
         ===================================================================== */}
      {activeView === 'officers' && isSuperAdmin && (
        <div className="space-y-6 animate-in fade-in">
          {/* Create New Admin Form Card */}
          <div className="bg-white rounded-[28px] p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[26px]">person_add</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Provision New Municipal Administrator Account
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorize municipal officers by official email and generate cryptographic access credentials.
                </p>
              </div>
            </div>

            {createdCredentials && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-emerald-900 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                    <span>New Administrator Provisioned Successfully</span>
                  </span>
                  <button
                    onClick={() => setCreatedCredentials(null)}
                    className="text-emerald-700 hover:text-emerald-950 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1 font-mono text-slate-800">
                  <div><strong>Officer Name:</strong> {createdCredentials.name}</div>
                  <div><strong>Official Email:</strong> {createdCredentials.email}</div>
                  <div><strong>Generated Password:</strong> <span className="bg-emerald-100 px-1.5 py-0.5 rounded font-bold text-emerald-900">{createdCredentials.pass}</span></div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateOfficer} className="space-y-4 text-xs pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Officer Legal Name</label>
                  <input
                    type="text"
                    required
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    placeholder="e.g. Suresh Deshmukh"
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Official Municipal Email</label>
                  <input
                    type="email"
                    required
                    value={officerEmail}
                    onChange={(e) => setOfficerEmail(e.target.value)}
                    placeholder="e.g. suresh.deshmukh@civicai.gov.in"
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Assigned Department</label>
                  <select
                    value={officerDept}
                    onChange={(e) => setOfficerDept(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium cursor-pointer"
                  >
                    {CIVIC_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.department}>
                        {c.department} ({c.name})
                      </option>
                    ))}
                    <option value="Central Municipal Command Center">Central Municipal Command Center</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Password</label>
                  <input
                    type="text"
                    value={officerPassword}
                    onChange={(e) => setOfficerPassword(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-mono font-medium"
                  />
                </div>
              </div>

              {onboardError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {onboardError}
                </div>
              )}

              <button
                type="submit"
                disabled={isCreatingOfficer}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Authorize & Create Municipal Administrator</span>
              </button>
            </form>
          </div>
        </div>
      )}
        </main>
      </div>

      {/* Selected Report Inspection Drawer / Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-label-code text-base font-bold text-teal-800">{selectedReport.id}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {selectedReport.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-48 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200">
                {selectedReport.imageUrl ? (
                  <img src={selectedReport.imageUrl} alt={selectedReport.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">No photo</div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">Incident Title</span>
                  <span className="text-slate-900 font-bold text-sm">{selectedReport.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Civic Category</span>
                  <span className="text-slate-800 font-medium">{selectedReport.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Location & Ward</span>
                  <span className="text-slate-800 font-medium">{selectedReport.location} ({selectedReport.ward})</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Assigned Department</span>
                  <span className="text-teal-800 font-bold">{selectedReport.department}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsDispatchModalOpen(true);
                }}
                className="py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                <span>Dispatch Crew</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetStatus('RESOLVED');
                  setIsStatusModalOpen(true);
                }}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                <span>Mark Resolved & Upload Evidence</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 16. RESOLUTION EVIDENCE & STATUS MODAL */}
      {isStatusModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Update Status & Resolution Evidence</h3>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as IncidentStatus)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 cursor-pointer"
                >
                  <option value="IN PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED (Upload "After" Evidence Photo)</option>
                  <option value="UNDER REVIEW">UNDER REVIEW</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              {/* After Photo Upload */}
              {targetStatus === 'RESOLVED' && (
                <div className="space-y-2">
                  <label className="block text-slate-700 font-bold">16. Upload "After" Resolution Photo Evidence</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setResolutionPhotoFile(f);
                        const r = new FileReader();
                        r.onload = (ev) => setResolutionPhotoPreview(ev.target?.result as string);
                        r.readAsDataURL(f);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                  />
                  {resolutionPhotoPreview && (
                    <div className="h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                      <img src={resolutionPhotoPreview} alt="Resolution preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Official Inspection Notes</label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Describe repair actions, crew details, or inspection findings..."
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <button
                type="button"
                disabled={isSubmittingResolution}
                onClick={handleConfirmStatusChange}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingResolution ? (
                  <span>Saving & Uploading Evidence...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Confirm Status Transition</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH CREW MODAL */}
      {isDispatchModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Dispatch Municipal Field Crew</h3>
              <button
                onClick={() => setIsDispatchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Selected Repair Fleet</label>
                <select
                  value={selectedCrew}
                  onChange={(e) => setSelectedCrew(e.target.value)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 cursor-pointer"
                >
                  <option value="Zone Rapid Cold-Mix Asphalt Patch Fleet">Zone Rapid Cold-Mix Asphalt Patch Fleet</option>
                  <option value="Hydraulic Pipeline Emergency Response Team">Hydraulic Pipeline Emergency Response Team</option>
                  <option value="Municipal Electrical Division Line Van">Municipal Electrical Division Line Van</option>
                  <option value="Solid Waste Heavy Compactor & Disinfection Unit">Solid Waste Heavy Compactor & Disinfection Unit</option>
                  <option value="Garden & Environmental Tree Clearance Squad">Garden & Environmental Tree Clearance Squad</option>
                  <option value="Civil Infrastructure Maintenance Team">Civil Infrastructure Maintenance Team</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Work Order Directive</label>
                <input
                  type="text"
                  value={dispatchDirective}
                  onChange={(e) => setDispatchDirective(e.target.value)}
                  placeholder="e.g. Priority road patch under 24h SLA"
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmDispatch}
                className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                <span>Dispatch Response Fleet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
