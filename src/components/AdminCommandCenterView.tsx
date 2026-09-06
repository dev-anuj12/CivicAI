import React, { useEffect, useState } from 'react';
import { CivicReport, IncidentCategory, IncidentSeverity, IncidentStatus, UserProfile } from '../types';
import { CIVIC_CATEGORIES } from '../data/mockData';
import { AuthService } from '../services/authService';
import { DepartmentAnalyticsView } from './DepartmentAnalyticsView';
import { CivicGisMap } from './CivicGisMap';

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
  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin);

  const [activeView, setActiveView] = useState<'triage' | 'analytics' | 'map' | 'officers'>('triage');

  // Triage state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<CivicReport | null>(null);

  // Dispatch Modal State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState('Zone Rapid Repair Unit');
  const [dispatchDirective, setDispatchDirective] = useState('');

  // Status Change Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<IncidentStatus>('IN PROGRESS');
  const [statusNote, setStatusNote] = useState('');

  // AI Municipal Action Plan State
  const [aiActionPlan, setAiActionPlan] = useState<{
    recommendedCrew: string;
    targetSla: string;
    equipment: string[];
    citizenUpdateDraft: string;
  } | null>(null);
  const [isGeneratingAiPlan, setIsGeneratingAiPlan] = useState(false);

  // Super Admin Officer Provisioning State
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

  // Handle Generating Password
  const handleAutoGeneratePassword = () => {
    const generated = AuthService.generateRandomPassword();
    setOfficerPassword(generated);
    onShowToast('Generated high-entropy secure password', 'key');
  };

  // Handle Creating New Admin
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

  // Toggle Admin Status
  const handleToggleAdminStatus = async (adminId: string) => {
    if (!currentUser?.email) return;
    const res = await AuthService.toggleAdminStatus(currentUser.email, adminId);
    if (res.success) {
      refreshOfficersList();
      onShowToast(`Administrator account status set to ${res.status?.toUpperCase()}`, 'toggle_on');
    } else {
      onShowToast(res.error || 'Could not update status', 'error');
    }
  };

  // Filter reports
  const filteredReports = reports.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchLoc = r.location.toLowerCase().includes(q);
      const matchDept = r.department.toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchLoc && !matchDept) return false;
    }

    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;

    return true;
  });

  // Calculate real metrics
  const totalIssues = reports.length;
  const newIssues = reports.filter((r) => r.status === 'REPORTED').length;
  const inProgressIssues = reports.filter((r) => r.status === 'IN PROGRESS' || r.status === 'ASSIGNED').length;
  const criticalIssues = reports.filter((r) => r.priority === 'CRITICAL').length;
  const resolvedIssues = reports.filter((r) => r.status === 'RESOLVED').length;

  // Generate AI Action Plan
  const handleGenerateAiPlan = (report: CivicReport) => {
    setIsGeneratingAiPlan(true);
    onShowToast('AI Municipal Decision Assistant calculating SLA & logistics...', 'psychology');

    setTimeout(() => {
      let crew = 'Specialized Municipal Civil Unit';
      let sla = '24 Hours';
      let gear = ['Reflective Safety Cones', 'GIS Survey Tablet', 'Digital Caliper'];

      if (report.category.includes('Road')) {
        crew = 'Zone Rapid Cold-Mix Asphalt Patch Fleet';
        sla = report.priority === 'CRITICAL' ? '4 - 6 Hours Emergency' : '24 Hours';
        gear = ['Bitumen Roller', 'Cold-Mix Compactor', 'LED Traffic Warning Arrow'];
      } else if (report.category.includes('Water')) {
        crew = 'Hydraulic Pipeline Emergency Response Team';
        sla = report.priority === 'CRITICAL' ? '2 - 4 Hours Emergency' : '12 Hours';
        gear = ['Submersible Sump Pump', 'Pipe Sleeve Clamp', 'Ultrasonic Acoustic Leak Sensor'];
      } else if (report.category.includes('Electricity')) {
        crew = 'Municipal Electrical Division Line Van';
        sla = '4 - 8 Hours';
        gear = ['Hydraulic Bucket Lift', 'Dielectric Insulated Gloves', 'Photocell Diagnostic Kit'];
      } else if (report.category.includes('Sanitation')) {
        crew = 'Solid Waste Heavy Compactor & Disinfection Unit';
        sla = '12 Hours';
        gear = ['Hydraulic Rear Loader', 'Sodium Hypochlorite Sanitizer Sprayer'];
      }

      setAiActionPlan({
        recommendedCrew: crew,
        targetSla: sla,
        equipment: gear,
        citizenUpdateDraft: `Inspected on-site by ${report.department}. Dispatched ${crew}. Work is in progress under target resolution turnaround of ${sla}.`,
      });
      setIsGeneratingAiPlan(false);
      onShowToast('AI Municipal Action Plan Ready!', 'auto_awesome');
    }, 850);
  };

  const handleConfirmDispatch = () => {
    if (!selectedReport) return;
    onUpdateReportCrew(selectedReport.id, selectedCrew, dispatchDirective);
    setIsDispatchModalOpen(false);
    onShowToast(`Dispatched ${selectedCrew} to ${selectedReport.id}!`, 'local_shipping');
  };

  const handleConfirmStatusChange = () => {
    if (!selectedReport) return;
    onUpdateReportStatus(selectedReport.id, targetStatus, statusNote);
    setIsStatusModalOpen(false);
    setStatusNote('');
    onShowToast(`Updated ${selectedReport.id} to "${targetStatus}"!`, 'verified');
  };

  return (
    <div className="flex flex-col w-full gap-6 pb-28 animate-in fade-in duration-200">
      {/* Admin Top Header Banner */}
      <div className="bg-slate-900 text-white rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col gap-4 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-badge text-xs uppercase tracking-wider text-amber-400 font-bold bg-amber-950/60 px-3 py-1 rounded-full border border-amber-800/40">
                {isSuperAdmin ? '👑 Executive Super Administrator' : 'Municipal Administrator'}
              </span>
              <span className="text-xs text-slate-400 font-label-code">
                {currentUser?.email}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2 tracking-tight">
              Municipal Command & Governance Center
            </h1>
          </div>
          <div className="bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/60 flex items-center gap-2 self-start">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">9 Civic Domains Live</span>
          </div>
        </div>

        {/* Admin Navigation View Switcher */}
        <div className="flex flex-wrap bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/80 gap-2 mt-1">
          <button
            type="button"
            onClick={() => setActiveView('triage')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeView === 'triage'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">rule_folder</span>
            <span>Triage & Incidents ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('analytics')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeView === 'analytics'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            <span>Department Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeView === 'map'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            <span>Interactive GIS Map</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveView('officers');
                refreshOfficersList();
              }}
              className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeView === 'officers'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span>👑 Super Admin ({officersList.length})</span>
            </button>
          )}
        </div>

        {/* Real Dynamic Metrics (Shown on triage tab) */}
        {activeView === 'triage' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/40">
              <span className="text-xs text-slate-400 font-medium">Total Complaints</span>
              <div className="text-2xl font-bold text-white mt-1">{totalIssues}</div>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/40">
              <span className="text-xs text-indigo-400 font-medium">New / Unassigned</span>
              <div className="text-2xl font-bold text-indigo-300 mt-1">{newIssues}</div>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/40">
              <span className="text-xs text-amber-400 font-medium">In Progress</span>
              <div className="text-2xl font-bold text-amber-300 mt-1">{inProgressIssues}</div>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/40">
              <span className="text-xs text-rose-400 font-medium">Critical Priority</span>
              <div className="text-2xl font-bold text-rose-300 mt-1">{criticalIssues}</div>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/40">
              <span className="text-xs text-emerald-400 font-medium">Resolved & Closed</span>
              <div className="text-2xl font-bold text-emerald-300 mt-1">{resolvedIssues}</div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          TAB 1: INCIDENTS & TRIAGE MANAGEMENT
         ===================================================================== */}
      {activeView === 'triage' && (
        <>
          {/* Filter & Search Bar */}
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
                <option value="all">All 9 Categories</option>
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

          {/* Main Management Table */}
          {filteredReports.length === 0 ? (
            <div className="bg-white rounded-[28px] p-12 text-center border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[40px] text-slate-300 mb-2">inbox</span>
              <h3 className="text-base font-bold text-slate-800">No Incidents Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {reports.length === 0
                  ? 'There are currently zero civic reports in the municipal database.'
                  : 'No tickets match the selected filters.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Ticket ID</th>
                      <th className="py-3.5 px-4">Issue Details</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">AI Vision Match</th>
                      <th className="py-3.5 px-4">Severity</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Municipal Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredReports.map((report) => (
                      <tr
                        key={report.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedReport(report);
                          setAiActionPlan(null);
                        }}
                      >
                        <td className="py-3 px-4 font-label-code font-bold text-teal-800">
                          {report.id}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{report.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{report.category}</div>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                          {report.location}
                        </td>
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
                              setAiActionPlan(null);
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
        </>
      )}

      {/* =====================================================================
          TAB 2: DEPARTMENT ANALYTICS MODULE
         ===================================================================== */}
      {activeView === 'analytics' && (
        <DepartmentAnalyticsView
          reports={reports}
          onSelectReport={(report) => {
            setSelectedReport(report);
            setAiActionPlan(null);
            setActiveView('triage');
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* =====================================================================
          TAB 3: INTERACTIVE CIVIC GIS MAP
         ===================================================================== */}
      {activeView === 'map' && (
        <CivicGisMap
          reports={reports}
          onSelectReport={(report) => {
            setSelectedReport(report);
            setAiActionPlan(null);
            setActiveView('triage');
          }}
          title="Interactive Civic Issue GIS Command Map"
          subtitle="Real-time incident clustering, heatmap density, priority pins, and multi-dimensional spatial filtering."
        />
      )}

      {/* =====================================================================
          TAB 4: SUPER ADMIN OFFICER PROVISIONING (Exclusive)
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
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `CivicAI Admin Credentials\nOfficer: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.pass}\nLogin URL: http://localhost:3000`
                    );
                    onShowToast('Officer credentials copied to clipboard!', 'content_copy');
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  <span>Copy Officer Credentials</span>
                </button>
              </div>
            )}

            <form onSubmit={handleCreateOfficer} className="space-y-4 text-xs pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Officer Legal / Official Name</label>
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
                  <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                    <span>Password Configuration</span>
                    <button
                      type="button"
                      onClick={handleAutoGeneratePassword}
                      className="text-amber-800 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      ⚡ Auto-Generate Password
                    </button>
                  </label>
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
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{onboardError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreatingOfficer}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCreatingOfficer ? (
                  <span>Generating Account...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    <span>Authorize & Create Municipal Administrator</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Officers Directory Table */}
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Authorized Municipal Administrators Directory
                </h3>
                <p className="text-xs text-slate-500">
                  Governed through Supabase Super Admin access
                </p>
              </div>
              <button
                type="button"
                onClick={refreshOfficersList}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                title="Refresh list"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>

            {officersList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No delegated municipal administrators provisioned yet. Create an account above to delegate triage authority.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Officer Name</th>
                      <th className="py-3 px-4">Official Email</th>
                      <th className="py-3 px-4">Assigned Department</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4">Provisioned On</th>
                      <th className="py-3 px-4 text-right">Access Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officersList.map((officer) => (
                      <tr key={officer.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900">{officer.fullName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{officer.email}</td>
                        <td className="py-3 px-4 text-teal-800 font-semibold">{officer.department}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              officer.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {officer.status || 'active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(officer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleAdminStatus(officer.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              officer.status === 'active'
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {officer.status === 'active' ? 'Suspend' : 'Reactivate'}
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
              {/* Evidence Photo */}
              <div className="h-48 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200">
                {selectedReport.imageUrl ? (
                  <img src={selectedReport.imageUrl} alt={selectedReport.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    No image available
                  </div>
                )}
              </div>

              {/* Overview Details */}
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
                {selectedReport.assignedCrew && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Dispatched Crew</span>
                    <span className="text-amber-800 font-bold">{selectedReport.assignedCrew}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Decision Assistant Card */}
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span>AI Municipal Decision Assistant</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleGenerateAiPlan(selectedReport)}
                  disabled={isGeneratingAiPlan}
                  className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAiPlan ? 'Analyzing...' : 'Generate Action Plan'}
                </button>
              </div>

              {aiActionPlan ? (
                <div className="space-y-2.5 text-xs text-slate-700 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-teal-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Recommended Crew:</span>
                      <span className="font-bold text-slate-900">{aiActionPlan.recommendedCrew}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Turnaround Target:</span>
                      <span className="font-bold text-teal-800">{aiActionPlan.targetSla}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Required Field Gear:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiActionPlan.equipment.map((g) => (
                        <span key={g} className="bg-white border border-teal-200 text-teal-900 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Auto-Drafted Citizen Update:</span>
                    <p className="bg-white p-2 rounded-lg border border-teal-200/60 text-slate-800 italic mt-0.5 text-[11px]">
                      "{aiActionPlan.citizenUpdateDraft}"
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Click "Generate Action Plan" to automatically calculate crew assignment, target SLA, safety gear, and formal status draft.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(true)}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                <span>Dispatch Crew</span>
              </button>

              <button
                type="button"
                onClick={() => setIsStatusModalOpen(true)}
                className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Update Status</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateReportStatus(selectedReport.id, 'RESOLVED', 'Inspected on-site and verified 100% resolved.');
                  setSelectedReport((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
                  onShowToast(`Marked ${selectedReport.id} as RESOLVED!`, 'verified');
                }}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Quick Resolve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Crew Modal */}
      {isDispatchModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Dispatch Municipal Crew</h3>
              <button onClick={() => setIsDispatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Target Ticket & Location</label>
                <div className="bg-slate-50 p-2.5 rounded-xl text-slate-800 font-medium">
                  {selectedReport.id} • {selectedReport.location}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Select Field Division / Team</label>
                <select
                  value={selectedCrew}
                  onChange={(e) => setSelectedCrew(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <option value="Zone 1 Rapid Pothole & Road Patch Unit">Zone 1 Rapid Pothole & Road Patch Unit</option>
                  <option value="Hydraulic Pipeline Emergency Response Unit">Hydraulic Pipeline Emergency Response Unit</option>
                  <option value="Municipal Electrical Division Line Van">Municipal Electrical Division Line Van</option>
                  <option value="Solid Waste Heavy Compactor Fleet">Solid Waste Heavy Compactor Fleet</option>
                  <option value="Public Works Civil Maintenance Fleet">Public Works Civil Maintenance Fleet</option>
                  <option value="Town Planning Safety Inspection Squad">Town Planning Safety Inspection Squad</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Dispatch Directive / Field Notes</label>
                <input
                  type="text"
                  value={dispatchDirective}
                  onChange={(e) => setDispatchDirective(e.target.value)}
                  placeholder="e.g. Cordon traffic corridor before cold-mix bitumen application"
                  className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsDispatchModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatch}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {isStatusModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Update Incident Status</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Transition Status To:</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as IncidentStatus)}
                  className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <option value="UNDER REVIEW">UNDER REVIEW</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="REJECTED">REJECTED (Ineligible)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Official Audit Comment for Citizen</label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Explain current progress or inspection outcome..."
                  className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Save Status Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
