import { CivicReport, IncidentSeverity, IncidentStatus, NotificationItem } from '../types';
import { AuthService } from './authService';
import {
  getResponseError,
  getValidAccessToken,
  isLiveSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './supabaseConfig';

export { isLiveSupabaseConfigured } from './supabaseConfig';

const STORAGE_KEYS = {
  REPORTS: 'civicai_reports_v2',
  NOTIFICATIONS: 'civicai_notifications_v2',
};

class PersistentStore {
  static get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function toErrorMessage(prefix: string, details: string): Error {
  return new Error(`${prefix}: ${details}`);
}

async function requireCloudToken(): Promise<string> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Please sign in before submitting or updating a report.');
  return token;
}

function authHeaders(accessToken: string, extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

function publicHeaders(extra: HeadersInit = {}): HeadersInit {
  return { apikey: SUPABASE_ANON_KEY, ...extra };
}

function normalizeStatus(status: string | null | undefined): IncidentStatus {
  const map: Record<string, IncidentStatus> = {
    Submitted: 'REPORTED',
    'Under Review': 'UNDER REVIEW',
    Assigned: 'ASSIGNED',
    'In Progress': 'IN PROGRESS',
    Resolved: 'RESOLVED',
    Rejected: 'REJECTED',
  };
  if (status && status in map) return map[status];
  return (status as IncidentStatus) || 'REPORTED';
}

function normalizeSeverity(severity: string | null | undefined): IncidentSeverity {
  return ((severity || 'MEDIUM').toUpperCase() as IncidentSeverity);
}

function serializeReport(report: CivicReport) {
  return {
    report_id: report.id,
    user_id: report.userId,
    category: report.category,
    subcategory: report.subcategory || report.category,
    title: report.title,
    description: report.description,
    location: report.location,
    landmark: report.landmark || null,
    ward: report.ward,
    latitude: report.latitude || null,
    longitude: report.longitude || null,
    severity: report.priority,
    status: report.status,
    image_url: report.imageUrl,
    ai_detected_issue: report.title,
    ai_category: report.category,
    ai_confidence: report.confidenceScore,
    ai_severity: report.priority,
    ai_explanation: report.hazardAssessment,
    assigned_authority: report.department,
    assigned_crew: report.assignedCrew || null,
    category_metadata: report.categoryMetadata || {},
    audit_trail: report.auditTrail || [],
    comments: report.comments || [],
    upvotes: report.upvotes || 0,
  };
}

function mapSupabaseRowToReport(row: any): CivicReport {
  return {
    id: row.report_id,
    userId: row.user_id || undefined,
    title: row.title || 'Civic Issue',
    category: row.category || 'Other Civic Issues',
    subcategory: row.subcategory || undefined,
    categoryIcon: 'location_city',
    department: row.assigned_authority || 'Municipal Corporation',
    assignedCrew: row.assigned_crew || undefined,
    location: row.location || 'Local Municipal Ward',
    landmark: row.landmark || undefined,
    ward: row.ward || 'Central Ward',
    coordinates:
      row.latitude != null && row.longitude != null ? `${row.latitude}° N, ${row.longitude}° E` : 'Location pending',
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    imageUrl: row.image_url || '',
    imageAlt: row.title || 'Reported civic issue',
    timestamp: new Date(row.created_at || Date.now()).toLocaleDateString(),
    status: normalizeStatus(row.status),
    priority: normalizeSeverity(row.severity),
    upvotes: Number(row.upvotes || 0),
    slaRemaining: normalizeStatus(row.status) === 'RESOLVED' ? 'Completed' : '48h remaining',
    confidenceScore: Number(row.ai_confidence || 92),
    description: row.description || '',
    hazardAssessment: row.ai_explanation || 'Assessed via CivicAI Vision Engine.',
    recommendedDispatch: 'Standard municipal inspection unit.',
    isPrivate: true,
    categoryMetadata: row.category_metadata || {},
    auditTrail: Array.isArray(row.audit_trail) && row.audit_trail.length ? row.audit_trail : defaultAuditTrail(row),
    comments: Array.isArray(row.comments) ? row.comments : [],
  };
}

function defaultAuditTrail(row: any) {
  return [
    {
      id: 'step_init',
      stage: 'Report Submitted',
      timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'Logged',
      description: 'Received on the municipal civic portal.',
      isComplete: true,
      isCurrent: normalizeStatus(row.status) !== 'RESOLVED',
    },
  ];
}

async function fetchCloudReport(reportId: string, accessToken: string): Promise<CivicReport> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?select=*&report_id=eq.${encodeURIComponent(reportId)}&limit=1`,
    { headers: authHeaders(accessToken) }
  );
  if (!response.ok) throw toErrorMessage('Could not load the report', await getResponseError(response));
  const rows = await response.json();
  if (!rows[0]) throw new Error('This report could not be found in the shared database.');
  return mapSupabaseRowToReport(rows[0]);
}

async function patchCloudReport(reportId: string, patch: Record<string, unknown>, accessToken: string): Promise<CivicReport> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?report_id=eq.${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw toErrorMessage('Could not save the report update', await getResponseError(response));
  const rows = await response.json();
  if (!rows[0]) throw new Error('The report update was not accepted.');
  const mapped = mapSupabaseRowToReport(rows[0]);
  updateLocalReport(mapped);
  return mapped;
}

function updateLocalReport(report: CivicReport): void {
  const reports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const index = reports.findIndex((item) => item.id === report.id);
  if (index === -1) reports.unshift(report);
  else reports[index] = report;
  PersistentStore.set(STORAGE_KEYS.REPORTS, reports);
}

function stageForStatus(status: IncidentStatus): string {
  const stageMap: Record<IncidentStatus, string> = {
    REPORTED: 'Report Submitted',
    'UNDER REVIEW': 'Under Authority Review',
    ASSIGNED: 'Assigned to Municipal Department',
    'IN PROGRESS': 'Repair Crew Dispatched & In Progress',
    RESOLVED: 'Civic Issue Inspected & Resolved',
    REJECTED: 'Issue Reviewed & Marked Ineligible',
  };
  return stageMap[status];
}

// -----------------------------------------------------------------------------
// Image storage
// -----------------------------------------------------------------------------
export async function uploadImage(file: File): Promise<string> {
  if (!isLiveSupabaseConfigured()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const accessToken = await requireCloudToken();
  const userId = AuthService.getCurrentUser()?.id;
  if (!userId) throw new Error('Please sign in again before uploading evidence.');

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/civic-reports/${objectPath}`, {
    method: 'POST',
    headers: authHeaders(accessToken, { 'Content-Type': file.type || 'application/octet-stream' }),
    body: file,
  });
  if (!response.ok) throw toErrorMessage('Evidence photo could not be uploaded', await getResponseError(response));

  return `${SUPABASE_URL}/storage/v1/object/public/civic-reports/${objectPath}`;
}

// -----------------------------------------------------------------------------
// Reports CRUD
// -----------------------------------------------------------------------------
export async function fetchAllReports(): Promise<CivicReport[]> {
  if (!isLiveSupabaseConfigured()) {
    return PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?select=*&order=created_at.desc`, {
    headers: publicHeaders(),
  });
  if (!response.ok) throw toErrorMessage('Could not load shared reports', await getResponseError(response));

  const reports = (await response.json()).map(mapSupabaseRowToReport);
  PersistentStore.set(STORAGE_KEYS.REPORTS, reports);
  return reports;
}

export async function createReport(report: CivicReport): Promise<CivicReport> {
  if (!isLiveSupabaseConfigured()) {
    updateLocalReport(report);
  } else {
    const accessToken = await requireCloudToken();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: authHeaders(accessToken, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(serializeReport(report)),
    });
    if (!response.ok) throw toErrorMessage('Report was not saved to the shared database', await getResponseError(response));
    const rows = await response.json();
    if (!rows[0]) throw new Error('The database did not confirm your report. Please retry.');
    report = mapSupabaseRowToReport(rows[0]);
    updateLocalReport(report);
  }

  await addNotification({
    id: `notif_${Date.now()}`,
    reportId: report.id,
    title: 'Civic Report Registered',
    message: `Your report ${report.id} has been saved to the municipal system.`,
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
  if (!isLiveSupabaseConfigured()) {
    const local = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
    const target = local.find((report) => report.id === reportId);
    if (!target) return null;
    const updated = {
      ...target,
      status: newStatus,
      slaRemaining: newStatus === 'RESOLVED' ? 'Completed' : target.slaRemaining,
      auditTrail: [
        ...target.auditTrail,
        {
          id: `step_${Date.now()}`,
          stage: stageForStatus(newStatus),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          description: comment || `Status updated to ${newStatus} by ${changedBy}.`,
          isComplete: true,
          isCurrent: newStatus !== 'RESOLVED',
        },
      ],
    };
    updateLocalReport(updated);
    return updated;
  }

  const accessToken = await requireCloudToken();
  const target = await fetchCloudReport(reportId, accessToken);
  const auditTrail = [
    ...target.auditTrail,
    {
      id: `step_${Date.now()}`,
      stage: stageForStatus(newStatus),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: comment || `Status updated to ${newStatus} by ${changedBy}.`,
      isComplete: true,
      isCurrent: newStatus !== 'RESOLVED',
    },
  ];
  const updated = await patchCloudReport(
    reportId,
    { status: newStatus, audit_trail: auditTrail, resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : null },
    accessToken
  );
  await addNotification({
    id: `notif_${Date.now()}`,
    reportId,
    title: `Update on ${reportId}`,
    message: `Status transitioned to "${newStatus}". ${comment || 'Municipal response teams are coordinating action.'}`,
    type: 'status',
    timestamp: 'Just now',
    isRead: false,
  });
  return updated;
}

export async function updateReportCrew(reportId: string, crew: string, directive = ''): Promise<CivicReport | null> {
  if (!isLiveSupabaseConfigured()) {
    const local = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
    const target = local.find((report) => report.id === reportId);
    if (!target) return null;
    const updated = { ...target, assignedCrew: crew, status: 'ASSIGNED' as IncidentStatus };
    updateLocalReport(updated);
    return updated;
  }

  const accessToken = await requireCloudToken();
  const target = await fetchCloudReport(reportId, accessToken);
  const auditTrail = [
    ...target.auditTrail,
    {
      id: `step_${Date.now()}`,
      stage: 'Field Crew Dispatched',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `Dispatched ${crew}. Directive: "${directive || 'Priority inspection & resolution'}"`,
      isComplete: true,
      isCurrent: true,
    },
  ];
  return patchCloudReport(reportId, { assigned_crew: crew, status: 'ASSIGNED', audit_trail: auditTrail }, accessToken);
}

export async function addReportComment(
  reportId: string,
  author: string,
  initials: string,
  roleTag: string,
  text: string
): Promise<CivicReport | null> {
  const comment = { id: `c_${Date.now()}`, author, initials, roleTag, timestamp: 'Just now', text };
  if (!isLiveSupabaseConfigured()) {
    const local = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
    const target = local.find((report) => report.id === reportId);
    if (!target) return null;
    const updated = { ...target, comments: [...target.comments, comment] };
    updateLocalReport(updated);
    return updated;
  }

  const accessToken = await requireCloudToken();
  const target = await fetchCloudReport(reportId, accessToken);
  return patchCloudReport(reportId, { comments: [...target.comments, comment] }, accessToken);
}

export async function toggleReportUpvote(reportId: string): Promise<{ report: CivicReport; upvoted: boolean } | null> {
  const reports = await fetchAllReports();
  const report = reports.find((item) => item.id === reportId);
  if (!report) return null;
  const upvoted = !report.hasUpvoted;
  const updated = { ...report, hasUpvoted: upvoted, upvotes: Math.max(0, report.upvotes + (upvoted ? 1 : -1)) };

  if (isLiveSupabaseConfigured()) {
    const accessToken = await requireCloudToken();
    const persisted = await patchCloudReport(reportId, { upvotes: updated.upvotes }, accessToken);
    return { report: { ...persisted, hasUpvoted: upvoted }, upvoted };
  }
  updateLocalReport(updated);
  return { report: updated, upvoted };
}

// -----------------------------------------------------------------------------
// Browser-local notifications. Report data itself is always stored in Supabase.
// -----------------------------------------------------------------------------
export async function fetchNotifications(): Promise<NotificationItem[]> {
  return PersistentStore.get<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, [
    {
      id: 'notif_welcome',
      title: 'Welcome to CivicAI',
      message: 'Report any visible municipal defect in seconds with CivicAI.',
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
  PersistentStore.set(STORAGE_KEYS.NOTIFICATIONS, current.map((item) => ({ ...item, isRead: true })));
}
