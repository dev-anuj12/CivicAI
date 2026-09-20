import {
  CivicHotspot,
  CivicIssue,
  CivicReport,
  CommunityVerification,
  DepartmentKPIs,
  DepartmentStats,
  DuplicateMatch,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IntegrityStatus,
  NotificationItem,
  PriorityLevel,
  ReportIntegrityRecord,
  ResolutionEvidence,
} from '../types';
import { AuthService } from './authService';
import {
  getResponseError,
  getUserIdFromJwt,
  getValidAccessToken,
  isLiveSupabaseConfigured,
  isUuid,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './supabaseConfig';
import { calculateExplainablePriority } from '../ai/priorityEngine';
import { calculateExplainableSeverity } from '../ai/severity';
import { assessReportIntegrity } from '../ai/integrityEngine';
import { detectDuplicateComplaints } from '../ai/duplicateDetector';

export { isLiveSupabaseConfigured } from './supabaseConfig';

const STORAGE_KEYS = {
  REPORTS: 'civicai_reports_v3',
  ISSUES: 'civicai_issues_v3',
  DUPLICATES: 'civicai_duplicates_v3',
  VERIFICATIONS: 'civicai_verifications_v3',
  RESOLUTION_EVIDENCE: 'civicai_resolution_evidence_v3',
  INTEGRITY: 'civicai_integrity_v3',
  NOTIFICATIONS: 'civicai_notifications_v3',
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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('PersistentStore write error:', e);
    }
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
  const validUserId = isUuid(report.userId) ? report.userId : null;
  const metadata = {
    ...(report.categoryMetadata || {}),
    reporterName: report.reporterName || 'Verified Citizen',
    reporterContact: report.reporterContact || undefined,
    reporterUserId: report.userId || undefined,
  };
  return {
    report_id: report.id,
    user_id: validUserId,
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
    category_metadata: metadata,
    audit_trail: report.auditTrail || [],
    comments: report.comments || [],
    upvotes: report.upvotes || 0,
    issue_id: report.issueId || null,
  };
}

const INDIAN_CITY_COORDINATES: Record<string, [number, number]> = {
  nagpur: [21.1458, 79.0882],
  delhi: [28.6139, 77.2090],
  mumbai: [19.0760, 72.8777],
  bengaluru: [12.9716, 77.5946],
  pune: [18.5204, 73.8567],
  hyderabad: [17.3850, 78.4867],
  chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639],
};

function resolveIndianCoordinates(row: any): { lat: number; lng: number } | null {
  if (row.latitude != null && row.longitude != null && !isNaN(Number(row.latitude)) && !isNaN(Number(row.longitude))) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)) {
      return { lat, lng };
    }
  }

  const rawCoord = String(row.coordinates || '');
  const matches = rawCoord.match(/[-+]?([0-9]*\.[0-9]+|[0-9]+)/g);
  if (matches && matches.length >= 2) {
    const lat = parseFloat(matches[0]);
    const lng = parseFloat(matches[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) {
      return { lat, lng };
    }
  }

  const combinedText = `${row.ward || ''} ${row.location || ''} ${row.landmark || ''}`.toLowerCase();
  for (const [cityName, coords] of Object.entries(INDIAN_CITY_COORDINATES)) {
    if (combinedText.includes(cityName)) {
      const wardNum = parseInt(combinedText.replace(/[^0-9]/g, ''), 10) || 1;
      const jitterLat = (((wardNum * 17) % 40) - 20) * 0.0015;
      const jitterLng = (((wardNum * 23) % 40) - 20) * 0.0015;
      return {
        lat: Math.round((coords[0] + jitterLat) * 10000) / 10000,
        lng: Math.round((coords[1] + jitterLng) * 10000) / 10000,
      };
    }
  }

  if (combinedText.includes('ward') || row.location || row.title) {
    const hash = String(row.report_id || row.id || '1')
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetLat = ((hash % 30) - 15) * 0.002;
    const offsetLng = (((hash >> 2) % 30) - 15) * 0.002;
    return {
      lat: Math.round((21.1458 + offsetLat) * 10000) / 10000,
      lng: Math.round((79.0882 + offsetLng) * 10000) / 10000,
    };
  }

  return { lat: 21.1458, lng: 79.0882 };
}

function mapSupabaseRowToReport(row: any): CivicReport {
  const resolvedCoords = resolveIndianCoordinates(row) || { lat: 21.1458, lng: 79.0882 };
  const lat = resolvedCoords.lat;
  const lng = resolvedCoords.lng;
  const metadata = row.category_metadata || {};

  return {
    id: row.report_id || row.id,
    userId: row.user_id || metadata.reporterUserId || undefined,
    reporterName: row.reporter_name || metadata.reporterName || 'Verified Citizen',
    reporterContact: row.reporter_contact || metadata.reporterContact || undefined,
    title: row.title || 'Civic Issue',
    category: row.category || 'Other Civic Issues',
    subcategory: row.subcategory || undefined,
    categoryIcon: 'location_city',
    department: row.assigned_authority || 'Municipal Corporation',
    assignedCrew: row.assigned_crew || undefined,
    location: row.location || 'Local Municipal Ward',
    landmark: row.landmark || undefined,
    ward: row.ward || 'Central Ward',
    coordinates: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
    latitude: lat,
    longitude: lng,
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
    categoryMetadata: metadata,
    auditTrail: Array.isArray(row.audit_trail) && row.audit_trail.length ? row.audit_trail : defaultAuditTrail(row),
    comments: Array.isArray(row.comments) ? row.comments : [],
    createdAt: row.created_at || new Date().toISOString(),
    resolvedAt: row.resolved_at || undefined,
    issueId: row.issue_id || undefined,
  };
}

function defaultAuditTrail(row: any) {
  return [
    {
      id: 'step_init',
      stage: 'Report Submitted',
      timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'Logged',
      description: 'Received on the municipal civic portal. AI Vision diagnostics confirmed.',
      isComplete: true,
      isCurrent: normalizeStatus(row.status) !== 'RESOLVED',
    },
  ];
}

async function fetchCloudReport(reportId: string, accessToken?: string): Promise<CivicReport> {
  const headers = accessToken ? authHeaders(accessToken) : publicHeaders();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?select=*&report_id=eq.${encodeURIComponent(reportId)}&limit=1`,
    { headers }
  );
  if (!response.ok) throw toErrorMessage('Could not load the report', await getResponseError(response));
  const rows = await response.json();
  if (!rows[0]) throw new Error('This report could not be found in the shared database.');
  return mapSupabaseRowToReport(rows[0]);
}

async function patchCloudReport(reportId: string, patch: Record<string, unknown>, accessToken?: string): Promise<CivicReport> {
  const headers = accessToken
    ? authHeaders(accessToken, { 'Content-Type': 'application/json', Prefer: 'return=representation' })
    : publicHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?report_id=eq.${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    headers,
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
// Image storage & Canvas Compression
// -----------------------------------------------------------------------------
export function compressImageForStorage(dataUrl: string, maxDimension = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function uploadImage(file: File): Promise<string> {
  if (!isLiveSupabaseConfigured()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const raw = reader.result as string;
          const compressed = await compressImageForStorage(raw, 800, 0.75);
          resolve(compressed);
        } catch {
          resolve(reader.result as string);
        }
      };
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
// 1. Reports CRUD & Synchronous Consolidation
// -----------------------------------------------------------------------------
export async function fetchAllReports(): Promise<CivicReport[]> {
  if (!isLiveSupabaseConfigured()) {
    return PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  }

  try {
    const accessToken = await getValidAccessToken();
    const headers = accessToken ? authHeaders(accessToken) : publicHeaders();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?select=*&order=created_at.desc`, {
      headers,
    });
    if (!response.ok) throw toErrorMessage('Could not load shared reports', await getResponseError(response));

    const cloudReports = (await response.json()).map(mapSupabaseRowToReport);
    
    // Merge any locally cached reports that have not synced yet
    const localReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
    const mergedMap = new Map<string, CivicReport>();
    cloudReports.forEach((r: CivicReport) => mergedMap.set(r.id, r));
    localReports.forEach((r: CivicReport) => {
      if (!mergedMap.has(r.id)) mergedMap.set(r.id, r);
    });
    const combined = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    PersistentStore.set(STORAGE_KEYS.REPORTS, combined);
    return combined;
  } catch (err) {
    console.warn('Falling back to local persistent store for reports:', err);
    return PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  }
}

export async function createReport(report: CivicReport): Promise<CivicReport> {
  // Compress base64 image if present to prevent storage quota limits
  if (report.imageUrl && report.imageUrl.startsWith('data:image')) {
    try {
      report.imageUrl = await compressImageForStorage(report.imageUrl, 800, 0.75);
    } catch {}
  }

  // 1. Save Report
  if (!isLiveSupabaseConfigured()) {
    updateLocalReport(report);
  } else {
    try {
      const accessToken = await getValidAccessToken();
      const headers = accessToken
        ? authHeaders(accessToken, { 'Content-Type': 'application/json', Prefer: 'return=representation' })
        : publicHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' });

      // If user has a valid cloud JWT session, attach their Supabase auth UUID
      if (accessToken && (!report.userId || !isUuid(report.userId))) {
        const uid = getUserIdFromJwt(accessToken);
        if (uid && isUuid(uid)) {
          report.userId = uid;
        }
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
        method: 'POST',
        headers,
        body: JSON.stringify(serializeReport(report)),
      });

      if (response.ok) {
        const rows = await response.json();
        if (rows && rows[0]) {
          report = mapSupabaseRowToReport(rows[0]);
        }
        console.log('✅ Report saved to Supabase Cloud ledger:', report.id);
      } else {
        const errorText = await getResponseError(response);
        console.warn('Supabase Cloud reports POST returned error:', errorText);
      }
      updateLocalReport(report);
    } catch (e) {
      console.warn('Cloud create failed, saving to local store:', e);
      updateLocalReport(report);
    }
  }

  // 2. Automatically check duplicates against existing issues & reports
  const allIssues = await fetchCivicIssues();
  const allReports = await fetchAllReports();
  const duplicateMatches = await detectDuplicateComplaints(report, allIssues, allReports);

  if (duplicateMatches.length > 0) {
    const topMatch = duplicateMatches[0];
    report.isDuplicate = true;
    report.duplicateOfId = topMatch.targetIssueId;
    report.duplicateSimilarity = topMatch.similarityScore;

    // Save duplicate match record
    for (const match of duplicateMatches.slice(0, 3)) {
      await saveDuplicateMatch(match);
    }
  }

  // 3. Assess Report Integrity
  const integrity = await assessReportIntegrity(report, allReports);
  report.integrityStatus = integrity.status;
  report.integrityFlags = integrity.flags;
  await saveReportIntegrityRecord(integrity);

  // 4. Consolidate or Create CivicIssue
  await consolidateReportIntoCivicIssue(report, duplicateMatches[0]);

  // 5. Add notification
  await addNotification({
    id: `notif_${Date.now()}`,
    reportId: report.id,
    title: 'Civic Report Registered',
    message: `Your report ${report.id} has been registered and verified by CivicAI.`,
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
  let target = currentReports.find((r) => r.id === reportId);
  if (!target) {
    target = {
      id: reportId,
      title: 'Civic Defect Report',
      category: 'Roads & Transportation',
      categoryIcon: 'report_problem',
      department: 'Municipal Public Works',
      location: 'Municipal Jurisdiction',
      ward: 'Central Ward',
      coordinates: '21.1458° N, 79.0882° E',
      imageUrl: '',
      imageAlt: 'Civic defect image',
      timestamp: 'Just now',
      status: newStatus,
      priority: 'MEDIUM',
      upvotes: 1,
      slaRemaining: '48h remaining',
      confidenceScore: 90,
      description: 'Report updated via CivicAI Command Center.',
      hazardAssessment: 'Assessed by municipal dispatch.',
      recommendedDispatch: 'Standard civil response unit.',
      isPrivate: false,
      auditTrail: [],
      comments: [],
    };
  }

  const newAudit = [
    ...(target.auditTrail || []),
    {
      id: `step_${Date.now()}`,
      stage: stageForStatus(newStatus),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: comment || `Status updated to ${newStatus} by ${changedBy}.`,
      isComplete: true,
      isCurrent: newStatus !== 'RESOLVED',
    },
  ];

  const updatedReport: CivicReport = {
    ...target,
    status: newStatus,
    slaRemaining: newStatus === 'RESOLVED' ? 'Completed' : target.slaRemaining,
    resolvedAt: newStatus === 'RESOLVED' ? new Date().toISOString() : target.resolvedAt,
    auditTrail: newAudit,
  };

  updateLocalReport(updatedReport);

  if (isLiveSupabaseConfigured()) {
    try {
      const accessToken = await getValidAccessToken();
      await patchCloudReport(
        reportId,
        { status: newStatus, audit_trail: newAudit, resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : null },
        accessToken || undefined
      );
    } catch (e) {
      console.warn('Cloud status update failed, updated locally:', e);
    }
  }

  // Also sync status with consolidated CivicIssue
  if (target.issueId) {
    try {
      await syncCivicIssueStatus(target.issueId, newStatus);
    } catch (e) {
      console.warn('Sync issue status fallback:', e);
    }
  }

  try {
    await addNotification({
      id: `notif_${Date.now()}`,
      reportId,
      title: `Update on ${reportId}`,
      message: `Status transitioned to "${newStatus}". ${comment || 'Municipal teams coordinating resolution.'}`,
      type: 'status',
      timestamp: 'Just now',
      isRead: false,
    });
  } catch (e) {
    console.warn('Notification store fallback:', e);
  }

  return updatedReport;
}

export async function updateReportCrew(reportId: string, crew: string, directive = ''): Promise<CivicReport | null> {
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const target = currentReports.find((r) => r.id === reportId);
  if (!target) return null;

  const newAudit = [
    ...(target.auditTrail || []),
    {
      id: `step_${Date.now()}`,
      stage: 'Field Crew Dispatched',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `Dispatched ${crew}. Directive: "${directive || 'Priority inspection & resolution'}"`,
      isComplete: true,
      isCurrent: true,
    },
  ];

  const updated: CivicReport = {
    ...target,
    assignedCrew: crew,
    status: 'ASSIGNED',
    auditTrail: newAudit,
  };

  updateLocalReport(updated);

  if (isLiveSupabaseConfigured()) {
    try {
      const accessToken = await getValidAccessToken();
      await patchCloudReport(reportId, { assigned_crew: crew, status: 'ASSIGNED', audit_trail: newAudit }, accessToken || undefined);
    } catch (e) {
      console.warn('Cloud dispatch update error:', e);
    }
  }

  return updated;
}

export async function addReportComment(
  reportId: string,
  author: string,
  initials: string,
  roleTag: string,
  text: string
): Promise<CivicReport | null> {
  const comment = { id: `c_${Date.now()}`, author, initials, roleTag, timestamp: 'Just now', text };
  const currentReports = PersistentStore.get<CivicReport[]>(STORAGE_KEYS.REPORTS, []);
  const target = currentReports.find((r) => r.id === reportId);
  if (!target) return null;

  const updated = { ...target, comments: [...(target.comments || []), comment] };
  updateLocalReport(updated);

  if (isLiveSupabaseConfigured()) {
    try {
      const accessToken = await getValidAccessToken();
      await patchCloudReport(reportId, { comments: updated.comments }, accessToken || undefined);
    } catch (e) {
      console.warn('Cloud comment sync fallback:', e);
    }
  }

  return updated;
}

export async function toggleReportUpvote(reportId: string): Promise<{ report: CivicReport; upvoted: boolean } | null> {
  const reports = await fetchAllReports();
  const report = reports.find((item) => item.id === reportId);
  if (!report) return null;
  const upvoted = !report.hasUpvoted;
  const updated = { ...report, hasUpvoted: upvoted, upvotes: Math.max(0, report.upvotes + (upvoted ? 1 : -1)) };
  updateLocalReport(updated);

  if (isLiveSupabaseConfigured()) {
    try {
      const accessToken = await getValidAccessToken();
      await patchCloudReport(reportId, { upvotes: updated.upvotes }, accessToken || undefined);
    } catch (e) {
      console.warn('Cloud upvote patch fallback:', e);
    }
  }

  return { report: updated, upvoted };
}

// -----------------------------------------------------------------------------
// 4. SMART CIVIC ISSUE CONSOLIDATION
function mapSupabaseRowToCivicIssue(row: any): CivicIssue {
  return {
    id: row.issue_id || row.id,
    title: row.title || 'Civic Infrastructure Defect',
    category: row.category || 'Roads & Transportation',
    subcategory: row.subcategory || undefined,
    department: row.department || 'Municipal Public Works',
    location: row.location || 'Municipal Sector',
    ward: row.ward || 'Central Ward',
    latitude: Number(row.latitude) || 21.1458,
    longitude: Number(row.longitude) || 79.0882,
    coordinates: row.coordinates || `${Number(row.latitude || 21.1458).toFixed(4)}° N, ${Number(row.longitude || 79.0882).toFixed(4)}° E`,
    status: normalizeStatus(row.status),
    severity: normalizeSeverity(row.severity),
    priority: (row.priority || 'MEDIUM') as PriorityLevel,
    priorityScore: Number(row.priority_score || 50),
    priorityReasons: Array.isArray(row.priority_reasons) ? row.priority_reasons : [],
    severityReasons: Array.isArray(row.severity_reasons) ? row.severity_reasons : [],
    reportsCount: Number(row.reports_count || 1),
    linkedReportIds: Array.isArray(row.linked_report_ids) ? row.linked_report_ids : [],
    primaryImageUrl: row.primary_image_url || '',
    assignedCrew: row.assigned_crew || undefined,
    verificationsCount: Number(row.verifications_count || 0),
    confirmedStillPresentCount: Number(row.still_present_count || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    resolvedAt: row.resolved_at || undefined,
  };
}

function serializeCivicIssue(issue: CivicIssue) {
  return {
    issue_id: issue.id,
    title: issue.title,
    category: issue.category,
    subcategory: issue.subcategory || null,
    department: issue.department,
    location: issue.location,
    ward: issue.ward,
    latitude: issue.latitude,
    longitude: issue.longitude,
    coordinates: issue.coordinates || `${issue.latitude}° N, ${issue.longitude}° E`,
    status: issue.status,
    severity: issue.severity,
    priority: issue.priority,
    priority_score: issue.priorityScore,
    priority_reasons: issue.priorityReasons || [],
    severity_reasons: issue.severityReasons || [],
    reports_count: issue.reportsCount,
    linked_report_ids: issue.linkedReportIds || [],
    primary_image_url: issue.primaryImageUrl,
    assigned_crew: issue.assignedCrew || null,
    verifications_count: issue.verificationsCount,
    still_present_count: issue.confirmedStillPresentCount,
  };
}

// -----------------------------------------------------------------------------
// 4. SMART CIVIC ISSUE CONSOLIDATION
// -----------------------------------------------------------------------------
export async function fetchCivicIssues(): Promise<CivicIssue[]> {
  if (isLiveSupabaseConfigured()) {
    try {
      const accessToken = await getValidAccessToken();
      const headers = accessToken ? authHeaders(accessToken) : publicHeaders();
      const response = await fetch(`${SUPABASE_URL}/rest/v1/civic_issues?select=*&order=created_at.desc`, { headers });
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const issues = rows.map(mapSupabaseRowToCivicIssue);
          PersistentStore.set(STORAGE_KEYS.ISSUES, issues);
          return issues;
        }
      }
    } catch (e) {
      console.warn('Supabase fetchCivicIssues fallback:', e);
    }
  }

  const reports = await fetchAllReports();
  if (reports.length > 0) {
    const generated = consolidateInitialIssuesFromReports(reports);
    PersistentStore.set(STORAGE_KEYS.ISSUES, generated);
    return generated;
  }

  return PersistentStore.get<CivicIssue[]>(STORAGE_KEYS.ISSUES, []);
}

function consolidateInitialIssuesFromReports(reports: CivicReport[]): CivicIssue[] {
  const issueMap = new Map<string, CivicIssue>();

  reports.forEach((r) => {
    const key = `${r.category}_${r.ward}`;
    if (!issueMap.has(key)) {
      const issueId = `ISS-2026-${Math.floor(10000 + Math.random() * 89999)}`;
      r.issueId = issueId;

      const priorityAssessment = calculateExplainablePriority({
        severity: r.priority,
        category: r.category,
        reportsCount: 1,
        verificationsCount: 1,
        createdAt: r.createdAt || new Date().toISOString(),
        location: r.location,
      });

      const severityAssessment = calculateExplainableSeverity({
        category: r.category,
        confidence: r.confidenceScore,
        detectedIssueTitle: r.title,
        relatedReportsCount: 1,
        locationText: r.location,
      });

      issueMap.set(key, {
        id: issueId,
        title: r.title,
        category: r.category,
        subcategory: r.subcategory,
        department: r.department,
        location: r.location,
        ward: r.ward,
        latitude: r.latitude ?? 21.1458,
        longitude: r.longitude ?? 79.0882,
        coordinates: r.coordinates,
        status: r.status,
        severity: r.priority,
        priority: priorityAssessment.priority,
        priorityScore: priorityAssessment.score,
        priorityReasons: priorityAssessment.reasons,
        severityReasons: severityAssessment.reasons,
        reportsCount: 1,
        linkedReportIds: [r.id],
        primaryImageUrl: r.imageUrl,
        assignedCrew: r.assignedCrew,
        verificationsCount: 1,
        confirmedStillPresentCount: 0,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const existing = issueMap.get(key)!;
      existing.reportsCount += 1;
      existing.linkedReportIds.push(r.id);
      r.issueId = existing.id;

      // Recalculate priority
      const updatedPrio = calculateExplainablePriority({
        severity: existing.severity,
        category: existing.category,
        reportsCount: existing.reportsCount,
        verificationsCount: existing.verificationsCount,
        createdAt: existing.createdAt,
        location: existing.location,
      });
      existing.priority = updatedPrio.priority;
      existing.priorityScore = updatedPrio.score;
      existing.priorityReasons = updatedPrio.reasons;
    }
  });

  return Array.from(issueMap.values());
}

export async function consolidateReportIntoCivicIssue(
  report: CivicReport,
  topDuplicateMatch?: DuplicateMatch
): Promise<CivicIssue> {
  const issues = PersistentStore.get<CivicIssue[]>(STORAGE_KEYS.ISSUES, []);

  // If a high-confidence match exists, attach to existing CivicIssue
  if (topDuplicateMatch && topDuplicateMatch.similarityScore >= 75) {
    const existingIndex = issues.findIndex((i) => i.id === topDuplicateMatch.targetIssueId);
    if (existingIndex !== -1) {
      const existing = issues[existingIndex];
      existing.reportsCount += 1;
      if (!existing.linkedReportIds.includes(report.id)) {
        existing.linkedReportIds.push(report.id);
      }
      report.issueId = existing.id;

      // Recalculate priority
      const updatedPrio = calculateExplainablePriority({
        severity: existing.severity,
        category: existing.category,
        reportsCount: existing.reportsCount,
        verificationsCount: existing.verificationsCount,
        createdAt: existing.createdAt,
        location: existing.location,
      });
      existing.priority = updatedPrio.priority;
      existing.priorityScore = updatedPrio.score;
      existing.priorityReasons = updatedPrio.reasons;
      existing.updatedAt = new Date().toISOString();

      issues[existingIndex] = existing;
      PersistentStore.set(STORAGE_KEYS.ISSUES, issues);
      updateLocalReport(report);

      if (isLiveSupabaseConfigured()) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/civic_issues?issue_id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            headers: publicHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(serializeCivicIssue(existing)),
          });
        } catch {}
      }
      return existing;
    }
  }

  // Otherwise create a new CivicIssue
  const newIssueId = `ISS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
  report.issueId = newIssueId;

  const prio = calculateExplainablePriority({
    severity: report.priority,
    category: report.category,
    reportsCount: 1,
    verificationsCount: 0,
    createdAt: report.createdAt || new Date().toISOString(),
    location: report.location,
  });

  const sev = calculateExplainableSeverity({
    category: report.category,
    confidence: report.confidenceScore,
    detectedIssueTitle: report.title,
    relatedReportsCount: 1,
    locationText: report.location,
  });

  const newIssue: CivicIssue = {
    id: newIssueId,
    title: report.title,
    category: report.category,
    subcategory: report.subcategory,
    department: report.department,
    location: report.location,
    ward: report.ward,
    latitude: report.latitude ?? 21.1458,
    longitude: report.longitude ?? 79.0882,
    coordinates: report.coordinates,
    status: report.status,
    severity: report.priority,
    priority: prio.priority,
    priorityScore: prio.score,
    priorityReasons: prio.reasons,
    severityReasons: sev.reasons,
    reportsCount: 1,
    linkedReportIds: [report.id],
    primaryImageUrl: report.imageUrl,
    assignedCrew: report.assignedCrew,
    verificationsCount: 0,
    confirmedStillPresentCount: 0,
    createdAt: report.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  issues.unshift(newIssue);
  PersistentStore.set(STORAGE_KEYS.ISSUES, issues);
  updateLocalReport(report);

  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/civic_issues`, {
        method: 'POST',
        headers: publicHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(serializeCivicIssue(newIssue)),
      });
    } catch {}
  }

  return newIssue;
}

export async function syncCivicIssueStatus(issueId: string, status: IncidentStatus): Promise<void> {
  const issues = PersistentStore.get<CivicIssue[]>(STORAGE_KEYS.ISSUES, []);
  const index = issues.findIndex((i) => i.id === issueId);
  if (index !== -1) {
    issues[index].status = status;
    issues[index].updatedAt = new Date().toISOString();
    if (status === 'RESOLVED') {
      issues[index].resolvedAt = new Date().toISOString();
    }
    PersistentStore.set(STORAGE_KEYS.ISSUES, issues);

    if (isLiveSupabaseConfigured()) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/civic_issues?issue_id=eq.${encodeURIComponent(issueId)}`, {
          method: 'PATCH',
          headers: publicHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            status,
            updated_at: new Date().toISOString(),
            resolved_at: status === 'RESOLVED' ? new Date().toISOString() : null,
          }),
        });
      } catch {}
    }
  }
}

// -----------------------------------------------------------------------------
// 3. DUPLICATE MATCHES STORAGE & REVIEW
// -----------------------------------------------------------------------------
export async function fetchDuplicateMatches(): Promise<DuplicateMatch[]> {
  if (isLiveSupabaseConfigured()) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/duplicate_matches?select=*&order=matched_at.desc`, {
        headers: publicHeaders(),
      });
      if (response.ok) {
        const rows = await response.json();
        return rows.map((r: any) => ({
          id: r.id,
          sourceReportId: r.source_report_id,
          targetIssueId: r.target_issue_id,
          targetReportId: r.target_report_id,
          similarityScore: r.similarity_score,
          signals: {
            geoDistanceMeters: Number(r.geo_distance_meters || 0),
            visualSimilarity: Number(r.visual_similarity || 0),
            textSimilarity: Number(r.text_similarity || 0),
            categoryMatch: Boolean(r.category_match),
            temporalHours: Number(r.temporal_hours || 0),
            ...(r.signals || {}),
          },
          status: r.status,
          matchedAt: r.matched_at,
        }));
      }
    } catch {}
  }
  return PersistentStore.get<DuplicateMatch[]>(STORAGE_KEYS.DUPLICATES, []);
}

export async function saveDuplicateMatch(match: DuplicateMatch): Promise<void> {
  const matches = PersistentStore.get<DuplicateMatch[]>(STORAGE_KEYS.DUPLICATES, []);
  const exists = matches.some((m) => m.sourceReportId === match.sourceReportId && m.targetIssueId === match.targetIssueId);
  if (!exists) {
    matches.unshift(match);
    PersistentStore.set(STORAGE_KEYS.DUPLICATES, matches);
  }

  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/duplicate_matches`, {
        method: 'POST',
        headers: publicHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          source_report_id: match.sourceReportId,
          target_issue_id: match.targetIssueId,
          target_report_id: match.targetReportId || null,
          similarity_score: match.similarityScore,
          geo_distance_meters: match.signals?.geoDistanceMeters || null,
          visual_similarity: match.signals?.visualSimilarity || null,
          text_similarity: match.signals?.textSimilarity || null,
          category_match: match.signals?.categoryMatch ?? true,
          signals: match.signals || {},
          status: match.status || 'possible_duplicate',
        }),
      });
    } catch {}
  }
}

export async function resolveDuplicateMatchAction(
  matchId: string,
  action: 'linked_to_issue' | 'confirmed_distinct'
): Promise<void> {
  const matches = PersistentStore.get<DuplicateMatch[]>(STORAGE_KEYS.DUPLICATES, []);
  const matchIndex = matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return;

  const match = matches[matchIndex];
  match.status = action;
  matches[matchIndex] = match;
  PersistentStore.set(STORAGE_KEYS.DUPLICATES, matches);

  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/duplicate_matches?id=eq.${encodeURIComponent(matchId)}`, {
        method: 'PATCH',
        headers: publicHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: action }),
      });
    } catch {}
  }

  if (action === 'linked_to_issue') {
    // Merge source report into target issue
    const issues = PersistentStore.get<CivicIssue[]>(STORAGE_KEYS.ISSUES, []);
    const targetIssue = issues.find((i) => i.id === match.targetIssueId);
    if (targetIssue) {
      if (!targetIssue.linkedReportIds.includes(match.sourceReportId)) {
        targetIssue.linkedReportIds.push(match.sourceReportId);
        targetIssue.reportsCount += 1;
        PersistentStore.set(STORAGE_KEYS.ISSUES, issues);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 11. COMMUNITY VERIFICATION
// -----------------------------------------------------------------------------
export async function addCommunityVerification(
  issueId: string,
  type: 'confirm' | 'still_present' | 'resolved_for_me',
  userName = 'Verified Citizen',
  reportId?: string
): Promise<void> {
  const verifications = PersistentStore.get<CommunityVerification[]>(STORAGE_KEYS.VERIFICATIONS, []);
  const newVerif: CommunityVerification = {
    id: `verif_${Date.now()}`,
    issueId,
    reportId,
    userName,
    type,
    timestamp: new Date().toISOString(),
  };
  verifications.unshift(newVerif);
  PersistentStore.set(STORAGE_KEYS.VERIFICATIONS, verifications);

  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/community_verifications`, {
        method: 'POST',
        headers: publicHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          issue_id: issueId,
          report_id: reportId || null,
          user_name: userName,
          verification_type: type,
        }),
      });
    } catch {}
  }

  // Increment counter on CivicIssue
  const issues = PersistentStore.get<CivicIssue[]>(STORAGE_KEYS.ISSUES, []);
  const issueIndex = issues.findIndex((i) => i.id === issueId);
  if (issueIndex !== -1) {
    if (type === 'confirm') issues[issueIndex].verificationsCount += 1;
    if (type === 'still_present') issues[issueIndex].confirmedStillPresentCount += 1;
    issues[issueIndex].updatedAt = new Date().toISOString();
    PersistentStore.set(STORAGE_KEYS.ISSUES, issues);
  }
}

// -----------------------------------------------------------------------------
// 16. RESOLUTION EVIDENCE (Before vs After)
// -----------------------------------------------------------------------------
export async function submitResolutionEvidence(evidence: {
  reportId?: string;
  issueId?: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  resolvedBy: string;
  resolutionNotes: string;
}): Promise<ResolutionEvidence> {
  const evidenceStore = PersistentStore.get<ResolutionEvidence[]>(STORAGE_KEYS.RESOLUTION_EVIDENCE, []);
  const newEvidence: ResolutionEvidence = {
    id: `ev_${Date.now()}`,
    ...evidence,
    resolvedAt: new Date().toISOString(),
  };

  evidenceStore.unshift(newEvidence);
  PersistentStore.set(STORAGE_KEYS.RESOLUTION_EVIDENCE, evidenceStore);

  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/resolution_evidence`, {
        method: 'POST',
        headers: publicHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          report_id: evidence.reportId || null,
          issue_id: evidence.issueId || null,
          before_image_url: evidence.beforeImageUrl,
          after_image_url: evidence.afterImageUrl,
          resolved_by: evidence.resolvedBy,
          resolution_notes: evidence.resolutionNotes,
        }),
      });
    } catch {}
  }

  // Attach evidence to report and issue
  if (evidence.reportId) {
    await updateReportStatus(evidence.reportId, 'RESOLVED', evidence.resolvedBy, `Resolved: ${evidence.resolutionNotes}`);
  }

  return newEvidence;
}

export async function confirmResolutionByCitizen(
  evidenceId: string,
  feedback: 'resolved' | 'still_present' | 'unsatisfied',
  note?: string
): Promise<void> {
  const evidenceStore = PersistentStore.get<ResolutionEvidence[]>(STORAGE_KEYS.RESOLUTION_EVIDENCE, []);
  const index = evidenceStore.findIndex((e) => e.id === evidenceId);
  if (index !== -1) {
    evidenceStore[index].citizenConfirmed = feedback === 'resolved';
    evidenceStore[index].citizenFeedback = feedback;
    evidenceStore[index].citizenFeedbackNote = note;
    PersistentStore.set(STORAGE_KEYS.RESOLUTION_EVIDENCE, evidenceStore);
  }
}

// -----------------------------------------------------------------------------
// 10. REPORT INTEGRITY ENGINE STORAGE
// -----------------------------------------------------------------------------
export async function fetchReportIntegrityList(): Promise<ReportIntegrityRecord[]> {
  if (isLiveSupabaseConfigured()) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/report_integrity?select=*&order=analyzed_at.desc`, {
        headers: publicHeaders(),
      });
      if (response.ok) {
        const rows = await response.json();
        return rows.map((r: any) => ({
          reportId: r.report_id,
          status: r.status,
          flags: r.flags || [],
          confidenceScore: Number(r.confidence_score || 95),
          submissionVelocity: Number(r.submission_velocity || 1),
          imageDuplicateRisk: Number(r.image_duplicate_risk || 0),
          geoRadiusDensity: Number(r.geo_radius_density || 1),
          adminReviewed: Boolean(r.admin_reviewed),
          adminActionNote: r.admin_action_note || undefined,
          analyzedAt: r.analyzed_at || new Date().toISOString(),
        }));
      }
    } catch {}
  }
  return PersistentStore.get<ReportIntegrityRecord[]>(STORAGE_KEYS.INTEGRITY, []);
}

export async function saveReportIntegrityRecord(record: ReportIntegrityRecord): Promise<void> {
  const list = PersistentStore.get<ReportIntegrityRecord[]>(STORAGE_KEYS.INTEGRITY, []);
  const idx = list.findIndex((i) => i.reportId === record.reportId);
  if (idx === -1) list.unshift(record);
  else list[idx] = record;
  PersistentStore.set(STORAGE_KEYS.INTEGRITY, list);

  if (isLiveSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/report_integrity`, {
        method: 'POST',
        headers: publicHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          report_id: record.reportId,
          status: record.status,
          flags: record.flags || [],
          confidence_score: record.confidenceScore,
          submission_velocity: record.submissionVelocity || 1,
          image_duplicate_risk: record.imageDuplicateRisk || 0,
          geo_radius_density: record.geoRadiusDensity || 1,
          admin_reviewed: record.adminReviewed || false,
          admin_action_note: record.adminActionNote || null,
        }),
      });
    } catch {}
  }
}

// -----------------------------------------------------------------------------
// 7. CIVIC HOTSPOTS CALCULATION
// -----------------------------------------------------------------------------
export function calculateCivicHotspots(reports: CivicReport[]): CivicHotspot[] {
  const wardMap = new Map<
    string,
    {
      total: number;
      unresolved: number;
      latSum: number;
      lngSum: number;
      catCounts: Record<string, number>;
      recent: number;
    }
  >();

  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;

  reports.forEach((r) => {
    const ward = r.ward || 'Central Municipal Zone';
    if (!wardMap.has(ward)) {
      wardMap.set(ward, {
        total: 0,
        unresolved: 0,
        latSum: 0,
        lngSum: 0,
        catCounts: {},
        recent: 0,
      });
    }

    const item = wardMap.get(ward)!;
    item.total++;
    if (r.status !== 'RESOLVED' && r.status !== 'REJECTED') item.unresolved++;

    item.latSum += r.latitude ?? 21.1458;
    item.lngSum += r.longitude ?? 79.0882;

    item.catCounts[r.category] = (item.catCounts[r.category] || 0) + 1;

    if (r.createdAt && new Date(r.createdAt).getTime() > sevenDaysAgo) {
      item.recent++;
    }
  });

  const hotspots: CivicHotspot[] = [];

  wardMap.forEach((data, wardName) => {
    let topCategory: IncidentCategory = 'Other Civic Issues';
    let maxCount = 0;
    Object.entries(data.catCounts).forEach(([cat, c]) => {
      if (c > maxCount) {
        maxCount = c;
        topCategory = cat as IncidentCategory;
      }
    });

    const avgLat = data.total > 0 ? data.latSum / data.total : 21.1458;
    const avgLng = data.total > 0 ? data.lngSum / data.total : 79.0882;

    hotspots.push({
      area: wardName,
      ward: wardName,
      coordinates: [avgLat, avgLng],
      totalIssues: data.total,
      unresolvedCount: data.unresolved,
      topCategory,
      categoryBreakdown: data.catCounts,
      trend: data.recent > data.total * 0.4 ? 'increasing' : data.unresolved === 0 ? 'decreasing' : 'stable',
      recentComplaintsCount: data.recent,
    });
  });

  return hotspots.sort((a, b) => b.totalIssues - a.totalIssues);
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------
export async function fetchNotifications(): Promise<NotificationItem[]> {
  return PersistentStore.get<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, [
    {
      id: 'notif_welcome',
      title: 'Welcome to CivicAI Platform',
      message: 'Report any municipal defect in seconds with AI assistance.',
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

// -----------------------------------------------------------------------------
// Analytics
// -----------------------------------------------------------------------------
export function formatHoursToReadable(hours: number): string {
  if (hours <= 0 || isNaN(hours)) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)} mins`;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

function getSlaHours(priority: IncidentSeverity): number {
  switch (priority) {
    case 'CRITICAL':
      return 24;
    case 'HIGH':
      return 48;
    case 'MEDIUM':
      return 72;
    case 'LOW':
    default:
      return 96;
  }
}

export function isReportOverdue(report: CivicReport): boolean {
  if (!report.createdAt) return false;
  const createdMs = new Date(report.createdAt).getTime();
  if (isNaN(createdMs)) return false;

  const slaMs = getSlaHours(report.priority) * 3600 * 1000;

  if (report.status === 'RESOLVED') {
    if (!report.resolvedAt) return false;
    const resolvedMs = new Date(report.resolvedAt).getTime();
    if (isNaN(resolvedMs)) return false;
    return resolvedMs - createdMs > slaMs;
  }

  return Date.now() - createdMs > slaMs;
}

export function calculateDepartmentAnalytics(reports: CivicReport[]): DepartmentStats[] {
  const departmentMap = new Map<string, CivicReport[]>();

  reports.forEach((r) => {
    const dept = (r.department || 'Municipal Grievance Command').trim();
    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, []);
    }
    departmentMap.get(dept)!.push(r);
  });

  const stats: DepartmentStats[] = [];

  departmentMap.forEach((deptReports, deptName) => {
    const total = deptReports.length;
    const open = deptReports.filter((r) => r.status === 'REPORTED' || r.status === 'UNDER REVIEW').length;
    const inProgress = deptReports.filter((r) => r.status === 'ASSIGNED' || r.status === 'IN PROGRESS').length;
    const resolvedReports = deptReports.filter((r) => r.status === 'RESOLVED');
    const resolved = resolvedReports.length;
    const critical = deptReports.filter((r) => r.priority === 'CRITICAL').length;
    const highPriority = deptReports.filter((r) => r.priority === 'HIGH').length;
    const overdue = deptReports.filter(isReportOverdue).length;

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    let totalResolvedHours = 0;
    let validResolvedCount = 0;

    resolvedReports.forEach((r) => {
      if (r.createdAt && r.resolvedAt) {
        const start = new Date(r.createdAt).getTime();
        const end = new Date(r.resolvedAt).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          totalResolvedHours += (end - start) / (1000 * 3600);
          validResolvedCount++;
        }
      }
    });

    const avgResolutionHours = validResolvedCount > 0 ? totalResolvedHours / validResolvedCount : 0;

    stats.push({
      department: deptName,
      totalComplaints: total,
      open,
      inProgress,
      resolved,
      critical,
      highPriority,
      resolutionRate,
      avgResolutionTimeHours: Math.round(avgResolutionHours * 10) / 10,
      avgResolutionTimeFormatted: formatHoursToReadable(avgResolutionHours),
      overdueComplaints: overdue,
    });
  });

  return stats.sort((a, b) => b.totalComplaints - a.totalComplaints);
}

export function calculateOverallKPIs(reports: CivicReport[], selectedDepartment?: string): DepartmentKPIs {
  const filtered =
    selectedDepartment && selectedDepartment !== 'all'
      ? reports.filter((r) => r.department === selectedDepartment)
      : reports;

  const total = filtered.length;
  const open = filtered.filter((r) => r.status === 'REPORTED' || r.status === 'UNDER REVIEW').length;
  const inProgress = filtered.filter((r) => r.status === 'ASSIGNED' || r.status === 'IN PROGRESS').length;
  const resolvedList = filtered.filter((r) => r.status === 'RESOLVED');
  const resolved = resolvedList.length;
  const critical = filtered.filter((r) => r.priority === 'CRITICAL').length;
  const high = filtered.filter((r) => r.priority === 'HIGH').length;
  const overdue = filtered.filter(isReportOverdue).length;

  let totalResolvedHours = 0;
  let validResolvedCount = 0;

  resolvedList.forEach((r) => {
    if (r.createdAt && r.resolvedAt) {
      const start = new Date(r.createdAt).getTime();
      const end = new Date(r.resolvedAt).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        totalResolvedHours += (end - start) / (1000 * 3600);
        validResolvedCount++;
      }
    }
  });

  const avgHours = validResolvedCount > 0 ? totalResolvedHours / validResolvedCount : 0;

  return {
    totalComplaints: total,
    openComplaints: open,
    inProgressComplaints: inProgress,
    resolvedComplaints: resolved,
    criticalComplaints: critical,
    highPriorityComplaints: high,
    overallResolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    avgResolutionHours: Math.round(avgHours * 10) / 10,
    avgResolutionFormatted: formatHoursToReadable(avgHours),
    overdueComplaints: overdue,
  };
}
