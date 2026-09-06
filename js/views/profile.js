/**
 * CIVICAI: User Profile & Cloud / AI Configuration View
 */

import { auth, ROLES } from '../auth-service.js';
import { db } from '../storage-db.js';
import { CONFIG } from '../config.js';
import { notificationService } from '../notification-service.js';

export async function renderProfile(container, navigateTo) {
  const user = auth.getUser();
  const isSuper = auth.isSuperAdmin();
  const isAuth = auth.isAuthority();
  const stats = await db.getDashboardStats('citizen', user ? user.id : null);

  container.innerHTML = `
    <div class="container section-sm" style="max-width: 780px;">
      
      <!-- Profile Header Card -->
      <div class="card" style="margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
          <div style="width: 72px; height: 72px; border-radius: var(--radius-full); background: ${isSuper ? '#0f172a' : (isAuth ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)')}; color: ${isSuper ? '#f59e0b' : 'white'}; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);">
            ${isSuper ? '<i class="fa-solid fa-crown"></i>' : (user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'C')}
          </div>

          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.5rem; margin: 0;">${user?.full_name || 'Citizen User'}</h2>
              <span class="badge ${isSuper ? 'badge-status-assigned' : (isAuth ? 'badge-status-in-progress' : 'badge-status-resolved')}">
                <i class="fa-solid ${isSuper ? 'fa-crown' : (isAuth ? 'fa-shield-halved' : 'fa-user')}"></i>
                ${isSuper ? 'Super Administrator' : (isAuth ? 'Municipal Admin' : 'Citizen')}
              </span>
            </div>

            <div style="font-size: 0.875rem; color: var(--neutral-500); display: flex; gap: 1rem; flex-wrap: wrap;">
              <span><i class="fa-regular fa-envelope"></i> ${user?.email || 'citizen@civicai.org'}</span>
              <span><i class="fa-solid fa-phone"></i> ${user?.phone || '+91 98765 43210'}</span>
              ${user?.department ? `<span><i class="fa-solid fa-building-columns"></i> ${user.department}</span>` : ''}
            </div>
          </div>

          <button type="button" id="btn-profile-signout" class="btn btn-outline btn-sm" style="color: var(--color-critical); border-color: var(--color-critical-border);">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>

        <!-- Role Quick Switcher / Access Gate -->
        <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--neutral-100); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="font-size: 0.85rem; color: var(--neutral-600);">
            <strong>Access Level Switcher:</strong> Toggle perspectives or access Super Admin Root.
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" id="btn-switch-citizen" class="btn btn-sm ${!isAuth && !isSuper ? 'btn-primary' : 'btn-outline'}">
              <i class="fa-solid fa-user"></i> Citizen View
            </button>
            <button type="button" id="btn-switch-authority" class="btn btn-sm ${isAuth && !isSuper ? 'btn-primary' : 'btn-outline'}">
              <i class="fa-solid fa-shield-halved"></i> Admin View
            </button>
            <button type="button" id="btn-switch-superadmin" class="btn btn-sm ${isSuper ? 'btn-primary' : 'btn-outline'}" style="${isSuper ? 'background: #0f172a; border-color: #0f172a; color: #f59e0b;' : 'border-color: #f59e0b; color: #b45309;'}">
              <i class="fa-solid fa-crown"></i> Super Admin Gate
            </button>
          </div>
        </div>
      </div>

      <!-- Active Permissions Card (If Admin or Super Admin) -->
      ${(isAuth || isSuper) ? `
        <div class="card" style="margin-bottom: 2rem; border-left: 4px solid #7c3aed;">
          <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem; color: var(--neutral-900); display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-key" style="color: #7c3aed;"></i> Granted Administrative Permissions
          </h3>
          <p style="font-size: 0.85rem; color: var(--neutral-500); margin-bottom: 1rem;">
            Permissions assigned to this account by the Chief Super Administrator.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid ${auth.hasPermission('manage_reports') ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${auth.hasPermission('manage_reports') ? 'var(--color-success)' : 'var(--neutral-400)'};"></i>
              <span>Manage Civic Reports</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid ${auth.hasPermission('manage_users') ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${auth.hasPermission('manage_users') ? 'var(--color-success)' : 'var(--neutral-400)'};"></i>
              <span>Manage User Accounts</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid ${auth.hasPermission('ai_triage') ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${auth.hasPermission('ai_triage') ? 'var(--color-success)' : 'var(--neutral-400)'};"></i>
              <span>AI Triage & Action Plan</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid ${auth.hasPermission('escalate_sla') ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${auth.hasPermission('escalate_sla') ? 'var(--color-success)' : 'var(--neutral-400)'};"></i>
              <span>Emergency SLA Escalation</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Cloud Backend & Gemini AI Configuration Card -->
      <div class="card">
        <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-sliders" style="color: var(--primary-600);"></i> Cloud & AI Integration Settings
        </h3>
        <p style="color: var(--neutral-500); font-size: 0.875rem; margin-bottom: 1.5rem;">
          Configure your Google Gemini Multimodal Vision API key or Supabase credentials.
        </p>

        <form id="form-settings">
          <div class="form-group">
            <label class="form-label" for="settings-gemini-key">
              <span>Google Gemini Vision API Key</span>
              <span class="form-hint">Optional (Deep Edge Vision active as default)</span>
            </label>
            <input 
              type="password" 
              id="settings-gemini-key" 
              class="form-control mono" 
              placeholder="AIzaSy..." 
              value="${localStorage.getItem('civicai_gemini_api_key') || ''}" 
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="settings-sb-url">Supabase Project URL</label>
              <input 
                type="text" 
                id="settings-sb-url" 
                class="form-control mono" 
                placeholder="https://xyzcompany.supabase.co" 
                value="${localStorage.getItem('civicai_supabase_url') || ''}" 
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="settings-sb-key">Supabase Anon Key</label>
              <input 
                type="password" 
                id="settings-sb-key" 
                class="form-control mono" 
                placeholder="eyJhbGciOiJIUzI1Ni..." 
                value="${localStorage.getItem('civicai_supabase_anon_key') || ''}" 
              />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary">
              <i class="fa-solid fa-floppy-disk"></i> Save Cloud Settings
            </button>
          </div>
        </form>
      </div>

    </div>
  `;

  // Handlers
  document.getElementById('btn-profile-signout')?.addEventListener('click', async () => {
    await auth.signOut();
    notificationService.showToast('Signed Out', 'You have been safely signed out.', 'info');
    navigateTo('home');
  });

  document.getElementById('btn-switch-citizen')?.addEventListener('click', async () => {
    await auth.switchRole(ROLES.CITIZEN);
    notificationService.showToast('Switched to Citizen', 'Now viewing as Citizen.', 'info');
    renderProfile(container, navigateTo);
  });

  document.getElementById('btn-switch-authority')?.addEventListener('click', async () => {
    await auth.switchRole(ROLES.AUTHORITY);
    notificationService.showToast('Switched to Admin', 'Now viewing as Municipal Administrator.', 'info');
    renderProfile(container, navigateTo);
  });

  document.getElementById('btn-switch-superadmin')?.addEventListener('click', () => {
    navigateTo('super-admin');
  });

  document.getElementById('form-settings')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const geminiKey = document.getElementById('settings-gemini-key')?.value.trim();
    const sbUrl = document.getElementById('settings-sb-url')?.value.trim();
    const sbKey = document.getElementById('settings-sb-key')?.value.trim();

    if (geminiKey) localStorage.setItem('civicai_gemini_api_key', geminiKey);
    else localStorage.removeItem('civicai_gemini_api_key');

    if (sbUrl) localStorage.setItem('civicai_supabase_url', sbUrl);
    else localStorage.removeItem('civicai_supabase_url');

    if (sbKey) localStorage.setItem('civicai_supabase_anon_key', sbKey);
    else localStorage.removeItem('civicai_supabase_anon_key');

    notificationService.showToast('Settings Saved', 'Cloud and AI configurations updated.', 'success');
  });
}
