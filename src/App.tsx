import React, { useEffect, useState } from 'react';
import { CivicReport, IncidentStatus, NotificationItem, TabType, UserProfile, UserRole } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { AuthModal, ProfileModal, SecretAdminGateModal } from './components/Modals';
import { CitizenPortalView } from './components/CitizenPortalView';
import { ReportIssueFlowView } from './components/ReportIssueFlowView';
import { MyReportsTrackingView } from './components/MyReportsTrackingView';
import { AdminCommandCenterView } from './components/AdminCommandCenterView';
import { AuthService } from './services/authService';
import {
  addReportComment,
  createReport,
  fetchAllReports,
  fetchNotifications,
  markAllNotificationsRead,
  toggleReportUpvote,
  updateReportCrew,
  updateReportStatus,
} from './services/supabaseClient';
import { isLiveSupabaseConfigured } from './services/supabaseConfig';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('citizen-portal');
  const [userRole, setUserRole] = useState<UserRole>('citizen');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSecretAdminGateOpen, setIsSecretAdminGateOpen] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<CivicReport | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string | undefined>(undefined);

  const showToast = (message: string, icon = 'check_circle') => {
    setToastMessage(message);
    setToastIcon(icon);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3800);
  };

  // 1. Restore authenticated cloud session and keep the municipal ledger current.
  useEffect(() => {
    let isMounted = true;

    const restoreUser = async () => {
      const user = await AuthService.restoreSession();
      if (user && isMounted) {
        setCurrentUser(user);
        if (user.role === 'admin' || user.role === 'superadmin') {
          setUserRole('admin');
        }
      }
    };

    const loadReports = async (quiet = false) => {
      try {
        const data = await fetchAllReports();
        if (isMounted) setReports(data);
      } catch (error) {
        if (!quiet && isMounted) {
          showToast(error instanceof Error ? error.message : 'Could not load shared reports.', 'error');
        }
      }
    };

    restoreUser();
    loadReports();

    // Fetch notifications
    fetchNotifications().then((notifs) => {
      setNotifications(notifs);
      setUnreadNotifs(notifs.some((n) => !n.isRead));
    });

    // Check URL hash for secret admin access: #admin
    if (window.location.hash === '#admin' || window.location.search.includes('admin=true')) {
      setIsSecretAdminGateOpen(true);
    }

    // Keyboard shortcut for Secret Municipal Admin Gate: Ctrl + Shift + A (or Cmd + Shift + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsSecretAdminGateOpen(true);
      }
    };
    const handleWindowFocus = () => loadReports(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('focus', handleWindowFocus);
    const refreshInterval = isLiveSupabaseConfigured() ? window.setInterval(() => loadReports(true), 15_000) : undefined;

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus', handleWindowFocus);
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, []);

  // Handle Role Change
  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    if (newRole === 'admin') {
      setCurrentTab('admin-command-center');
      showToast('Switched to Municipal Admin Command Mode 🛡️', 'admin_panel_settings');
    } else {
      setCurrentTab('citizen-portal');
      showToast('Returned to Citizen Portal Mode', 'person');
    }
  };

  // Upvote Report
  const handleUpvote = async (id: string) => {
    const res = await toggleReportUpvote(id);
    if (res) {
      setReports((prev) => prev.map((r) => (r.id === id ? res.report : r)));
      showToast(res.upvoted ? `Upvoted ${id}! (+1 Priority Boost)` : `Removed upvote from ${id}`, 'thumb_up');
    }
  };

  // Update Status
  const handleUpdateStatus = async (id: string, newStatus: IncidentStatus, comment?: string) => {
    try {
      const updated = await updateReportStatus(id, newStatus, currentUser?.fullName || 'Municipal Admin', comment);
      if (updated) {
        setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
        const refreshedNotifs = await fetchNotifications();
        setNotifications(refreshedNotifs);
        setUnreadNotifs(true);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update this report.', 'error');
    }
  };

  // Update Crew
  const handleUpdateCrew = async (id: string, crew: string, directive?: string) => {
    try {
      const updated = await updateReportCrew(id, crew, directive);
      if (updated) {
        setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
        const refreshedNotifs = await fetchNotifications();
        setNotifications(refreshedNotifs);
        setUnreadNotifs(true);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not dispatch the crew.', 'error');
    }
  };

  // Add Comment
  const handleAddComment = async (reportId: string, text: string) => {
    const author = currentUser?.fullName || 'Resident Reporter';
    const initials = author.substring(0, 2).toUpperCase();
    const roleTag = currentUser?.role === 'admin' ? 'Municipal Officer' : 'Verified Citizen';

    const updated = await addReportComment(reportId, author, initials, roleTag, text);
    if (updated) {
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    }
  };

  // Submit New Report
  const handleNewReport = async (newReportData: Partial<CivicReport>) => {
    const fullReport: CivicReport = {
      id: newReportData.id || `CIV-2026-${Math.floor(10000 + Math.random() * 89999)}`,
      userId: currentUser?.id,
      reporterName: currentUser?.fullName || 'Verified Citizen',
      title: newReportData.title || 'Civic Infrastructure Defect',
      category: newReportData.category || 'Roads & Transportation',
      subcategory: newReportData.subcategory,
      categoryIcon: newReportData.categoryIcon || 'warning',
      department: newReportData.department || 'Municipal Public Works',
      location: newReportData.location || 'Municipal Transit Sector',
      landmark: newReportData.landmark,
      ward: newReportData.ward || 'Central Ward',
      coordinates: newReportData.coordinates || '21.1458° N, 79.0882° E',
      latitude: newReportData.latitude || 21.1458,
      longitude: newReportData.longitude || 79.0882,
      imageUrl: newReportData.imageUrl || '',
      imageAlt: newReportData.title || 'Reported civic issue',
      timestamp: 'Just now',
      status: 'REPORTED',
      priority: newReportData.priority || 'MEDIUM',
      upvotes: 1,
      hasUpvoted: true,
      slaRemaining: newReportData.slaRemaining || '48h remaining',
      confidenceScore: newReportData.confidenceScore || 92,
      description: newReportData.description || 'Reported via CivicAI platform.',
      hazardAssessment: newReportData.hazardAssessment || 'Assessed by CivicAI Vision Pipeline.',
      recommendedDispatch: newReportData.recommendedDispatch || 'Standard civil response unit.',
      isPrivate: false,
      categoryMetadata: newReportData.categoryMetadata,
      aiExplanation: newReportData.aiExplanation,
      auditTrail: newReportData.auditTrail || [
        {
          id: 'step_init',
          stage: 'Report Submitted',
          timestamp: 'Just now',
          description: 'Logged on civic ledger. AI diagnostics confirmed.',
          isComplete: true,
        },
      ],
      comments: newReportData.comments || [],
    };

    const saved = await createReport(fullReport);
    setReports((prev) => [saved, ...prev]);

    const notifs = await fetchNotifications();
    setNotifications(notifs);
    setUnreadNotifs(true);
  };

  // Secret Admin PIN Unlock Handler
  const handleAdminUnlocked = (adminUser: UserProfile) => {
    setCurrentUser(adminUser);
    setUserRole('admin');
    setCurrentTab('admin-command-center');
  };

  // Clear Notifications
  const handleClearNotifs = () => {
    setUnreadNotifs(false);
    setShowNotifDrawer(true);
    markAllNotificationsRead();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-body-base text-slate-900 antialiased flex flex-col selection:bg-teal-100 selection:text-teal-900">
      {/* Universal Fixed Header (Admin lock hidden from public view!) */}
      <Header
        currentTab={currentTab}
        userRole={userRole}
        currentUser={currentUser}
        onRoleChange={handleRoleChange}
        onShowToast={showToast}
        unreadNotifs={unreadNotifs}
        onClearNotifs={handleClearNotifs}
        onOpenProfile={() => setIsProfileOpen(true)}
        onUnlockAdmin={() => setIsSecretAdminGateOpen(true)}
        onGoBack={() => {
          if (currentTab === 'report-issue-flow') {
            setCurrentTab('citizen-portal');
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto pt-20 px-3 sm:px-6">
        {currentTab === 'citizen-portal' && (
          <CitizenPortalView
            reports={reports}
            onNavigate={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onShowToast={showToast}
            onUpvoteReport={handleUpvote}
            onOpenReportDetail={(report) => setSelectedReportDetail(report)}
          />
        )}

        {currentTab === 'report-issue-flow' && (
          <ReportIssueFlowView
            currentUser={currentUser}
            onNavigate={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onShowToast={showToast}
            onSubmitNewReport={handleNewReport}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentTab === 'my-reports-tracking' && (
          <MyReportsTrackingView
            reports={reports}
            onNavigate={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onShowToast={showToast}
            onUpvoteReport={handleUpvote}
            onUpdateReportStatus={handleUpdateStatus}
            onAddComment={handleAddComment}
          />
        )}

        {currentTab === 'admin-command-center' && userRole === 'admin' && (
          <AdminCommandCenterView
            currentUser={currentUser}
            reports={reports}
            onShowToast={showToast}
            onUpdateReportStatus={handleUpdateStatus}
            onUpdateReportCrew={handleUpdateCrew}
          />
        )}
      </main>

      {/* Persistent Bottom Navigation (Admin tab ONLY shown if authenticated as Admin!) */}
      <BottomNav
        currentTab={currentTab}
        userRole={userRole}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Toast Notification Popups */}
      <Toast message={toastMessage} icon={toastIcon} onDismiss={() => setToastMessage(null)} />

      {/* Citizen Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'admin') setUserRole('admin');
        }}
        onShowToast={showToast}
      />

      {/* Citizen Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        currentUser={currentUser}
        reports={reports}
        onClose={() => setIsProfileOpen(false)}
        onSignOut={() => {
          AuthService.signOut();
          setCurrentUser(null);
          setUserRole('citizen');
          setCurrentTab('citizen-portal');
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onShowToast={showToast}
        onUpdateUser={(updated) => setCurrentUser(updated)}
        onTrackReport={() => {
          setCurrentTab('my-reports-tracking');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Secret Super Admin Gate Modal (Invisible to Public) */}
      <SecretAdminGateModal
        isOpen={isSecretAdminGateOpen}
        onClose={() => setIsSecretAdminGateOpen(false)}
        onSuccess={handleAdminUnlocked}
        onShowToast={showToast}
      />

      {/* Notifications Drawer */}
      {showNotifDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-xl space-y-4 max-h-[80vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                </div>
                <h4 className="font-headline-md text-base text-slate-900 font-bold">Municipal Notifications</h4>
              </div>
              <button
                onClick={() => setShowNotifDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-slate-400">No new notifications. You're all caught up!</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => {
                      setShowNotifDrawer(false);
                      setCurrentTab('my-reports-tracking');
                    }}
                  >
                    <div className="flex justify-between items-center text-[11px] font-label-code text-slate-400 mb-1">
                      <span className="text-teal-800 font-bold uppercase">{n.type}</span>
                      <span>{n.timestamp}</span>
                    </div>
                    <div className="font-bold text-slate-900 text-xs">{n.title}</div>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowNotifDrawer(false)}
              className="w-full py-2.5 bg-teal-700 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-teal-800 transition-colors cursor-pointer"
            >
              Close Notifications
            </button>
          </div>
        </div>
      )}

      {/* Selected Report Inspection Drawer on Report Card Click */}
      {selectedReportDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-label-code text-xs text-teal-800 font-bold">{selectedReportDetail.id}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase">
                  {selectedReportDetail.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedReportDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {selectedReportDetail.imageUrl && (
                <div className="h-48 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
                  <img
                    src={selectedReportDetail.imageUrl}
                    alt={selectedReportDetail.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <h3 className="text-lg text-slate-900 font-bold tracking-tight">
                  {selectedReportDetail.title}
                </h3>
                <p className="text-slate-500 mt-0.5">
                  {selectedReportDetail.location} • {selectedReportDetail.ward}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-slate-700">
                <p className="leading-relaxed text-slate-800">{selectedReportDetail.description}</p>
                <div className="flex justify-between items-center pt-2 text-teal-800 text-[11px] border-t border-slate-200 font-semibold">
                  <span>{selectedReportDetail.assignedCrew || selectedReportDetail.department}</span>
                  <span className="text-slate-500">{selectedReportDetail.slaRemaining}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleUpvote(selectedReportDetail.id);
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer border border-slate-200"
                >
                  <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                  <span>Upvote ({selectedReportDetail.upvotes || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportDetail(null);
                    setCurrentTab('my-reports-tracking');
                  }}
                  className="flex-1 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  <span>Track Live Status</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
