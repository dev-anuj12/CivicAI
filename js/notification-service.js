/**
 * CIVICAI: Notification and Toast Alert System
 */

import { db, dbEvents } from './storage-db.js';
import { auth } from './auth-service.js';

class NotificationService {
  constructor() {
    this.unreadCount = 0;
    this.notifications = [];
    this.init();
  }

  async init() {
    await this.refresh();
    dbEvents.on('notificationAdded', (notif) => {
      this.notifications.unshift(notif);
      this.unreadCount++;
      this.renderBadge();
      this.showToast(notif.title, notif.message, 'info');
    });

    dbEvents.on('reportCreated', (rep) => {
      this.showToast('Report Registered', `Report ${rep.report_id} has been submitted.`, 'success');
    });

    dbEvents.on('reportUpdated', (rep) => {
      this.showToast('Status Update', `Report ${rep.report_id} updated to ${rep.status}`, 'info');
    });
  }

  async refresh() {
    const user = auth.getUser();
    this.notifications = await db.getNotifications(user ? user.id : null);
    this.unreadCount = this.notifications.filter(n => !n.is_read).length;
    this.renderBadge();
  }

  renderBadge() {
    const badgeEl = document.getElementById('notif-badge-count');
    if (!badgeEl) return;
    if (this.unreadCount > 0) {
      badgeEl.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      badgeEl.style.display = 'flex';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  renderDropdown() {
    const listEl = document.getElementById('notif-dropdown-list');
    if (!listEl) return;

    if (this.notifications.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--neutral-400);">
          <i class="fa-regular fa-bell-slash" style="font-size: 24px; margin-bottom: 0.5rem; display: block;"></i>
          <p style="font-size: 0.85rem; margin: 0;">You're all caught up.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.notifications.map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}" data-notif-id="${n.id}">
        <div class="notif-item-title">${this.escapeHTML(n.title)}</div>
        <div class="notif-item-desc">${this.escapeHTML(n.message)}</div>
        <div class="notif-item-time">${this.formatTime(n.created_at)}</div>
      </div>
    `).join('');

    // Attach click events
    listEl.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.notifId;
        await db.markNotificationAsRead(id);
        el.classList.remove('unread');
        await this.refresh();
      });
    });
  }

  showToast(title, message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}" style="font-size: 1.25rem; margin-top: 2px;"></i>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.15rem; color: var(--neutral-900);">${this.escapeHTML(title)}</div>
        <div style="font-size: 0.825rem; color: var(--neutral-600);">${this.escapeHTML(message)}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

export const notificationService = new NotificationService();
