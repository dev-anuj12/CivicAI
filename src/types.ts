export type TabType = 'citizen-portal' | 'report-issue-flow' | 'my-reports-tracking' | 'admin-command-center';
export type UserRole = 'citizen' | 'admin' | 'superadmin';

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
  // Legacy aliases for backward compatibility
  | 'Road Defect'
  | 'Garbage Pile'
  | 'Streetlight Fault'
  | 'Water Leakage'
  | 'Open Manhole';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'REPORTED' | 'UNDER REVIEW' | 'ASSIGNED' | 'IN PROGRESS' | 'RESOLVED' | 'REJECTED';

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
}

export interface NotificationItem {
  id: string;
  reportId?: string;
  title: string;
  message: string;
  type: 'dispatch' | 'status' | 'sla' | 'system';
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
