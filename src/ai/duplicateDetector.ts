import { CivicIssue, CivicReport, DuplicateMatch, DuplicateSignals } from '../types';

/**
 * 3. DUPLICATE COMPLAINT DETECTION ENGINE
 * Computes multi-signal similarity scores across Space, Vision, Text, Taxonomy & Time.
 */

// Haversine formula to compute great-circle distance between two GPS coordinates in meters
export function computeHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Simple Jaccard word-level text similarity
export function computeTextSimilarity(textA: string, textB: string): number {
  const wordsA = new Set((textA || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const wordsB = new Set((textB || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return Math.round((intersection / union) * 100);
}

// Compute fast perceptual image hash string (64-bit dHash / aHash)
export async function computePerceptualImageHash(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    if (!imageSrc) {
      resolve('');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        const grayValues = [];
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          grayValues.push(gray);
          sum += gray;
        }
        const avg = sum / 64;
        let hash = '';
        for (const g of grayValues) {
          hash += g >= avg ? '1' : '0';
        }
        resolve(hash);
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = imageSrc;
  });
}

// Compare two 64-bit binary hash strings via Hamming distance
export function computeHashSimilarity(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 40; // Default baseline
  let matches = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] === hashB[i]) matches++;
  }
  return Math.round((matches / hashA.length) * 100);
}

/**
 * Check a new report against existing consolidated civic issues and reports
 */
export async function detectDuplicateComplaints(
  newReport: Partial<CivicReport>,
  existingIssues: CivicIssue[],
  existingReports: CivicReport[],
  threshold = 68
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];

  const newLat = newReport.latitude ?? 21.1458;
  const newLng = newReport.longitude ?? 79.0882;
  const newText = `${newReport.title || ''} ${newReport.description || ''} ${newReport.location || ''}`;
  const newCategory = (newReport.category || '').toLowerCase();
  const newImageHash = newReport.imageUrl ? await computePerceptualImageHash(newReport.imageUrl) : '';

  // 1. Check against consolidated CivicIssues
  for (const issue of existingIssues) {
    if (issue.status === 'RESOLVED' || issue.status === 'REJECTED') continue;

    const distMeters = computeHaversineDistanceMeters(newLat, newLng, issue.latitude, issue.longitude);
    const categoryMatch = issue.category.toLowerCase() === newCategory || issue.category.includes(newCategory) || newCategory.includes(issue.category.toLowerCase());
    const textSim = computeTextSimilarity(newText, `${issue.title} ${issue.location} ${issue.subcategory || ''}`);
    const issueImageHash = issue.primaryImageUrl ? await computePerceptualImageHash(issue.primaryImageUrl) : '';
    const visualSim = (newImageHash && issueImageHash) ? computeHashSimilarity(newImageHash, issueImageHash) : 50;

    const hoursDiff = Math.abs(Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 3600);

    // Multi-signal weighted formula
    // Geo: 40%, Visual: 25%, Text: 20%, Category: 15%
    let geoScore = 0;
    if (distMeters <= 30) geoScore = 100;
    else if (distMeters <= 75) geoScore = 85;
    else if (distMeters <= 150) geoScore = 65;
    else if (distMeters <= 300) geoScore = 35;
    else geoScore = 5;

    const categoryScore = categoryMatch ? 100 : 20;

    const totalSimilarity = Math.round(
      geoScore * 0.40 +
      visualSim * 0.25 +
      textSim * 0.20 +
      categoryScore * 0.15
    );

    if (totalSimilarity >= threshold && (distMeters <= 250 || categoryMatch)) {
      const signals: DuplicateSignals = {
        geoDistanceMeters: distMeters,
        visualSimilarity: visualSim,
        textSimilarity: textSim,
        categoryMatch,
        temporalHours: Math.round(hoursDiff * 10) / 10,
      };

      matches.push({
        id: `dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sourceReportId: newReport.id || 'NEW_REPORT',
        targetIssueId: issue.id,
        similarityScore: totalSimilarity,
        signals,
        status: 'possible_duplicate',
        matchedAt: new Date().toISOString(),
        sourceReportTitle: newReport.title,
        targetIssueTitle: issue.title,
        sourceReportImage: newReport.imageUrl,
        targetIssueImage: issue.primaryImageUrl,
      });
    }
  }

  // 2. Also check against individual unlinked reports within proximity
  for (const report of existingReports) {
    if (report.id === newReport.id || report.status === 'RESOLVED' || report.status === 'REJECTED') continue;
    if (matches.some((m) => m.targetReportId === report.id || m.targetIssueId === report.issueId)) continue;

    const repLat = report.latitude ?? 21.1458;
    const repLng = report.longitude ?? 79.0882;
    const distMeters = computeHaversineDistanceMeters(newLat, newLng, repLat, repLng);

    if (distMeters > 300) continue;

    const categoryMatch = report.category.toLowerCase() === newCategory;
    const textSim = computeTextSimilarity(newText, `${report.title} ${report.description} ${report.location}`);
    const reportImageHash = report.imageUrl ? await computePerceptualImageHash(report.imageUrl) : '';
    const visualSim = (newImageHash && reportImageHash) ? computeHashSimilarity(newImageHash, reportImageHash) : 50;

    let geoScore = distMeters <= 40 ? 100 : distMeters <= 100 ? 80 : 50;
    const totalSimilarity = Math.round(
      geoScore * 0.40 +
      visualSim * 0.25 +
      textSim * 0.20 +
      (categoryMatch ? 100 : 20) * 0.15
    );

    if (totalSimilarity >= threshold) {
      matches.push({
        id: `dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sourceReportId: newReport.id || 'NEW_REPORT',
        targetIssueId: report.issueId || report.id,
        targetReportId: report.id,
        similarityScore: totalSimilarity,
        signals: {
          geoDistanceMeters: distMeters,
          visualSimilarity: visualSim,
          textSimilarity: textSim,
          categoryMatch,
          temporalHours: 24,
        },
        status: 'possible_duplicate',
        matchedAt: new Date().toISOString(),
        sourceReportTitle: newReport.title,
        targetIssueTitle: report.title,
        sourceReportImage: newReport.imageUrl,
        targetIssueImage: report.imageUrl,
      });
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}
