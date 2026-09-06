/**
 * CIVICAI: Citizen Dashboard & "My Reports" Portal
 */

import { db, dbEvents } from '../storage-db.js';
import { auth } from '../auth-service.js';
import { CIVIC_TAXONOMY, STATUS_FLOW, SEVERITY_LEVELS } from '../config.js';

export async function renderCitizenDash(container, navigateTo) {
  const user = auth.getUser();
  const userName = user ? user.full_name : 'Citizen';

  let currentFilters = {
    search: '',
    category: 'All',
    status: 'All',
    severity: 'All',
    userId: user ? user.id : 'user-citizen-1'
  };

  async function loadDashboard() {
    const stats = await db.getDashboardStats('citizen', user ? user.id : null);
    const reports = await db.getAllReports(currentFilters);

    container.innerHTML = `
      <div class="container section-sm">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div class="section-tag" style="margin-bottom: 0.5rem;">
              <i class="fa-solid fa-user-check"></i> Citizen Grievance Portal
            </div>
            <h1 style="font-size: 2rem; margin: 0;">Welcome Back, ${userName}</h1>
            <p style="color: var(--neutral-500); font-size: 0.95rem; margin-top: 0.25rem;">
              Manage your submitted civic issues, track field inspection progress, and receive instant updates.
            </p>
          </div>

          <button type="button" id="btn-dash-new-report" class="btn btn-primary btn-lg">
            <i class="fa-solid fa-camera"></i> Report New Issue
          </button>
        </div>

        <!-- 5 Stats Counters -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon-total">
              <i class="fa-solid fa-folder-open"></i>
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Reports</span>
              <span class="stat-value">${stats.total}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-submitted">
              <i class="fa-solid fa-inbox"></i>
            </div>
            <div class="stat-info">
              <span class="stat-label">Submitted</span>
              <span class="stat-value">${stats.submitted}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-review">
              <i class="fa-solid fa-magnifying-glass"></i>
            </div>
            <div class="stat-info">
              <span class="stat-label">Under Review</span>
              <span class="stat-value">${stats.underReview}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-progress">
              <i class="fa-solid fa-person-digging"></i>
            </div>
            <div class="stat-info">
              <span class="stat-label">In Progress</span>
              <span class="stat-value">${stats.inProgress}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-resolved">
              <i class="fa-solid fa-circle-check"></i>
            </div>
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
                id="dash-search-input" 
                class="form-control" 
                placeholder="Search by Report ID, Issue, or Location..." 
                value="${currentFilters.search}" 
              />
            </div>
          </div>

          <div class="filter-row-chips">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--neutral-500); text-transform: uppercase;">
              Filters:
            </span>

            <select id="filter-category" class="filter-select">
              <option value="All">All Categories (9)</option>
              ${Object.keys(CIVIC_TAXONOMY).map(c => `
                <option value="${c}" ${currentFilters.category === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>

            <select id="filter-status" class="filter-select">
              <option value="All">All Statuses</option>
              ${STATUS_FLOW.map(s => `
                <option value="${s}" ${currentFilters.status === s ? 'selected' : ''}>${s}</option>
              `).join('')}
            </select>

            <select id="filter-severity" class="filter-select">
              <option value="All">All Severities</option>
              ${SEVERITY_LEVELS.map(sev => `
                <option value="${sev}" ${currentFilters.severity === sev ? 'selected' : ''}>${sev} Severity</option>
              `).join('')}
            </select>

            ${(currentFilters.search || currentFilters.category !== 'All' || currentFilters.status !== 'All' || currentFilters.severity !== 'All') ? `
              <button type="button" id="btn-clear-filters" class="btn btn-outline btn-sm" style="color: var(--color-critical);">
                <i class="fa-solid fa-xmark"></i> Clear Filters
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Reports List / Grid -->
        ${reports.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">
              <i class="fa-solid fa-folder-open" style="font-size: 2rem;"></i>
            </div>
            <h3>No Reports Found</h3>
            <p>You haven't reported any civic issues matching these filters.</p>
            <button type="button" id="btn-empty-new-report" class="btn btn-primary">
              <i class="fa-solid fa-camera"></i> Report an Issue
            </button>
          </div>
        ` : `
          <div class="report-cards-grid">
            ${reports.map(rep => `
              <div class="report-card">
                <div class="report-card-img-wrapper">
                  <img src="${rep.image_url}" alt="Report Photo" class="report-card-img" />
                  <div class="report-card-badge-overlay">
                    <span class="badge badge-status-${rep.status.toLowerCase().replace(/\s+/g, '-')}">${rep.status}</span>
                    <span class="badge badge-severity-${rep.severity.toLowerCase()}">${rep.severity}</span>
                  </div>
                </div>

                <div class="report-card-body">
                  <div class="report-card-id">${rep.report_id} &bull; ${new Date(rep.created_at).toLocaleDateString()}</div>
                  <h3 class="report-card-title">${rep.title}</h3>
                  
                  <div class="report-card-location">
                    <i class="fa-solid fa-location-dot" style="color: var(--color-critical);"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${rep.location}</span>
                  </div>

                  ${rep.ai_confidence ? `
                    <div style="font-size: 0.775rem; color: var(--primary-700); background: var(--primary-50); padding: 4px 8px; border-radius: 4px; margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                      <span><i class="fa-solid fa-microchip"></i> AI Vision Diagnostic</span>
                      <strong>${rep.ai_confidence}% Match</strong>
                    </div>
                  ` : ''}

                  <div class="report-card-footer">
                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--neutral-600);"><i class="fa-solid ${CIVIC_TAXONOMY[rep.category]?.icon || 'fa-tag'}"></i> ${rep.category}</span>
                    <button type="button" class="btn btn-outline btn-sm btn-track-card" data-report-id="${rep.report_id}">
                      Track Status &rarr;
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}

      </div>
    `;

    // Attach Event Listeners
    document.getElementById('btn-dash-new-report')?.addEventListener('click', () => navigateTo('report'));
    document.getElementById('btn-empty-new-report')?.addEventListener('click', () => navigateTo('report'));

    container.querySelectorAll('.btn-track-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.reportId;
        navigateTo('track', { reportId: id });
      });
    });

    // Search and Filter Listeners
    const searchInp = document.getElementById('dash-search-input');
    searchInp?.addEventListener('input', debounce((e) => {
      currentFilters.search = e.target.value.trim();
      loadDashboard();
    }, 300));

    document.getElementById('filter-category')?.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      loadDashboard();
    });

    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      loadDashboard();
    });

    document.getElementById('filter-severity')?.addEventListener('change', (e) => {
      currentFilters.severity = e.target.value;
      loadDashboard();
    });

    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      currentFilters = { search: '', category: 'All', status: 'All', severity: 'All', userId: user ? user.id : 'user-citizen-1' };
      loadDashboard();
    });
  }

  // Realtime subscription listener
  const unsubscribeUpdate = dbEvents.on('reportUpdated', () => loadDashboard());
  const unsubscribeCreate = dbEvents.on('reportCreated', () => loadDashboard());

  await loadDashboard();
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
