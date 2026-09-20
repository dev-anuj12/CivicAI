import { CivicReport, IntegrityStatus, ReportIntegrityRecord } from '../types';
import { computeHaversineDistanceMeters, computePerceptualImageHash, computeTextSimilarity } from './duplicateDetector';

/**
 * 10. REPORT INTEGRITY ENGINE
 * Protects municipal dispatch from spam, duplicate bombardment, and fraudulent reports.
 * Uses: NORMAL, REVIEW, FLAGGED (Never auto-bans citizens).
 */
export async function assessReportIntegrity(
  targetReport: CivicReport,
  recentReports: CivicReport[]
): Promise<ReportIntegrityRecord> {
  const flags: string[] = [];
  let integrityScore = 95; // 100 is pristine

  const userReports = recentReports.filter(
    (r) => r.userId && targetReport.userId && r.userId === targetReport.userId
  );

  // 1. Submission Velocity Check (Excessive reports in 1 hour)
  const oneHourAgo = Date.now() - 3600 * 1000;
  const recentUserReportsCount = userReports.filter(
    (r) => r.createdAt && new Date(r.createdAt).getTime() > oneHourAgo
  ).length;

  if (recentUserReportsCount >= 5) {
    integrityScore -= 35;
    flags.push(`Rapid submission velocity (${recentUserReportsCount} reports in under 60 minutes)`);
  } else if (recentUserReportsCount >= 3) {
    integrityScore -= 15;
    flags.push('Elevated reporting frequency from this account');
  }

  // 2. Exact/Near-Exact Image Duplicate Reuse
  let maxImageMatch = 0;
  if (targetReport.imageUrl) {
    const targetHash = await computePerceptualImageHash(targetReport.imageUrl);
    for (const r of recentReports) {
      if (r.id === targetReport.id || !r.imageUrl) continue;
      const otherHash = await computePerceptualImageHash(r.imageUrl);
      if (targetHash && otherHash && targetHash === otherHash) {
        maxImageMatch = 100;
        integrityScore -= 40;
        flags.push(`Exact duplicate evidence photo re-used from previous ticket (${r.id})`);
        break;
      }
    }
  }

  // 3. Coordinate Cluster Flooding (Multiple reports within 15 meters)
  const targetLat = targetReport.latitude ?? 21.1458;
  const targetLng = targetReport.longitude ?? 79.0882;
  const geoClusterCount = recentReports.filter((r) => {
    if (r.id === targetReport.id) return false;
    const rLat = r.latitude ?? 21.1458;
    const rLng = r.longitude ?? 79.0882;
    return computeHaversineDistanceMeters(targetLat, targetLng, rLat, rLng) <= 15;
  }).length;

  if (geoClusterCount >= 4) {
    integrityScore -= 20;
    flags.push(`High spatial density: ${geoClusterCount} tickets logged at exact same 15m coordinate`);
  }

  // 4. Repeated Generic Description Spam Check
  for (const r of userReports) {
    if (r.id === targetReport.id) continue;
    const sim = computeTextSimilarity(targetReport.description, r.description);
    if (sim >= 90 && targetReport.description.length > 10) {
      integrityScore -= 20;
      flags.push('Identical repeated complaint description text across submissions');
      break;
    }
  }

  // 5. Determine Integrity Status
  let status: IntegrityStatus = 'NORMAL';
  if (integrityScore < 50 || maxImageMatch === 100 || recentUserReportsCount >= 6) {
    status = 'FLAGGED';
  } else if (integrityScore < 75 || flags.length > 0) {
    status = 'REVIEW';
  }

  return {
    reportId: targetReport.id,
    status,
    flags: flags.length > 0 ? flags : ['Passed automated integrity checks without anomalies'],
    confidenceScore: Math.max(20, Math.min(99, integrityScore)),
    submissionVelocity: recentUserReportsCount || 1,
    imageDuplicateRisk: maxImageMatch,
    geoRadiusDensity: geoClusterCount || 1,
    analyzedAt: new Date().toISOString(),
    adminReviewed: false,
  };
}
