/**
 * CIVICAI: Public & Citizen Report Tracker View
 * Search and follow end-to-end municipal status timeline
 */

import { db } from '../storage-db.js';
import { CIVIC_TAXONOMY, STATUS_FLOW } from '../config.js';
import { notificationService } from '../notification-service.js';

export async function renderTrack(container, navigateTo, params = {}) {
  const initialReportId = params.reportId || 'CIV-2026-10482';

  container.innerHTML = `
    <div class="container section-sm" style="max-width: 840px;">
      
      <!-- Track Header & Search Bar -->
      <div style="text-align: center; margin-bottom: 2.5rem;">
        <div class="section-tag">
          <i class="fa-solid fa-satellite-dish"></i> Realtime Civic Resolution Tracking
        </div>
        <h1 style="font-size: 2.25rem; margin-bottom: 0.75rem;">Track Civic Issue Report</h1>
        <p style="color: var(--neutral-600); font-size: 1rem; max-width: 540px; margin: 0 auto 1.5rem auto;">
          Enter your public Report ID (e.g., CIV-2026-10482) to view live inspection status, assigned department, and audit history.
        </p>

        <!-- Search Input -->
        <div style="display: flex; gap: 0.75rem; max-width: 520px; margin: 0 auto;">
          <div style="position: relative; flex: 1;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--neutral-400);"></i>
            <input 
              type="text" 
              id="track-search-input" 
              class="form-control mono" 
              placeholder="CIV-2026-XXXXX" 
              value="${initialReportId}"
              style="padding-left: 2.75rem; text-transform: uppercase; font-weight: 700; font-size: 1.05rem;"
            />
          </div>
          <button type="button" id="btn-search-track" class="btn btn-primary btn-lg">
            Track
          </button>
        </div>

        <!-- Quick Sample Badges -->
        <div style="margin-top: 1rem; display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem;">
          <span style="color: var(--neutral-400);">Try Sample IDs:</span>
          <button type="button" class="sample-id-chip btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" data-id="CIV-2026-10482">CIV-2026-10482 (In Progress)</button>
          <button type="button" class="sample-id-chip btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" data-id="CIV-2026-10483">CIV-2026-10483 (Assigned)</button>
          <button type="button" class="sample-id-chip btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" data-id="CIV-2026-10485">CIV-2026-10485 (Resolved)</button>
        </div>
      </div>

      <!-- Report Details & Timeline Result Container -->
      <div id="track-result-stage">
        <!-- Injected via loadReportDetails() -->
      </div>

    </div>
  `;

  async function loadReportDetails(reportId) {
    const stage = document.getElementById('track-result-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary-600); margin-bottom: 1rem;"></i>
        <p style="color: var(--neutral-500);">Fetching municipal audit records for ${reportId}...</p>
      </div>
    `;

    const report = await db.getReportById(reportId);
    if (!report) {
      stage.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fa-solid fa-file-circle-question" style="font-size: 1.75rem;"></i>
          </div>
          <h3>Report ID Not Found</h3>
          <p>We could not find any active civic report with ID <strong>${reportId}</strong>. Please check the spelling or file a new report.</p>
          <button type="button" id="btn-empty-file-report" class="btn btn-primary">
            Report an Issue Now
          </button>
        </div>
      `;
      document.getElementById('btn-empty-file-report')?.addEventListener('click', () => navigateTo('report'));
      return;
    }

    const history = await db.getStatusHistory(report.report_id);

    // Calculate timeline step statuses
    const isSubmittedDone = true;
    const isAIDone = !!report.ai_detected_issue || report.ai_confidence > 0;
    const isReviewDone = ['Under Review', 'Assigned', 'In Progress', 'Resolved'].includes(report.status);
    const isAssignedDone = ['Assigned', 'In Progress', 'Resolved'].includes(report.status);
    const isInProgressDone = ['In Progress', 'Resolved'].includes(report.status);
    const isResolvedDone = report.status === 'Resolved';

    stage.innerHTML = `
      <!-- Main Info Card -->
      <div class="card" style="margin-bottom: 2rem; border-color: var(--neutral-300);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--neutral-200); padding-bottom: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem;">
              <span class="mono" style="font-size: 1.15rem; font-weight: 800; color: var(--primary-800);">${report.report_id}</span>
              <span class="badge badge-status-${report.status.toLowerCase().replace(/\s+/g, '-')}">${report.status}</span>
              <span class="badge badge-severity-${report.severity.toLowerCase()}">${report.severity} Severity</span>
            </div>
            <h2 style="font-size: 1.35rem; color: var(--neutral-900); margin: 0;">${report.title}</h2>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 0.775rem; color: var(--neutral-400); text-transform: uppercase; font-weight: 600;">Reported On</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--neutral-700);">
              ${new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem;">
          <div style="border-radius: var(--radius-lg); overflow: hidden; height: 180px; background: var(--neutral-900);">
            <img src="${report.image_url}" alt="Report Photo" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>

          <div>
            <p style="font-size: 0.95rem; color: var(--neutral-700); line-height: 1.6; margin-bottom: 1.25rem;">
              ${report.description}
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem; background: var(--neutral-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--neutral-200);">
              <div>
                <span style="color: var(--neutral-500); display: block;">Category</span>
                <strong style="color: var(--neutral-900);"><i class="fa-solid ${CIVIC_TAXONOMY[report.category]?.icon || 'fa-tag'}"></i> ${report.category}</strong>
              </div>
              <div>
                <span style="color: var(--neutral-500); display: block;">Subcategory</span>
                <strong style="color: var(--neutral-900);">${report.subcategory || 'Standard Grievance'}</strong>
              </div>
              <div style="grid-column: span 2;">
                <span style="color: var(--neutral-500); display: block;">Location</span>
                <strong style="color: var(--neutral-900);"><i class="fa-solid fa-location-dot" style="color: var(--color-critical);"></i> ${report.location} ${report.landmark ? `(Near: ${report.landmark})` : ''}</strong>
              </div>
              <div style="grid-column: span 2;">
                <span style="color: var(--neutral-500); display: block;">Assigned Department</span>
                <strong style="color: var(--primary-700);"><i class="fa-solid fa-building-columns"></i> ${report.assigned_authority || 'Municipal Grievance Cell'}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Diagnostics Box -->
        ${report.ai_detected_issue ? `
          <div style="margin-top: 1.5rem; background: var(--primary-50); border: 1px solid var(--primary-200); border-radius: var(--radius-lg); padding: 1.25rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="font-size: 0.825rem; font-weight: 700; color: var(--primary-900); display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-brain" style="color: var(--primary-600);"></i> AI Vision Diagnostic Record
              </span>
              <span class="badge badge-confidence-high">${report.ai_confidence || 94.6}% Confidence</span>
            </div>
            <div style="font-size: 0.875rem; color: var(--primary-800); line-height: 1.5;">
              ${report.ai_explanation || 'Computer vision verified surface conditions consistent with reported civic hazard.'}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Resolution Progress Timeline -->
      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-timeline" style="color: var(--primary-600);"></i> Resolution Lifecycle Timeline
        </h3>

        <div class="timeline-tracker">
          
          <!-- Step 1: Submitted -->
          <div class="timeline-step ${isSubmittedDone ? 'completed' : ''}">
            <div class="timeline-dot">
              <i class="fa-solid fa-check"></i>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-title">Report Registered</span>
                <span class="timeline-date">${new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="timeline-desc">Issue photograph and geolocation uploaded to municipal repository.</div>
            </div>
          </div>

          <!-- Step 2: AI Diagnostic -->
          <div class="timeline-step ${isAIDone ? 'completed' : ''}">
            <div class="timeline-dot">
              <i class="fa-solid fa-microchip"></i>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-title">AI Vision Diagnostics Completed</span>
                <span class="timeline-date">${report.ai_confidence ? `${report.ai_confidence}% Match` : 'Passed'}</span>
              </div>
              <div class="timeline-desc">Automated feature classification confirmed category and urgency level.</div>
            </div>
          </div>

          <!-- Step 3: Under Review -->
          <div class="timeline-step ${isReviewDone ? (report.status === 'Under Review' ? 'current' : 'completed') : ''}">
            <div class="timeline-dot">
              <i class="fa-solid fa-magnifying-glass"></i>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-title">Authority Desk Verification</span>
                <span class="timeline-date">${isReviewDone ? 'Verified' : 'Pending'}</span>
              </div>
              <div class="timeline-desc">Zonal civic officer verified location and scheduled field engineer inspection.</div>
            </div>
          </div>

          <!-- Step 4: Assigned -->
          <div class="timeline-step ${isAssignedDone ? (report.status === 'Assigned' ? 'current' : 'completed') : ''}">
            <div class="timeline-dot">
              <i class="fa-solid fa-user-gear"></i>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-title">Assigned to Field Repair Crew</span>
                <span class="timeline-date">${report.assigned_authority ? report.assigned_authority : 'Assigned'}</span>
              </div>
              <div class="timeline-desc">Work order generated and allocated to ward maintenance team.</div>
            </div>
          </div>

          <!-- Step 5: In Progress -->
          <div class="timeline-step ${isInProgressDone ? (report.status === 'In Progress' ? 'current' : 'completed') : ''}">
            <div class="timeline-dot">
              <i class="fa-solid fa-person-digging"></i>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-title">Work In Progress</span>
                <span class="timeline-date">${isInProgressDone ? 'Active On-Site' : 'Queued'}</span>
              </div>
              <div class="timeline-desc">Field engineering crew deployed on-site executing necessary repairs.</div>
            </div>
          </div>

          <!-- Step 6: Resolved -->
          <div class="timeline-step ${isResolvedDone ? 'completed' : ''}">
            <div class="timeline-dot">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div class="timeline-content" style="${isResolvedDone ? 'border-color: var(--color-success); background: var(--color-success-bg);' : ''}">
              <div class="timeline-header">
                <span class="timeline-title" style="${isResolvedDone ? 'color: var(--color-success);' : ''}">
                  ${isResolvedDone ? 'Issue Successfully Resolved' : 'Resolution Pending'}
                </span>
                <span class="timeline-date">${report.resolved_at ? new Date(report.resolved_at).toLocaleDateString() : ''}</span>
              </div>
              <div class="timeline-desc">${isResolvedDone ? 'Work inspected and signed off by municipal ward supervisor.' : 'Final inspection and closure upon completion.'}</div>
            </div>
          </div>

        </div>
      </div>

      <!-- Audit Log History Entries -->
      <div class="card">
        <h3 style="font-size: 1.15rem; margin-bottom: 1rem; color: var(--neutral-800);">
          <i class="fa-solid fa-list-check"></i> Official Status Audit Log (${history.length} events)
        </h3>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${history.map(item => `
            <div style="padding: 0.85rem 1rem; background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
              <div>
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--neutral-900); margin-bottom: 0.2rem;">
                  Status changed to <span class="badge badge-status-${item.new_status.toLowerCase().replace(/\s+/g, '-')}">${item.new_status}</span>
                </div>
                <div style="font-size: 0.825rem; color: var(--neutral-600);">
                  ${item.comment || 'Status updated in official municipal log.'}
                </div>
              </div>
              <div style="text-align: right; font-size: 0.775rem; color: var(--neutral-400); white-space: nowrap;">
                <div>${item.changed_by_name || 'System'}</div>
                <div>${new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Search Button handler
  document.getElementById('btn-search-track')?.addEventListener('click', () => {
    const query = document.getElementById('track-search-input')?.value.trim();
    if (query) loadReportDetails(query);
    else notificationService.showToast('Input Required', 'Please enter a report ID to track.', 'warning');
  });

  // Sample ID chips
  container.querySelectorAll('.sample-id-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      const input = document.getElementById('track-search-input');
      if (input) input.value = id;
      loadReportDetails(id);
    });
  });

  // Trigger initial search
  if (initialReportId) {
    loadReportDetails(initialReportId);
  }
}
