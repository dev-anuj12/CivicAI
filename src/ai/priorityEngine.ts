import { IncidentCategory, IncidentSeverity, PriorityAssessment, PriorityLevel } from '../types';

export interface PriorityContextInput {
  severity: IncidentSeverity;
  category: IncidentCategory;
  reportsCount: number;
  verificationsCount: number;
  createdAt: string;
  location?: string;
  isOverdue?: boolean;
}

/**
 * 5. AI PRIORITY ENGINE
 * Dynamically computes explainable priority (LOW, MEDIUM, HIGH, URGENT) from verified multi-factor signals.
 */
export function calculateExplainablePriority(input: PriorityContextInput): PriorityAssessment {
  const reasons: string[] = [];
  let score = 30; // Base score

  // 1. Severity Factor (Weight: 35%)
  if (input.severity === 'CRITICAL') {
    score += 35;
    reasons.push('CRITICAL visual severity rated by AI vision diagnostics');
  } else if (input.severity === 'HIGH') {
    score += 25;
    reasons.push('HIGH severity structural or public hazard defect');
  } else if (input.severity === 'MEDIUM') {
    score += 15;
    reasons.push('MEDIUM severity transit / infrastructure inconvenience');
  } else {
    score += 5;
    reasons.push('LOW severity non-urgent municipal upkeep');
  }

  // 2. Citizen Reports Count Factor (Weight: 25%)
  const count = input.reportsCount || 1;
  if (count >= 10) {
    score += 25;
    reasons.push(`Widespread public impact: ${count} independent citizen complaints consolidated`);
  } else if (count >= 5) {
    score += 20;
    reasons.push(`High resident distress: ${count} verified citizen complaints`);
  } else if (count >= 2) {
    score += 10;
    reasons.push(`Repeated complaint: ${count} citizen reports submitted for this location`);
  } else {
    reasons.push('Initial single-citizen complaint registered');
  }

  // 3. Community Verification Factor (Weight: 15%)
  const verifs = input.verificationsCount || 0;
  if (verifs >= 5) {
    score += 15;
    reasons.push(`Strong community consensus: ${verifs} local residents confirmed active issue`);
  } else if (verifs >= 1) {
    score += 8;
    reasons.push(`${verifs} community members independently confirmed defect`);
  }

  // 4. Time Elapsed / SLA Factor (Weight: 25%)
  const ageMs = Date.now() - new Date(input.createdAt || Date.now()).getTime();
  const ageHours = Math.max(0, ageMs / (1000 * 3600));
  const ageDays = Math.floor(ageHours / 24);

  if (ageHours >= 72) {
    score += 25;
    reasons.push(`Pending resolution for ${ageDays > 0 ? `${ageDays} days` : `${Math.round(ageHours)} hours`}, breaching municipal SLA`);
  } else if (ageHours >= 24) {
    score += 15;
    reasons.push(`Unresolved for ${Math.round(ageHours)} hours`);
  } else {
    reasons.push('Recently logged ticket within active response window');
  }

  // 5. High-Risk Transit Location Bonus
  const loc = (input.location || '').toLowerCase();
  if (loc.includes('highway') || loc.includes('arterial') || loc.includes('cross') || loc.includes('junction') || loc.includes('metro')) {
    score += 10;
    reasons.push('High-traffic arterial intersection with elevated collision risk');
  }

  // Clamp score 0 - 100
  score = Math.min(100, Math.max(10, score));

  // Determine Priority Tier
  let priority: PriorityLevel = 'MEDIUM';
  if (score >= 80) {
    priority = 'URGENT';
  } else if (score >= 65) {
    priority = 'HIGH';
  } else if (score < 40) {
    priority = 'LOW';
  }

  return {
    priority,
    score,
    reasons,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Allow administrator override of priority
 */
export function overridePriorityByAdmin(
  assessment: PriorityAssessment,
  newPriority: PriorityLevel,
  reason: string
): PriorityAssessment {
  return {
    ...assessment,
    priority: newPriority,
    adminOverridePriority: newPriority,
    adminOverrideReason: reason.trim() || 'Manual municipal triage override',
    calculatedAt: new Date().toISOString(),
  };
}
