import { CivicReport, IncidentStatus, NotificationItem, UserProfile } from '../types';

const STORAGE_KEYS = {
  REPORTS: 'civicai_reports_v2',
  USERS: 'civicai_users_v2',
  CURRENT_USER: 'civicai_current_user_v2',
  NOTIFICATIONS: 'civicai_notifications_v2',
  STATUS_HISTORY: 'civicai_status_history_v2',
};

// Check for live Supabase configuration
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isLiveSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project-url') &&
    !SUPABASE_ANON_KEY.includes('your-anon-key')
  );
};

// Local Persistent Storage Engine (ensures zero data loss, offline resilience)
class PersistentStore {
  static get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data) as T;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error writing ${key} to storage:`, e);
    }
  }
}

// -----------------------------------------------------------------------------
// Image Storage (Supabase Storage Bucket or Robust Local Compression)
// -----------------------------------------------------------------------------
export async function uploadImage(file: File): Promise<string> {
  if (isLiveSupabaseConfigured()) {
    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const url = `${SUPABASE_URL}/storage/v1/object/civic-reports/${fileName}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': file.type,
        },
        body: file,
      });

      if (res.ok) {
        return `${SUPABASE_URL}/storage/v1/object/public/civic-reports/${fileName}`;
      }
    } catch (err) {
      console.warn('Supabase storage upload failed, falling back to local storage engine:', err);
    }
  }

  // Resilient fallback: Return clean DataURL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// -----------------------------------------------------------------------------
// Reports CRUD Operations
// -----------------------------------------------------------------------------
export async function fetchAllReports(): Promise<CivicReport[]> {
  if (isLiveSupabaseConfigured()) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?select=*&order=created_at.desc`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        const liveData = await res.json();
        if (Array.isArray(liveData) && liveData.length > 0) {
          // Merge with local state
          return liveData.map(mapSupabaseRowToReport);
        }
      }
    } catch (e) {
      console.warn('Could not query Supabase REST, falling back to persistent local storage:', e);
    }
  }

  // Fresh initial database state: starts empty (no fake mock reports!)
  return PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
}

export async function createReport(report: CivicReport): Promise<CivicReport> {
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const updated = [report, ...currentReports];
  PersistentStore.set(STORAGE_KEYS.REPORTS, updated);

  // Sync to Supabase if live
  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          report_id: report.id,
          user_id: report.userId,
          category: report.category,
          subcategory: report.subcategory || report.category,
          title: report.title,
          description: report.description,
          location: report.location,
          landmark: report.landmark,
          severity: report.priority,
          status: report.status,
          image_url: report.imageUrl,
          ai_detected_issue: report.title,
          ai_category: report.category,
          ai_confidence: report.confidenceScore,
          ai_severity: report.priority,
          ai_explanation: report.hazardAssessment,
          assigned_authority: report.department,
        }),
      });
    } catch (e) {
      console.error('Supabase async sync failed:', e);
    }
  }

  // Generate notification for submission
  await addNotification({
    id: `notif_${Date.now()}`,
    reportId: report.id,
    title: 'Civic Report Registered',
    message: `Your report ${report.id} has been logged in the municipal system. AI triage completed.`,
    type: 'status',
    timestamp: 'Just now',
    isRead: false,
  });

  return report;
}

export async function updateReportStatus(
  reportId: string,
  newStatus: IncidentStatus,
  changedBy = 'Municipal Admin',
  comment = ''
): Promise<CivicReport | null> {
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const idx = currentReports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;

  const target = currentReports[idx];
  const updatedAudit = [...target.auditTrail];

  // Stage mapping
  const stageMap: Record<IncidentStatus, string> = {
    REPORTED: 'Report Submitted',
    'UNDER REVIEW': 'Under Authority Review',
    ASSIGNED: 'Assigned to Municipal Department',
    'IN PROGRESS': 'Repair Crew Dispatched & In Progress',
    RESOLVED: 'Civic Issue Inspected & Resolved',
    REJECTED: 'Issue Reviewed & Marked Ineligible',
  };

  updatedAudit.push({
    id: `step_${Date.now()}`,
    stage: stageMap[newStatus] || newStatus,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    description: comment || `Status updated to ${newStatus} by ${changedBy}.`,
    isComplete: true,
    isCurrent: newStatus !== 'RESOLVED',
  });

  const updatedReport: CivicReport = {
    ...target,
    status: newStatus,
    slaRemaining: newStatus === 'RESOLVED' ? 'Completed' : target.slaRemaining,
    auditTrail: updatedAudit,
  };

  currentReports[idx] = updatedReport;
  PersistentStore.set(STORAGE_KEYS.REPORTS, currentReports);

  // Sync with Supabase
  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/reports?report_id=eq.${reportId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : null,
        }),
      });
    } catch (e) {
      console.warn('Could not sync status to Supabase:', e);
    }
  }

  // Trigger Notification for Citizen
  await addNotification({
    id: `notif_${Date.now()}`,
    reportId: target.id,
    title: `Update on ${target.id}`,
    message: `Status transitioned to "${newStatus}". ${comment || 'Municipal response teams are coordinating action.'}`,
    type: 'status',
    timestamp: 'Just now',
    isRead: false,
  });

  return updatedReport;
}

export async function updateReportCrew(
  reportId: string,
  crew: string,
  directive = ''
): Promise<CivicReport | null> {
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const idx = currentReports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;

  const target = currentReports[idx];
  const updatedAudit = [...target.auditTrail];

  updatedAudit.push({
    id: `step_${Date.now()}`,
    stage: 'Field Crew Dispatched',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    description: `Dispatched ${crew}. Directive: "${directive || 'Priority inspection & resolution'}"`,
    isComplete: true,
    isCurrent: true,
  });

  const updatedReport: CivicReport = {
    ...target,
    assignedCrew: crew,
    status: 'ASSIGNED',
    auditTrail: updatedAudit,
  };

  currentReports[idx] = updatedReport;
  PersistentStore.set(STORAGE_KEYS.REPORTS, currentReports);

  await addNotification({
    id: `notif_${Date.now()}`,
    reportId: target.id,
    title: `Crew Dispatched to ${target.id}`,
    message: `${crew} has been assigned to attend this issue on site.`,
    type: 'dispatch',
    timestamp: 'Just now',
    isRead: false,
  });

  return updatedReport;
}

export async function addReportComment(
  reportId: string,
  author: string,
  initials: string,
  roleTag: string,
  text: string
): Promise<CivicReport | null> {
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const idx = currentReports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;

  const target = currentReports[idx];
  const newComment = {
    id: `c_${Date.now()}`,
    author,
    initials,
    roleTag,
    timestamp: 'Just now',
    text,
  };

  target.comments.push(newComment);
  currentReports[idx] = { ...target };
  PersistentStore.set(STORAGE_KEYS.REPORTS, currentReports);

  return target;
}

export async function toggleReportUpvote(reportId: string): Promise<{ report: CivicReport; upvoted: boolean } | null> {
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const idx = currentReports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;

  const target = currentReports[idx];
  const hasUpvoted = !target.hasUpvoted;
  target.hasUpvoted = hasUpvoted;
  target.upvotes = hasUpvoted ? target.upvotes + 1 : Math.max(0, target.upvotes - 1);

  currentReports[idx] = { ...target };
  PersistentStore.set(STORAGE_KEYS.REPORTS, currentReports);

  return { report: target, upvoted: hasUpvoted };
}

// -----------------------------------------------------------------------------
// Notifications Operations
// -----------------------------------------------------------------------------
export async function fetchNotifications(): Promise<NotificationItem[]> {
  return PersistentStore.get<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, [
    {
      id: 'notif_welcome',
      title: 'Welcome to CivicAI',
      message: 'One Platform. Every Civic Issue. Report any visible municipal defect in seconds with AI Vision.',
      type: 'system',
      timestamp: 'Today',
      isRead: false,
    },
  ]);
}

export async function addNotification(notif: NotificationItem): Promise<void> {
  const current = PersistentStore.get<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  PersistentStore.set(STORAGE_KEYS.NOTIFICATIONS, [notif, ...current]);
}

export async function markAllNotificationsRead(): Promise<void> {
  const current = PersistentStore.get<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = current.map((n) => ({ ...n, isRead: true }));
  PersistentStore.set(STORAGE_KEYS.NOTIFICATIONS, updated);
}

// Helper mapper for Supabase rows
function mapSupabaseRowToReport(row: any): CivicReport {
  return {
    id: row.report_id || `CIV-2026-${row.id?.substring(0, 5)}`,
    userId: row.user_id,
    title: row.title || 'Civic Issue',
    category: row.category || 'Roads & Transportation',
    subcategory: row.subcategory,
    categoryIcon: 'location_city',
    department: row.assigned_authority || 'Municipal Corporation',
    location: row.location || 'Local Municipal Ward',
    ward: row.landmark || 'Ward Central',
    coordinates: `${row.latitude || 21.1458}° N, ${row.longitude || 79.0882}° E`,
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrl: row.image_url || '',
    imageAlt: row.title || 'Reported civic issue',
    timestamp: new Date(row.created_at || Date.now()).toLocaleDateString(),
    status: row.status || 'REPORTED',
    priority: row.severity || 'MEDIUM',
    upvotes: 1,
    slaRemaining: '48h remaining',
    confidenceScore: row.ai_confidence || 92,
    description: row.description || '',
    hazardAssessment: row.ai_explanation || 'Assessed via CivicAI Vision Engine.',
    recommendedDispatch: 'Standard municipal inspection unit.',
    isPrivate: true,
    auditTrail: [
      {
        id: 'step_init',
        stage: 'Report Submitted',
        timestamp: 'Logged',
        description: 'Received on municipal civic portal.',
        isComplete: true,
      },
    ],
    comments: [],
  };
}
