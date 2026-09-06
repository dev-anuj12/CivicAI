/**
 * CIVICAI: Master Super Administrator Command Center
 * Root Security Gate, Granular Admin Permission Management & User Directory
 */

import { auth, ROLES, SecurityUtils } from '../auth-service.js';
import { db } from '../storage-db.js';
import { CIVIC_TAXONOMY } from '../config.js';
import { notificationService } from '../notification-service.js';

export async function renderSuperAdmin(container, navigateTo) {
  // If not Super Admin, show Master Security PIN Barrier
  if (!auth.isSuperAdmin()) {
    renderSecurityGate(container, navigateTo);
    return;
  }

  renderSuperAdminDashboard(container, navigateTo);
}

/**
 * High-Security Master Barrier Dialog
 */
function renderSecurityGate(container, navigateTo) {
  container.innerHTML = `
    <div class="container section-sm" style="max-width: 520px;">
      <div class="card" style="border: 2px solid var(--neutral-800); box-shadow: var(--shadow-xl); padding: 2.5rem; text-align: center;">
        
        <div style="width: 72px; height: 72px; border-radius: var(--radius-full); background: #0f172a; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.5rem auto; box-shadow: 0 4px 15px rgba(15,23,42,0.3);">
          <i class="fa-solid fa-key"></i>
        </div>

        <div class="section-tag" style="background: #fef3c7; color: #b45309; border-color: #fde68a; margin-bottom: 0.75rem;">
          <i class="fa-solid fa-shield-halved"></i> Restricted Master Access
        </div>

        <h2 style="font-size: 1.6rem; color: var(--neutral-950); margin-bottom: 0.5rem;">Super Admin Verification</h2>
        <p style="color: var(--neutral-600); font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5;">
          This command center manages platform permissions and user accounts. Enter the Master Security PIN or Root credentials to continue.
        </p>

        <form id="form-super-pin">
          <div class="form-group" style="text-align: left;">
            <label class="form-label form-label-required" for="super-pin-input">Master Security PIN / Root Passphrase</label>
            <input 
              type="password" 
              id="super-pin-input" 
              class="form-control mono" 
              placeholder="Enter PIN (e.g. 9900)" 
              required 
              style="font-size: 1.25rem; letter-spacing: 0.2em; text-align: center;"
              autofocus
            />
          </div>

          <div id="gate-error-msg" style="display: none; background: var(--color-critical-bg); color: var(--color-critical); border: 1px solid var(--color-critical-border); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1.25rem;"></div>

          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; background: #0f172a; border-color: #0f172a;">
            <i class="fa-solid fa-unlock-keyhole"></i> Unlock Super Admin Center
          </button>
        </form>

        <div style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--neutral-400);">
          Default Emergency Master PIN: <code>9900</code>
        </div>
      </div>
    </div>
  `;

  document.getElementById('form-super-pin')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('super-pin-input')?.value.trim();
    const errorEl = document.getElementById('gate-error-msg');

    try {
      auth.verifyMasterAccess(pin);
      notificationService.showToast('Root Access Granted', 'Authenticated as Master Super Administrator.', 'success');
      renderSuperAdminDashboard(container, navigateTo);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    }
  });
}

/**
 * Super Admin Management Dashboard
 */
function renderSuperAdminDashboard(container, navigateTo) {
  const users = auth.getAllUsers();
  const reportsCount = JSON.parse(localStorage.getItem('civicai_reports_data') || '[]').length;
  const adminUsers = users.filter(u => u.role === ROLES.AUTHORITY || u.role === ROLES.ADMIN || u.role === ROLES.SUPER_ADMIN);
  const citizenUsers = users.filter(u => u.role === ROLES.CITIZEN);

  container.innerHTML = `
    <div class="container section-sm">
      
      <!-- Super Admin Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div class="section-tag" style="background: #0f172a; color: #f59e0b; border-color: #334155; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-crown" style="color: #f59e0b;"></i> Master Super Administrator Portal
          </div>
          <h1 style="font-size: 2.25rem; margin: 0;">Platform Governance & Permission Hub</h1>
          <p style="color: var(--neutral-500); font-size: 0.95rem; margin-top: 0.25rem;">
            Root Access Active &bull; Manage authorized admin permissions, citizen accounts, and security policies.
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button type="button" id="btn-create-admin" class="btn btn-primary">
            <i class="fa-solid fa-user-shield"></i> Create New Admin
          </button>
          <button type="button" id="btn-super-exit" class="btn btn-outline" style="color: var(--color-critical);">
            <i class="fa-solid fa-lock"></i> Lock Root Access
          </button>
        </div>
      </div>

      <!-- System Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card">
          <div class="stat-icon" style="background: #0f172a; color: #f59e0b;"><i class="fa-solid fa-users"></i></div>
          <div class="stat-info">
            <span class="stat-label">Total Accounts</span>
            <span class="stat-value">${users.length}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #faf5ff; color: #7c3aed;"><i class="fa-solid fa-user-shield"></i></div>
          <div class="stat-info">
            <span class="stat-label">Authorized Admins</span>
            <span class="stat-value">${adminUsers.length}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #ecfdf5; color: #059669;"><i class="fa-solid fa-user"></i></div>
          <div class="stat-info">
            <span class="stat-label">Active Citizens</span>
            <span class="stat-value">${citizenUsers.length}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9ff; color: #0284c7;"><i class="fa-solid fa-file-shield"></i></div>
          <div class="stat-info">
            <span class="stat-label">Total Reports</span>
            <span class="stat-value">${reportsCount}</span>
          </div>
        </div>
      </div>

      <!-- Users & Admins Directory -->
      <div class="card" style="margin-top: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.25rem; margin-bottom: 0.25rem;">Authorized Accounts & Access Directory</h3>
            <p style="color: var(--neutral-500); font-size: 0.85rem; margin: 0;">Click "Edit Permissions" on any admin to grant or restrict capabilities.</p>
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <input type="text" id="super-search-users" class="form-control" placeholder="Search user name or email..." style="width: 260px;" />
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Assigned Department</th>
                <th>Permissions Summary</th>
                <th>Status</th>
                <th style="text-align: right;">Master Actions</th>
              </tr>
            </thead>
            <tbody id="super-users-tbody">
              ${renderUsersTableRows(users)}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- EDIT ADMIN PERMISSIONS MODAL -->
    <div id="edit-permission-modal" class="modal-backdrop">
      <div class="modal-content" style="max-width: 620px;">
        <div class="modal-header">
          <div>
            <span style="font-size: 0.775rem; font-weight: 700; color: #f59e0b; text-transform: uppercase;">
              <i class="fa-solid fa-crown"></i> Super Admin Governance
            </span>
            <h3 id="modal-edit-user-title" style="font-size: 1.25rem; margin: 0;">Edit Admin Permissions</h3>
          </div>
          <button type="button" class="modal-close" id="btn-close-perm-modal">
            <i class="fa-solid fa-xmark" style="font-size: 1.25rem;"></i>
          </button>
        </div>

        <div class="modal-body">
          <form id="form-edit-permissions">
            <input type="hidden" id="edit-user-id" />

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" id="edit-user-name" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" id="edit-user-email" class="form-control" required readonly style="background: var(--neutral-100);" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Account Role</label>
                <select id="edit-user-role" class="form-control">
                  <option value="citizen">Citizen</option>
                  <option value="authority">Municipal Authority Admin</option>
                  <option value="admin">Super Administrator (Full Root)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Account Status</label>
                <select id="edit-user-status" class="form-control">
                  <option value="active">Active (Granted Access)</option>
                  <option value="suspended">Suspended (Access Blocked)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Assigned Municipal Department</label>
              <select id="edit-user-department" class="form-control">
                <option value="">None (Standard Citizen)</option>
                ${Object.values(CIVIC_TAXONOMY).map(t => `
                  <option value="${t.department}">${t.department}</option>
                `).join('')}
                <option value="Central Municipal Governance Board">Central Municipal Governance Board</option>
              </select>
            </div>

            <!-- Granular Permissions Checkboxes -->
            <div style="background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); padding: 1.25rem; margin-top: 1.5rem;">
              <div style="font-weight: 700; font-size: 0.9rem; color: var(--neutral-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-sliders" style="color: #7c3aed;"></i> Granular Operational Permissions
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.875rem;">
                <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
                  <input type="checkbox" id="perm-manage-reports" style="width: 18px; height: 18px;" />
                  <span><strong>Manage Civic Reports:</strong> Triage, assign, and update resolution status across all 9 categories</span>
                </label>

                <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
                  <input type="checkbox" id="perm-manage-users" style="width: 18px; height: 18px;" />
                  <span><strong>Manage User Accounts:</strong> Ability to view and manage citizen accounts</span>
                </label>

                <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
                  <input type="checkbox" id="perm-ai-triage" style="width: 18px; height: 18px;" />
                  <span><strong>AI Decision Assistant:</strong> Execute AI action plan generator and automated citizen response drafting</span>
                </label>

                <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
                  <input type="checkbox" id="perm-escalate-sla" style="width: 18px; height: 18px;" />
                  <span><strong>Emergency SLA Escalation:</strong> Override deadlines and re-route emergency civic hazards</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" id="btn-cancel-perm-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-permissions" style="background: #0f172a; border-color: #0f172a;">
            <i class="fa-solid fa-floppy-disk"></i> Save Permissions & Audit Log
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach Table Handlers
  attachUserDirectoryEvents(container, navigateTo);
}

function renderUsersTableRows(users) {
  return users.map(u => {
    const isRoot = u.role === ROLES.SUPER_ADMIN;
    const perms = u.permissions || {};
    const permsList = [];
    if (perms.manage_reports) permsList.push('Reports');
    if (perms.manage_users) permsList.push('Users');
    if (perms.ai_triage) permsList.push('AI Triage');
    if (perms.escalate_sla) permsList.push('SLA Escalation');

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--neutral-900); display: flex; align-items: center; gap: 0.4rem;">
            ${u.full_name}
            ${isRoot ? '<i class="fa-solid fa-crown" style="color: #f59e0b; font-size: 0.8rem;" title="Root Super Admin"></i>' : ''}
          </div>
          <div style="font-size: 0.8rem; color: var(--neutral-500);">${u.email}</div>
        </td>
        <td>
          <span class="badge ${isRoot ? 'badge-status-assigned' : (u.role === ROLES.AUTHORITY ? 'badge-status-in-progress' : 'badge-status-submitted')}">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td style="font-size: 0.85rem; color: var(--neutral-700);">
          ${u.department || '<span style="color: var(--neutral-400);">Citizen Account</span>'}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${permsList.length > 0 ? permsList.map(p => `<span class="badge" style="background: var(--neutral-100); font-size: 0.7rem; border: 1px solid var(--neutral-200);">${p}</span>`).join('') : '<span style="color: var(--neutral-400); font-size: 0.75rem;">Standard</span>'}
          </div>
        </td>
        <td>
          <span class="badge ${u.status === 'suspended' ? 'badge-status-rejected' : 'badge-status-resolved'}">
            ${u.status === 'suspended' ? 'Suspended' : 'Active'}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-outline btn-sm btn-edit-user-perms" data-user-id="${u.id || u.user_id}">
            <i class="fa-solid fa-user-pen"></i> Edit Permissions
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function attachUserDirectoryEvents(container, navigateTo) {
  const modal = document.getElementById('edit-permission-modal');
  const closeModal = () => modal?.classList.remove('open');

  document.getElementById('btn-close-perm-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-perm-modal')?.addEventListener('click', closeModal);

  document.getElementById('btn-super-exit')?.addEventListener('click', async () => {
    await auth.signOut();
    notificationService.showToast('Super Admin Locked', 'Root session terminated safely.', 'info');
    navigateTo('home');
  });

  // Search filter
  document.getElementById('super-search-users')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const allUsers = auth.getAllUsers();
    const filtered = allUsers.filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
    const tbody = document.getElementById('super-users-tbody');
    if (tbody) tbody.innerHTML = renderUsersTableRows(filtered);
    attachRowClicks(container, navigateTo);
  });

  // Create New Admin Quick Button
  document.getElementById('btn-create-admin')?.addEventListener('click', () => {
    const newEmail = prompt('Enter New Admin Email Address:');
    if (!newEmail || !SecurityUtils.isValidEmail(newEmail)) {
      if (newEmail) alert('Invalid email format.');
      return;
    }
    const newName = prompt('Enter Admin Full Name:') || 'Municipal Admin';
    const dept = prompt('Enter Department Name:') || 'Municipal Public Works & Grievance Cell';

    auth.signUp(newName, newEmail, 'Admin@2026', '', ROLES.AUTHORITY, dept).then(() => {
      notificationService.showToast('Admin Created', `Account created for ${newEmail} with default password 'Admin@2026'`, 'success');
      renderSuperAdminDashboard(container, navigateTo);
    }).catch(err => {
      alert(err.message);
    });
  });

  attachRowClicks(container, navigateTo);
}

function attachRowClicks(container, navigateTo) {
  const modal = document.getElementById('edit-permission-modal');

  container.querySelectorAll('.btn-edit-user-perms').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.userId;
      const allUsers = auth.getAllUsers();
      const user = allUsers.find(u => u.id === uid || u.user_id === uid);
      if (!user) return;

      document.getElementById('edit-user-id').value = user.id || user.user_id;
      document.getElementById('edit-user-name').value = user.full_name;
      document.getElementById('edit-user-email').value = user.email;
      document.getElementById('edit-user-role').value = user.role;
      document.getElementById('edit-user-status').value = user.status || 'active';
      document.getElementById('edit-user-department').value = user.department || '';

      const perms = user.permissions || {};
      document.getElementById('perm-manage-reports').checked = !!perms.manage_reports;
      document.getElementById('perm-manage-users').checked = !!perms.manage_users;
      document.getElementById('perm-ai-triage').checked = !!perms.ai_triage;
      document.getElementById('perm-escalate-sla').checked = !!perms.escalate_sla;

      document.getElementById('modal-edit-user-title').textContent = `Edit Permissions: ${user.full_name}`;
      modal?.classList.add('open');
    });
  });

  document.getElementById('btn-save-permissions')?.addEventListener('click', () => {
    const uid = document.getElementById('edit-user-id')?.value;
    const fullName = document.getElementById('edit-user-name')?.value.trim();
    const role = document.getElementById('edit-user-role')?.value;
    const status = document.getElementById('edit-user-status')?.value;
    const department = document.getElementById('edit-user-department')?.value;

    const permissions = {
      manage_reports: document.getElementById('perm-manage-reports')?.checked || false,
      manage_users: document.getElementById('perm-manage-users')?.checked || false,
      ai_triage: document.getElementById('perm-ai-triage')?.checked || false,
      escalate_sla: document.getElementById('perm-escalate-sla')?.checked || false
    };

    try {
      auth.updateUserBySuperAdmin(uid, {
        full_name: fullName,
        role,
        status,
        department,
        permissions
      });

      notificationService.showToast('Permissions Updated', `Permissions saved for ${fullName}.`, 'success');
      document.getElementById('edit-permission-modal')?.classList.remove('open');
      renderSuperAdminDashboard(container, navigateTo);
    } catch (err) {
      alert(err.message);
    }
  });
}
