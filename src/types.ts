export type TabType = 'citizen-portal' | 'report-issue-flow' | 'my-reports-tracking' | 'admin-command-center';
export type UserRole = 'citizen' | 'admin' | 'superadmin';
export type Language = 'en' | 'hi' | 'mr';

export type IncidentCategory =
  | 'Roads & Transportation'
  | 'Water & Drainage'
  | 'Electricity & Lighting'
  | 'Sanitation & Waste'
  | 'Public Infrastructure'
  | 'Construction'
  | 'Traffic & Signage'
  | 'Environment'
  | 'Other Civic Issues'
  // Target Hackathon Specific Mappings / Aliases
  | 'Garbage/Waste'
  | 'Pothole/Road Damage'
  | 'Broken/Damaged Streetlight'
  | 'Water Leakage'
  | 'Fallen Tree'
  | 'Construction Debris'
  | 'Damaged Public Infrastructure'
  | 'Traffic & Signage Hazard'
  | 'Other'
  // Legacy aliases
  | 'Road Defect'
  | 'Garbage Pile'
  | 'Streetlight Fault'
  | 'Open Manhole';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type IncidentStatus = 'REPORTED' | 'UNDER REVIEW' | 'ASSIGNED' | 'IN PROGRESS' | 'RESOLVED' | 'REJECTED';
export type IntegrityStatus = 'NORMAL' | 'REVIEW' | 'FLAGGED';

export interface AuditStep {
  id: string;
  stage: string;
  timestamp: string;
  description: string;
  isComplete: boolean;
  isCurrent?: boolean;
}

export interface CitizenComment {
  id: string;
  author: string;
  initials: string;
  roleTag: string;
  timestamp: string;
  text: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  ward?: string;
  role: UserRole;
  department?: string;
  isVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
  status?: 'active' | 'suspended';
  isSuperAdmin?: boolean;
}

export interface CivicReport {
  id: string;
  userId?: string;
  reporterName?: string;
  title: string;
  category: IncidentCategory;
  subcategory?: string;
  categoryIcon: string;
  department: string;
  location: string;
  landmark?: string;
  ward: string;
  coordinates: string;
  latitude?: number;
  longitude?: number;
  imageUrl: string;
  imageAlt: string;
  timestamp: string;
  status: IncidentStatus;
  priority: IncidentSeverity;
  upvotes: number;
  hasUpvoted?: boolean;
  assignedCrew?: string;
  slaRemaining: string;
  slaStatusText?: string;
  volumeOrSpec?: string;
  confidenceScore: number;
  description: string;
  hazardAssessment: string;
  recommendedDispatch: string;
  isPrivate: boolean;
  categoryMetadata?: Record<string, any>;
  aiExplanation?: string;
  auditTrail: AuditStep[];
  comments: CitizenComment[];
  createdAt?: string;
  resolvedAt?: string;

  // New Civic Intelligence platform links
  issueId?: string; // Linked consolidated CivicIssue ID
  isDuplicate?: boolean;
  duplicateOfId?: string;
  duplicateSimilarity?: number;
  integrityStatus?: IntegrityStatus;
  integrityFlags?: string[];
  verificationsCount?: number;
  resolutionEvidence?: ResolutionEvidence;
}

// -----------------------------------------------------------------------------
// 4. SMART CIVIC ISSUE CONSOLIDATION
// -----------------------------------------------------------------------------
export interface CivicIssue {
  id: string; // e.g. ISS-2026-48291
  title: string;
  category: IncidentCategory;
  subcategory?: string;
  department: string;
  location: string;
  ward: string;
  latitude: number;
  longitude: number;
  coordinates: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  priority: PriorityLevel;
  priorityScore: number;
  priorityReasons: string[];
  severityReasons: string[];
  reportsCount: number;
  linkedReportIds: string[];
  primaryImageUrl: string;
  assignedCrew?: string;
  verificationsCount: number;
  confirmedStillPresentCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionEvidence?: ResolutionEvidence;
}

// -----------------------------------------------------------------------------
// 3. DUPLICATE COMPLAINT DETECTION
// -----------------------------------------------------------------------------
export interface DuplicateSignals {
  geoDistanceMeters: number; // e.g. 42m
  visualSimilarity: number; // 0-100%
  textSimilarity: number; // 0-100%
  categoryMatch: boolean;
  temporalHours: number; // hours difference
}

export interface DuplicateMatch {
  id: string;
  sourceReportId: string;
  targetIssueId: string;
  targetReportId?: string;
  similarityScore: number; // 0-100%
  signals: DuplicateSignals;
  status: 'possible_duplicate' | 'linked_to_issue' | 'confirmed_distinct';
  matchedAt: string;
  sourceReportTitle?: string;
  targetIssueTitle?: string;
  sourceReportImage?: string;
  targetIssueImage?: string;
}

// -----------------------------------------------------------------------------
// 2. AI-ASSISTED SEVERITY
// -----------------------------------------------------------------------------
export interface SeverityAssessment {
  aiSeverity: IncidentSeverity;
  finalSeverity: IncidentSeverity;
  reasons: string[];
  overrideReason?: string;
  adminOverriddenBy?: string;
  timestamp: string;
}

// -----------------------------------------------------------------------------
// 5. AI PRIORITY ENGINE
// -----------------------------------------------------------------------------
export interface PriorityAssessment {
  priority: PriorityLevel;
  score: number; // 0-100
  reasons: string[];
  calculatedAt: string;
  adminOverridePriority?: PriorityLevel;
  adminOverrideReason?: string;
}

// -----------------------------------------------------------------------------
// 10. REPORT INTEGRITY ENGINE
// -----------------------------------------------------------------------------
export interface ReportIntegrityRecord {
  reportId: string;
  status: IntegrityStatus;
  flags: string[];
  confidenceScore: number;
  submissionVelocity: number; // reports within 1 hour from same user/device
  imageDuplicateRisk: number; // % match with previous submissions
  geoRadiusDensity: number; // complaints in 50m radius by same user
  analyzedAt: string;
  adminReviewed: boolean;
  adminActionNote?: string;
}

// -----------------------------------------------------------------------------
// 11. COMMUNITY VERIFICATION
// -----------------------------------------------------------------------------
export interface CommunityVerification {
  id: string;
  issueId: string;
  reportId?: string;
  userId?: string;
  userName: string;
  type: 'confirm' | 'still_present' | 'resolved_for_me';
  timestamp: string;
}

// -----------------------------------------------------------------------------
// 16. RESOLUTION EVIDENCE
// -----------------------------------------------------------------------------
export interface ResolutionEvidence {
  id: string;
  reportId?: string;
  issueId?: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  resolvedBy: string;
  resolutionNotes: string;
  resolvedAt: string;
  citizenConfirmed?: boolean;
  citizenFeedback?: 'resolved' | 'still_present' | 'unsatisfied';
  citizenFeedbackNote?: string;
}

// -----------------------------------------------------------------------------
// 9. AI ADMIN COPILOT
// -----------------------------------------------------------------------------
export interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  queryIntent?: 'filter_issues' | 'hotspots' | 'duplicates' | 'sla_overdue' | 'category_stats' | 'general';
  suggestedPrompts?: string[];
  actionRequired?: boolean;
  actionDetails?: {
    type: 'ASSIGN' | 'RESOLVE' | 'MERGE_DUPLICATE' | 'PRIORITIZE';
    targetId: string;
    description: string;
  };
  metricsHighlight?: {
    label: string;
    value: string | number;
    sublabel?: string;
  }[];
  matchedReports?: CivicReport[];
  matchedIssues?: CivicIssue[];
}

// -----------------------------------------------------------------------------
// 7. CIVIC HOTSPOTS
// -----------------------------------------------------------------------------
export interface CivicHotspot {
  area: string;
  ward: string;
  coordinates: [number, number];
  totalIssues: number;
  unresolvedCount: number;
  topCategory: IncidentCategory;
  categoryBreakdown: Record<string, number>;
  trend: 'increasing' | 'stable' | 'decreasing';
  recentComplaintsCount: number;
}

export interface DepartmentStats {
  department: string;
  totalComplaints: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  highPriority: number;
  resolutionRate: number; // percentage 0-100
  avgResolutionTimeHours: number; // in hours
  avgResolutionTimeFormatted: string;
  overdueComplaints: number;
}

export interface DepartmentKPIs {
  totalComplaints: number;
  openComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  criticalComplaints: number;
  highPriorityComplaints: number;
  overallResolutionRate: number;
  avgResolutionHours: number;
  avgResolutionFormatted: string;
  overdueComplaints: number;
}

export interface NotificationItem {
  id: string;
  reportId?: string;
  title: string;
  message: string;
  type: 'dispatch' | 'status' | 'sla' | 'system' | 'duplicate' | 'integrity' | 'verification';
  timestamp: string;
  isRead: boolean;
}

export interface CivicLocation {
  road: string;
  area: string;
  coords: string;
  ward: string;
  city?: string;
}

export type NagpurLocation = CivicLocation;

export interface CategoryFieldConfig {
  name: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'boolean';
  options?: string[];
  placeholder?: string;
}

export interface CivicCategoryMeta {
  id: IncidentCategory;
  name: string;
  icon: string;
  department: string;
  description: string;
  sampleSubcategories: string[];
  fields: CategoryFieldConfig[];
}
