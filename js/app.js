/**
 * CIVICAI: Central Application Orchestrator & SPA Router
 * "One Platform. Every Civic Issue."
 */

import { auth, ROLES } from './auth-service.js';
import { dbEvents } from './storage-db.js';
import { notificationService } from './notification-service.js';

// View Renderers
import { renderHome } from './views/home.js';
import { renderReport } from './views/report.js';
import { renderTrack } from './views/track.js';
import { renderCitizenDash } from './views/citizen-dash.js';
import { renderAuthorityDash } from './views/authority-dash.js';
import { renderSuperAdmin } from './views/super-admin.js';
import { renderProfile } from './views/profile.js';
import { renderAbout } from './views/about.js';

class CivicAIApp {
  constructor() {
    this.currentView = 'home';
    this.currentParams = {};
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupAuthModal();
    this.setupNotificationDropdown();
    this.setupGlobalEvents();

    // Handle initial route based on hash
    window.addEventListener('hashchange', () => this.handleHashRoute());
    this.handleHashRoute();
  }

  handleHashRoute() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const parts = hash.split('?');
    const view = parts[0] || 'home';
    const params = {};
    
    if (parts[1]) {
      const urlParams = new URLSearchParams(parts[1]);
      for (const [key, value] of urlParams) {
        params[key] = value;
      }
    }

    this.navigateTo(view, params, false);
  }

  navigateTo(view, params = {}, updateHash = true) {
    this.currentView = view;
    this.currentParams = params;

    if (updateHash) {
      let hash = `#${view}`;
      const queryParts = [];
      for (const [key, val] of Object.entries(params)) {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
      if (queryParts.length > 0) hash += `?${queryParts.join('&')}`;
      window.location.hash = hash;
    }

    this.updateNavState();
    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile menu if open
    document.getElementById('nav-menu')?.classList.remove('open');
  }

  async renderCurrentView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    switch (this.currentView) {
      case 'home':
        await renderHome(container, (v, p) => this.navigateTo(v, p));
        break;
      case 'report':
        await renderReport(container, (v, p) => this.navigateTo(v, p), this.currentParams);
        break;
      case 'track':
        await renderTrack(container, (v, p) => this.navigateTo(v, p), this.currentParams);
        break;
      case 'citizen-dash':
      case 'my-reports':
        await renderCitizenDash(container, (v, p) => this.navigateTo(v, p));
        break;
      case 'authority-dash':
      case 'authority':
      case 'admin':
        await renderAuthorityDash(container, (v, p) => this.navigateTo(v, p));
        break;
      case 'super-admin':
      case 'root':
        await renderSuperAdmin(container, (v, p) => this.navigateTo(v, p));
        break;
      case 'profile':
        await renderProfile(container, (v, p) => this.navigateTo(v, p));
        break;
      case 'about':
      case 'how-it-works':
        await renderAbout(container, (v, p) => this.navigateTo(v, p));
        break;
      default:
        await renderHome(container, (v, p) => this.navigateTo(v, p));
    }
  }

  setupNavigation() {
    // Mobile Hamburger
    const mobileToggle = document.getElementById('mobile-toggle');
    const navMenu = document.getElementById('nav-menu');
    mobileToggle?.addEventListener('click', () => {
      navMenu?.classList.toggle('open');
    });

    // Nav Links delegation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-navigate]');
      if (link) {
        e.preventDefault();
        const targetView = link.dataset.navigate;
        this.navigateTo(targetView);
      }
    });

    // Logo Click -> Home
    document.getElementById('brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigateTo('home');
    });

    // Auth Action Buttons
    document.getElementById('btn-nav-login')?.addEventListener('click', () => {
      this.openAuthModal('signin');
    });

    document.getElementById('btn-nav-signup')?.addEventListener('click', () => {
      this.openAuthModal('signup');
    });

    this.updateNavState();
  }

  updateNavState() {
    const user = auth.getUser();
    const isAuth = auth.isAuthority();
    const isSuper = auth.isSuperAdmin();

    // Nav Links Active state
    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.dataset.navigate;
      link.classList.toggle('active', target === this.currentView);
    });

    // Auth Navigation state
    const authActions = document.getElementById('nav-auth-actions');
    const userActions = document.getElementById('nav-user-actions');
    const userAvatarName = document.getElementById('nav-user-name');
    const userRoleBadge = document.getElementById('nav-user-role');
    const authorityNavTab = document.getElementById('nav-authority-tab');
    const superAdminNavTab = document.getElementById('nav-superadmin-tab');

    if (user) {
      if (authActions) authActions.style.display = 'none';
      if (userActions) userActions.style.display = 'flex';
      if (userAvatarName) userAvatarName.textContent = user.full_name ? user.full_name.split(' ')[0] : 'User';
      if (userRoleBadge) {
        userRoleBadge.textContent = isSuper ? 'Super Admin' : (isAuth ? 'Admin Officer' : 'Citizen');
      }
      if (authorityNavTab) authorityNavTab.style.display = isAuth ? 'inline-block' : 'none';
      if (superAdminNavTab) superAdminNavTab.style.display = isSuper ? 'inline-block' : 'none';
    } else {
      if (authActions) authActions.style.display = 'flex';
      if (userActions) userActions.style.display = 'none';
      if (authorityNavTab) authorityNavTab.style.display = 'none';
      if (superAdminNavTab) superAdminNavTab.style.display = 'none';
    }
  }

  setupNotificationDropdown() {
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');

    bellBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('open');
      if (dropdown?.classList.contains('open')) {
        notificationService.renderDropdown();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notif-wrapper')) {
        dropdown?.classList.remove('open');
      }
    });
  }

  setupAuthModal() {
    const modalBackdrop = document.getElementById('auth-modal');
    const signinForm = document.getElementById('form-signin');
    const signupForm = document.getElementById('form-signup');
    const tabSignin = document.getElementById('tab-auth-signin');
    const tabSignup = document.getElementById('tab-auth-signup');
    const authError = document.getElementById('auth-error-msg');

    const switchAuthTab = (tab) => {
      if (authError) authError.style.display = 'none';
      if (tab === 'signin') {
        tabSignin?.classList.add('active');
        tabSignup?.classList.remove('active');
        signinForm?.classList.remove('hidden');
        signupForm?.classList.add('hidden');
      } else {
        tabSignup?.classList.add('active');
        tabSignin?.classList.remove('active');
        signupForm?.classList.remove('hidden');
        signinForm?.classList.add('hidden');
      }
    };

    tabSignin?.addEventListener('click', () => switchAuthTab('signin'));
    tabSignup?.addEventListener('click', () => switchAuthTab('signup'));

    // Close buttons
    const closeModal = () => modalBackdrop?.classList.remove('open');
    document.getElementById('btn-close-auth-modal')?.addEventListener('click', closeModal);

    // Sign In Submit
    signinForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email')?.value.trim();
      const pass = document.getElementById('signin-password')?.value;

      try {
        await auth.signIn(email, pass);
        notificationService.showToast('Security Verified', 'Signed in successfully with 256-bit encrypted session.', 'success');
        closeModal();
        this.updateNavState();
        if (auth.isSuperAdmin()) this.navigateTo('super-admin');
        else if (auth.isAuthority()) this.navigateTo('authority-dash');
        else this.navigateTo('citizen-dash');
      } catch (err) {
        if (authError) {
          authError.textContent = err.message;
          authError.style.display = 'block';
        }
      }
    });

    // Sign Up Submit
    signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('signup-fullname')?.value.trim();
      const email = document.getElementById('signup-email')?.value.trim();
      const phone = document.getElementById('signup-phone')?.value.trim();
      const pass = document.getElementById('signup-password')?.value;
      const role = document.getElementById('signup-role')?.value;

      try {
        await auth.signUp(fullName, email, pass, phone, role);
        notificationService.showToast('Account Protected', 'Account registered with secure authentication credentials.', 'success');
        closeModal();
        this.updateNavState();
        if (role === ROLES.AUTHORITY) this.navigateTo('authority-dash');
        else this.navigateTo('citizen-dash');
      } catch (err) {
        if (authError) {
          authError.textContent = err.message;
          authError.style.display = 'block';
        }
      }
    });

    // Password strength meter
    document.getElementById('signup-password')?.addEventListener('input', (e) => {
      const strength = auth.constructor.checkPasswordStrength(e.target.value);
      const meter = document.getElementById('password-strength-meter');
      const text = document.getElementById('password-strength-text');
      if (meter) {
        meter.style.width = `${strength.score}%`;
        meter.style.backgroundColor = strength.color;
      }
      if (text) {
        text.textContent = `Strength: ${strength.text}`;
        text.style.color = strength.color;
      }
    });
  }

  openAuthModal(defaultTab = 'signin') {
    const modalBackdrop = document.getElementById('auth-modal');
    const tabSignin = document.getElementById('tab-auth-signin');
    const tabSignup = document.getElementById('tab-auth-signup');
    const signinForm = document.getElementById('form-signin');
    const signupForm = document.getElementById('form-signup');
    const authError = document.getElementById('auth-error-msg');

    if (authError) authError.style.display = 'none';

    if (defaultTab === 'signin') {
      tabSignin?.classList.add('active');
      tabSignup?.classList.remove('active');
      signinForm?.classList.remove('hidden');
      signupForm?.classList.add('hidden');
    } else {
      tabSignup?.classList.add('active');
      tabSignin?.classList.remove('active');
      signupForm?.classList.remove('hidden');
      signinForm?.classList.add('hidden');
    }

    modalBackdrop?.classList.add('open');
  }

  setupGlobalEvents() {
    dbEvents.on('authChanged', () => {
      this.updateNavState();
      this.renderCurrentView();
    });
    dbEvents.on('usersUpdated', () => {
      this.updateNavState();
      if (this.currentView === 'super-admin') this.renderCurrentView();
    });
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.CivicAI = new CivicAIApp();
});
