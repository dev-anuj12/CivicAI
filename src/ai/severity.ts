import { IncidentCategory, IncidentSeverity, SeverityAssessment } from '../types';

export interface SeverityContextInput {
  category: IncidentCategory;
  confidence: number;
  detectedIssueTitle: string;
  relatedReportsCount?: number;
  locationText?: string;
  complaintAgeHours?: number;
  isHazardousRoad?: boolean;
}

/**
 * 2. AI-ASSISTED SEVERITY MODULE
 * Transparently computes explainable severity with verifiable reasons.
 */
export function calculateExplainableSeverity(context: SeverityContextInput): SeverityAssessment {
  const reasons: string[] = [];
  let score = 50; // Base baseline (MEDIUM)

  // 1. Category-specific baseline danger
  const cat = context.category;
  if (cat === 'Roads & Transportation' || cat === 'Pothole/Road Damage' || cat === 'Road Defect') {
    score += 15;
    reasons.push('Road surface fractures pose immediate skidding risk for two-wheelers and motorists');
  } else if (cat === 'Electricity & Lighting' || cat === 'Broken/Damaged Streetlight' || cat === 'Streetlight Fault') {
    score += 10;
    reasons.push('Electrical fault or unlit public corridor creates nocturnal transit vulnerability');
  } else if (cat === 'Water & Drainage' || cat === 'Water Leakage' || cat === 'Open Manhole') {
    score += 20;
    reasons.push('Active fluid leakage threatens structural sub-base erosion and public sanitation');
  } else if (cat === 'Environment' || cat === 'Fallen Tree') {
    score += 15;
    reasons.push('Fallen biological mass blocks transit easement and may disrupt overhead power lines');
  } else if (cat === 'Construction' || cat === 'Construction Debris') {
    score += 10;
    reasons.push('Unbarricaded construction aggregates obstruct pedestrian and vehicular clearance');
  } else if (cat === 'Sanitation & Waste' || cat === 'Garbage/Waste' || cat === 'Garbage Pile') {
    score += 5;
    reasons.push('Solid waste accumulation poses public health hygiene risks');
  }

  // 2. High confidence boost
  if (context.confidence >= 90) {
    score += 10;
    reasons.push(`High AI visual confidence (${context.confidence}%) confirms clear structural hazard`);
  }

  // 3. Consolidated reports boost
  const relatedCount = context.relatedReportsCount || 1;
  if (relatedCount >= 5) {
    score += 20;
    reasons.push(`High community impact: ${relatedCount} independent citizen reports filed`);
  } else if (relatedCount >= 2) {
    score += 10;
    reasons.push(`Multiple citizen reports (${relatedCount}) corroborate ongoing defect`);
  }

  // 4. Critical location boost
  const loc = (context.locationText || '').toLowerCase();
  if (
    loc.includes('hospital') ||
    loc.includes('school') ||
    loc.includes('highway') ||
    loc.includes('junction') ||
    loc.includes('metro') ||
    loc.includes('ring road') ||
    loc.includes('main road')
  ) {
    score += 15;
    reasons.push('Located within a high-density transit artery / essential emergency zone');
  }

  // 5. Age boost
  const age = context.complaintAgeHours || 0;
  if (age >= 72) {
    score += 15;
    reasons.push(`Unresolved for over ${Math.floor(age / 24)} days, escalating safety urgency`);
  } else if (age >= 24) {
    score += 5;
    reasons.push('Pending action for over 24 hours');
  }

  // Determine severity tier
  let severity: IncidentSeverity = 'MEDIUM';
  if (score >= 80) {
    severity = 'CRITICAL';
  } else if (score >= 65) {
    severity = 'HIGH';
  } else if (score < 40) {
    severity = 'LOW';
  }

  return {
    aiSeverity: severity,
    finalSeverity: severity,
    reasons,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Allows authorized administrators to override AI severity with an explicit rationale
 */
export function overrideSeverityByAdmin(
  currentAssessment: SeverityAssessment,
  newSeverity: IncidentSeverity,
  adminName: string,
  overrideReason: string
): SeverityAssessment {
  return {
    ...currentAssessment,
    finalSeverity: newSeverity,
    overrideReason: overrideReason.trim() || 'Manual administrative review override',
    adminOverriddenBy: adminName,
    timestamp: new Date().toISOString(),
  };
}
