/**
 * CIVICAI: Authority & Municipal Admin Command Center
 * Full Report Administration + AI-Assisted Municipal Triage & Action Plan Generator
 */

import { db, dbEvents } from '../storage-db.js';
import { auth } from '../auth-service.js';
import { CIVIC_TAXONOMY, STATUS_FLOW, SEVERITY_LEVELS } from '../config.js';
import { AIVisionService } from '../ai-vision-service.js';
import { notificationService } from '../notification-service.js';

export async function renderAuthorityDash(container, navigateTo) {
  const user = auth.getUser();
  const authorityName = user ? user.full_name : 'Municipal Administrator';
  const authorityDept = user?.department || 'Central Municipal Administration';

  let currentFilters = {
    search: '',
    category: 'All',
    status: 'All',
    severity: 'All',
    role: 'authority'
  };

  async function loadAuthorityDashboard() {
    const stats = await db.getDashboardStats('authority');
    const reports = await db.getAllReports(currentFilters);

    container.innerHTML = `
      <div class="container section-sm">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div class="section-tag" style="background: #faf5ff; color: #7c3aed; border-color: #ddd6fe; margin-bottom: 0.5rem;">
              <i class="fa-solid fa-shield-halved"></i> Municipal Administrator Command Center
            </div>
            <h1 style="font-size: 2rem; margin: 0;">City Civic Operations Hub</h1>
            <p style="color: var(--neutral-500); font-size: 0.95rem; margin-top: 0.25rem;">
              Administrator: <strong>${authorityName}</strong> &bull; Dept: <strong>${authorityDept}</strong>
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="btn-export-reports" class="btn btn-outline">
              <i class="fa-solid fa-file-arrow-down"></i> Export CSV
            </button>
            <button type="button" id="btn-refresh-authority" class="btn btn-primary">
              <i class="fa-solid fa-arrows-rotate"></i> Refresh Queue
            </button>
          </div>
        </div>

        <!-- 6 Metrics Counters -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <div class="stat-card">
            <div class="stat-icon stat-icon-total"><i class="fa-solid fa-layer-group"></i></div>
            <div class="stat-info">
              <span class="stat-label">Total Reports</span>
              <span class="stat-value">${stats.total}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-submitted"><i class="fa-solid fa-bell"></i></div>
            <div class="stat-info">
              <span class="stat-label">New Reports</span>
              <span class="stat-value">${stats.submitted}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-critical"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="stat-info">
              <span class="stat-label">High / Critical</span>
              <span class="stat-value">${stats.critical + stats.high}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-review"><i class="fa-solid fa-clipboard-check"></i></div>
            <div class="stat-info">
              <span class="stat-label">Under Review</span>
              <span class="stat-value">${stats.underReview}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-progress"><i class="fa-solid fa-person-digging"></i></div>
            <div class="stat-info">
              <span class="stat-label">In Progress</span>
              <span class="stat-value">${stats.inProgress}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-resolved"><i class="fa-solid fa-circle-check"></i></div>
            <div class="stat-info">
              <span class="stat-label">Resolved</span>
              <span class="stat-value">${stats.resolved}</span>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="filter-toolbar">
          <div class="filter-row-main">
            <div class="search-input-wrapper">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input 
                type="text" 
                id="auth-search-input" 
                class="form-control" 
                placeholder="Search across all reports by ID, Issue Title, Location, or Department..." 
                value="${currentFilters.search}" 
              />
            </div>
          </div>

          <div class="filter-row-chips">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--neutral-500); text-transform: uppercase;">
              Filters:
            </span>

            <select id="auth-filter-category" class="filter-select">
              <option value="All">All Categories (9)</option>
              ${Object.keys(CIVIC_TAXONOMY).map(c => `
                <option value="${c}" ${currentFilters.category === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>

            <select id="auth-filter-status" class="filter-select">
              <option value="All">All Statuses</option>
              ${STATUS_FLOW.map(s => `
                <option value="${s}" ${currentFilters.status === s ? 'selected' : ''}>${s}</option>
              `).join('')}
            </select>

            <select id="auth-filter-severity" class="filter-select">
              <option value="All">All Severities</option>
              ${SEVERITY_LEVELS.map(sev => `
                <option value="${sev}" ${currentFilters.severity === sev ? 'selected' : ''}>${sev} Severity</option>
              `).join('')}
            </select>

            ${(currentFilters.search || currentFilters.category !== 'All' || currentFilters.status !== 'All' || currentFilters.severity !== 'All') ? `
              <button type="button" id="btn-auth-clear-filters" class="btn btn-outline btn-sm" style="color: var(--color-critical);">
                <i class="fa-solid fa-xmark"></i> Clear Filters
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Authority Reports Table -->
        ${reports.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">
              <i class="fa-solid fa-list-check" style="font-size: 2rem;"></i>
            </div>
            <h3>No Reports Matching Filter</h3>
            <p>All civic grievances in this queue are currently cleared.</p>
          </div>
        ` : `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Issue & Category</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>AI Diagnostics</th>
                  <th>Status</th>
                  <th>Reported Date</th>
                  <th style="text-align: right;">Admin Action</th>
                </tr>
              </thead>
              <tbody>
                ${reports.map(rep => `
                  <tr>
                    <td>
                      <span class="mono" style="font-weight: 700; color: var(--primary-800);">${rep.report_id}</span>
                    </td>
                    <td>
                      <div style="font-weight: 700; color: var(--neutral-900);">${rep.title}</div>
                      <div style="font-size: 0.8rem; color: var(--neutral-500);">
                        <i class="fa-solid ${CIVIC_TAXONOMY[rep.category]?.icon || 'fa-tag'}"></i> ${rep.category}
                      </div>
                    </td>
                    <td>
                      <div style="font-size: 0.85rem; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <i class="fa-solid fa-location-dot" style="color: var(--color-critical); font-size: 0.75rem;"></i>
                        ${rep.location}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-severity-${rep.severity.toLowerCase()}">${rep.severity}</span>
                    </td>
                    <td>
                      ${rep.ai_confidence ? `
                        <span class="badge badge-confidence-high" title="${rep.ai_explanation}">
                          <i class="fa-solid fa-microchip"></i> ${rep.ai_confidence}%
                        </span>
                      ` : '<span style="color: var(--neutral-400); font-size: 0.8rem;">Manual</span>'}
                    </td>
                    <td>
                      <span class="badge badge-status-${rep.status.toLowerCase().replace(/\s+/g, '-')}">${rep.status}</span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--neutral-500); white-space: nowrap;">
                      ${new Date(rep.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                      <button type="button" class="btn btn-primary btn-sm btn-update-status" data-report-id="${rep.report_id}">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> AI Admin Triage
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}

      </div>

      <!-- AI-ASSISTED STATUS UPDATE MODAL -->
      <div id="status-update-modal" class="modal-backdrop">
        <div class="modal-content" style="max-width: 680px;">
          <div class="modal-header">
            <div>
              <span style="font-size: 0.775rem; font-weight: 700; color: var(--primary-700); text-transform: uppercase;">
                Admin Triage & AI Resolution Dispatch
              </span>
              <h3 id="modal-report-id-title" style="font-size: 1.25rem; margin: 0;">Update Civic Report</h3>
            </div>
            <button type="button" class="modal-close" id="btn-close-status-modal">
              <i class="fa-solid fa-xmark" style="font-size: 1.25rem;"></i>
            </button>
          </div>

          <div class="modal-body">
            <!-- Report Brief Summary -->
            <div id="modal-report-summary" style="margin-bottom: 1.25rem; background: var(--neutral-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--neutral-200);">
            </div>

            <!-- AI Action Assistant Panel -->
            <div style="background: linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%); border: 1px solid var(--primary-200); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--primary-900); display: flex; align-items: center; gap: 0.4rem;">
                  <i class="fa-solid fa-robot" style="color: var(--primary-700);"></i> AI Municipal Action Assistant
                </div>
                <button type="button" id="btn-ask-ai-plan" class="btn btn-outline btn-sm" style="background: white; border-color: var(--primary-300); color: var(--primary-800);">
                  <i class="fa-solid fa-bolt"></i> Generate Action Plan
                </button>
              </div>

              <div id="ai-plan-output" style="font-size: 0.85rem; color: var(--primary-950); line-height: 1.5;">
                Click <strong>"Generate Action Plan"</strong> to get AI recommendations for crew deployment, equipment, and auto-generated citizen communication.
              </div>
            </div>

            <form id="form-update-status">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label form-label-required" for="modal-new-status">New Resolution Status</label>
                  <select id="modal-new-status" class="form-control">
                    ${STATUS_FLOW.map(s => `<option value="${s}">${s}</option>`).join('')}
                    <option value="Rejected">Rejected (Out of Municipal Jurisdiction / Duplicate)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="modal-assigned-dept">Assigned Authority Department</label>
                  <select id="modal-assigned-dept" class="form-control">
                    ${Object.values(CIVIC_TAXONOMY).map(t => `
                      <option value="${t.department}">${t.department}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <div class="form-label form-label-required">
                  <span>Official Inspection Notes & Citizen Update</span>
                  <button type="button" id="btn-auto-fill-citizen-note" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Generate with AI
                  </button>
                </div>
                <textarea id="modal-status-comment" class="form-control" rows="3" placeholder="Provide notes on field action taken, work order number, or reason for status transition..."></textarea>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-save-status-update">
              <i class="fa-solid fa-check"></i> Save & Notify Citizen
            </button>
          </div>
        </div>
      </div>
    `;

    // Modal & AI Assistant Handlers
    let activeModalReport = null;
    const modalBackdrop = document.getElementById('status-update-modal');

    container.querySelectorAll('.btn-update-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.reportId;
        activeModalReport = await db.getReportById(id);
        if (!activeModalReport) return;

        document.getElementById('modal-report-id-title').textContent = `Update Report: ${activeModalReport.report_id}`;
        document.getElementById('modal-new-status').value = activeModalReport.status;
        document.getElementById('modal-assigned-dept').value = activeModalReport.assigned_authority || CIVIC_TAXONOMY[activeModalReport.category]?.department;
        document.getElementById('modal-status-comment').value = '';
        
        // Reset AI Plan container
        document.getElementById('ai-plan-output').innerHTML = `
          Click <strong>"Generate Action Plan"</strong> to get AI recommendations for crew deployment, equipment, and auto-generated citizen communication.
        `;

        document.getElementById('modal-report-summary').innerHTML = `
          <div style="font-weight: 700; color: var(--neutral-900); font-size: 0.95rem; margin-bottom: 0.25rem;">${activeModalReport.title}</div>
          <div style="font-size: 0.825rem; color: var(--neutral-600); margin-bottom: 0.5rem;"><i class="fa-solid fa-location-dot" style="color: var(--color-critical);"></i> ${activeModalReport.location}</div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <span class="badge badge-status-${activeModalReport.status.toLowerCase().replace(/\s+/g, '-')}">${activeModalReport.status}</span>
            <span class="badge badge-severity-${activeModalReport.severity.toLowerCase()}">${activeModalReport.severity} Severity</span>
            ${activeModalReport.ai_confidence ? `<span class="badge badge-confidence-high"><i class="fa-solid fa-microchip"></i> AI: ${activeModalReport.ai_confidence}%</span>` : ''}
          </div>
        `;

        modalBackdrop?.classList.add('open');
      });
    });

    // AI Action Plan Generator Button
    document.getElementById('btn-ask-ai-plan')?.addEventListener('click', async () => {
      if (!activeModalReport) return;
      const planBtn = document.getElementById('btn-ask-ai-plan');
      const outputEl = document.getElementById('ai-plan-output');
      planBtn.classList.add('loading');
      planBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`;

      try {
        const plan = await AIVisionService.generateAdminActionRecommendation(activeModalReport);
        outputEl.innerHTML = `
          <div style="margin-bottom: 0.5rem;"><strong>Recommended Crew:</strong> ${plan.crewType} &bull; <strong>Target SLA:</strong> ${plan.estimatedTime}</div>
          <div style="margin-bottom: 0.5rem;"><strong>Suggested Action:</strong> ${plan.suggestedAction}</div>
          <div><strong>Safety Equipment:</strong> ${plan.safetyEquipment}</div>
        `;

        // Pre-suggest next status
        const statusSelect = document.getElementById('modal-new-status');
        if (statusSelect && plan.recommendedStatus) {
          statusSelect.value = plan.recommendedStatus;
        }

        // Pre-fill comment note automatically
        const autoNote = AIVisionService.generateCitizenStatusNote(activeModalReport, plan.recommendedStatus);
        document.getElementById('modal-status-comment').value = autoNote;

        notificationService.showToast('AI Action Plan Ready', 'Pre-filled recommended action & citizen note.', 'success');
      } catch (err) {
        console.error(err);
      } finally {
        planBtn.classList.remove('loading');
        planBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Generate Action Plan`;
      }
    });

    // Auto-Generate Citizen Note button
    document.getElementById('btn-auto-fill-citizen-note')?.addEventListener('click', () => {
      if (!activeModalReport) return;
      const currentStatusVal = document.getElementById('modal-new-status')?.value || 'In Progress';
      const note = AIVisionService.generateCitizenStatusNote(activeModalReport, currentStatusVal);
      document.getElementById('modal-status-comment').value = note;
    });

    const closeModal = () => modalBackdrop?.classList.remove('open');
    document.getElementById('btn-close-status-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal')?.addEventListener('click', closeModal);

    document.getElementById('btn-save-status-update')?.addEventListener('click', async () => {
      if (!activeModalReport) return;

      const newStatus = document.getElementById('modal-new-status')?.value;
      const comment = document.getElementById('modal-status-comment')?.value.trim();

      if (!comment) {
        notificationService.showToast('Comment Required', 'Please enter inspection notes or click Auto-Generate with AI.', 'error');
        document.getElementById('modal-status-comment')?.focus();
        return;
      }

      const saveBtn = document.getElementById('btn-save-status-update');
      saveBtn.classList.add('loading');

      try {
        await db.updateReportStatus(
          activeModalReport.report_id,
          newStatus,
          comment,
          authorityName
        );

        notificationService.showToast('Status Updated', `Report ${activeModalReport.report_id} updated to ${newStatus}.`, 'success');
        closeModal();
        await loadAuthorityDashboard();
      } catch (err) {
        console.error(err);
        notificationService.showToast('Update Failed', 'Could not update report status.', 'error');
      } finally {
        saveBtn.classList.remove('loading');
      }
    });

    // Search and Filters
    document.getElementById('auth-search-input')?.addEventListener('input', debounce((e) => {
      currentFilters.search = e.target.value.trim();
      loadAuthorityDashboard();
    }, 300));

    document.getElementById('auth-filter-category')?.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      loadAuthorityDashboard();
    });

    document.getElementById('auth-filter-status')?.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      loadAuthorityDashboard();
    });

    document.getElementById('auth-filter-severity')?.addEventListener('change', (e) => {
      currentFilters.severity = e.target.value;
      loadAuthorityDashboard();
    });

    document.getElementById('btn-auth-clear-filters')?.addEventListener('click', () => {
      currentFilters = { search: '', category: 'All', status: 'All', severity: 'All', role: 'authority' };
      loadAuthorityDashboard();
    });

    document.getElementById('btn-refresh-authority')?.addEventListener('click', () => {
      loadAuthorityDashboard();
      notificationService.showToast('Queue Refreshed', 'Fetched latest reports from database.', 'info');
    });

    document.getElementById('btn-export-reports')?.addEventListener('click', async () => {
      const allReps = await db.getAllReports({ role: 'authority' });
      const csv = 'ReportID,Category,Title,Location,Severity,Status,CreatedAt\n' +
        allReps.map(r => `"${r.report_id}","${r.category}","${r.title.replace(/"/g, '""')}","${r.location.replace(/"/g, '""')}","${r.severity}","${r.status}","${r.created_at}"`).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CivicAI_Reports_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      notificationService.showToast('Export Complete', 'Downloaded reports CSV.', 'success');
    });
  }

  await loadAuthorityDashboard();
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
