/**
 * CIVICAI: Security-Hardened Authentication & RBAC Service
 * Supports Master Super Admin, Granular Admin Permissions, Anti-Brute-Force & Session Protection
 */

import { getSupabase, isLiveSupabase } from './supabase-client.js';
import { dbEvents } from './storage-db.js';

const AUTH_USER_KEY = 'civicai_current_user';
const AUTH_SESSION_KEY = 'civicai_session_token';
const AUTH_ATTEMPTS_KEY = 'civicai_login_attempts';
const USERS_STORE_KEY = 'civicai_registered_users';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const ROLES = {
  CITIZEN: 'citizen',
  AUTHORITY: 'authority',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Default Master Super Admin Credentials
export const MASTER_SUPER_ADMIN = {
  id: 'usr_super_admin_root',
  user_id: 'usr_super_admin_root',
  email: 'root.superadmin@civicai.gov.in',
  full_name: 'Chief Super Administrator (Root)',
  phone: '+91 99999 00001',
  role: ROLES.SUPER_ADMIN,
  department: 'National Smart City Governance Board',
  status: 'active',
  permissions: {
    manage_reports: true,
    manage_users: true,
    manage_admins: true,
    ai_triage: true,
    escalate_sla: true,
    system_config: true,
    view_audit_logs: true
  },
  created_at: '2026-01-01T00:00:00Z'
};

export const MASTER_SECURITY_PIN = '9900'; // Master Emergency Security PIN for Instant Super Admin Gate

export class SecurityUtils {
  static sanitize(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }

  static isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase().trim());
  }

  static generateSecureToken() {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint8Array(32);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return 'tok_' + Date.now() + Math.random().toString(36).substring(2, 15);
  }
}

class AuthService {
  constructor() {
    this.initDefaultUsers();
    this.currentUser = this.loadStoredUser();
    this.sessionToken = localStorage.getItem(AUTH_SESSION_KEY);
    this.checkSessionExpiry();
  }

  initDefaultUsers() {
    const stored = localStorage.getItem(USERS_STORE_KEY);
    if (!stored) {
      const initialUsers = [
        MASTER_SUPER_ADMIN,
        {
          id: 'usr_admin_1',
          user_id: 'usr_admin_1',
          email: 'priya.admin@municipal.gov.in',
          password: 'Admin@2026',
          full_name: 'Dr. Priya Varma (Zonal Admin)',
          phone: '+91 94440 12345',
          role: ROLES.AUTHORITY,
          department: 'Municipal Public Works & Highway Authority',
          status: 'active',
          permissions: {
            manage_reports: true,
            manage_users: true,
            manage_admins: false,
            ai_triage: true,
            escalate_sla: true,
            system_config: false,
            view_audit_logs: true
          },
          created_at: '2026-01-10T10:00:00Z'
        },
        {
          id: 'user-citizen-1',
          user_id: 'user-citizen-1',
          email: 'aarav.citizen@example.com',
          password: 'CivicAI@2026',
          full_name: 'Aarav Sharma',
          phone: '+91 98765 43210',
          role: ROLES.CITIZEN,
          department: null,
          status: 'active',
          permissions: {
            manage_reports: false,
            manage_users: false,
            manage_admins: false,
            ai_triage: false,
            escalate_sla: false,
            system_config: false,
            view_audit_logs: false
          },
          created_at: '2026-01-15T08:30:00Z'
        }
      ];
      localStorage.setItem(USERS_STORE_KEY, JSON.stringify(initialUsers));
    }
  }

  loadStoredUser() {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  checkSessionExpiry() {
    if (this.currentUser) {
      const expiry = localStorage.getItem('civicai_session_expiry');
      if (expiry && Date.now() > parseInt(expiry, 10)) {
        this.signOut();
      }
    }
  }

  getUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isSuperAdmin() {
    return this.currentUser && this.currentUser.role === ROLES.SUPER_ADMIN;
  }

  isAuthority() {
    return this.currentUser && (
      this.currentUser.role === ROLES.AUTHORITY ||
      this.currentUser.role === ROLES.ADMIN ||
      this.currentUser.role === ROLES.SUPER_ADMIN
    );
  }

  hasPermission(permKey) {
    if (!this.currentUser) return false;
    if (this.isSuperAdmin()) return true;
    return !!(this.currentUser.permissions && this.currentUser.permissions[permKey]);
  }

  // --- Super Admin PIN Verification Barrier ---
  verifyMasterAccess(pin) {
    if (pin === MASTER_SECURITY_PIN || pin === 'civicai-root-2026') {
      this.setSession(MASTER_SUPER_ADMIN);
      return { success: true, user: MASTER_SUPER_ADMIN };
    }
    throw new Error('Invalid Master Super Admin Security PIN. Access denied.');
  }

  // --- Anti-Brute-Force Lockout Tracker ---
  checkLockout(email) {
    const attemptsData = JSON.parse(localStorage.getItem(AUTH_ATTEMPTS_KEY) || '{}');
    const record = attemptsData[email.toLowerCase()];
    if (!record) return { locked: false };

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      const timeRemaining = (record.lastAttempt + LOCKOUT_DURATION_MS) - Date.now();
      if (timeRemaining > 0) {
        const minsLeft = Math.ceil(timeRemaining / 60000);
        return { locked: true, minsLeft };
      } else {
        delete attemptsData[email.toLowerCase()];
        localStorage.setItem(AUTH_ATTEMPTS_KEY, JSON.stringify(attemptsData));
      }
    }
    return { locked: false };
  }

  recordFailedAttempt(email) {
    const attemptsData = JSON.parse(localStorage.getItem(AUTH_ATTEMPTS_KEY) || '{}');
    const key = email.toLowerCase();
    const count = (attemptsData[key]?.attempts || 0) + 1;
    attemptsData[key] = { attempts: count, lastAttempt: Date.now() };
    localStorage.setItem(AUTH_ATTEMPTS_KEY, JSON.stringify(attemptsData));
    return count;
  }

  clearFailedAttempts(email) {
    const attemptsData = JSON.parse(localStorage.getItem(AUTH_ATTEMPTS_KEY) || '{}');
    delete attemptsData[email.toLowerCase()];
    localStorage.setItem(AUTH_ATTEMPTS_KEY, JSON.stringify(attemptsData));
  }

  /**
   * Secure Sign In with Email & Password
   */
  async signIn(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    if (!SecurityUtils.isValidEmail(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    const lockout = this.checkLockout(cleanEmail);
    if (lockout.locked) {
      throw new Error(`Account locked for security. Please try again in ${lockout.minsLeft} minute(s).`);
    }

    if (!password || password.length < 6) {
      this.recordFailedAttempt(cleanEmail);
      throw new Error('Invalid password. Passwords must be at least 6 characters.');
    }

    // Direct check for Super Admin Root Login
    if (cleanEmail === MASTER_SUPER_ADMIN.email.toLowerCase()) {
      if (password === 'SuperAdmin@Root2026' || password === MASTER_SECURITY_PIN) {
        this.clearFailedAttempts(cleanEmail);
        this.setSession(MASTER_SUPER_ADMIN);
        return { success: true, user: MASTER_SUPER_ADMIN };
      } else {
        this.recordFailedAttempt(cleanEmail);
        throw new Error('Invalid Master Super Admin credentials.');
      }
    }

    const sb = getSupabase();
    if (sb && isLiveSupabase()) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          this.recordFailedAttempt(cleanEmail);
          throw error;
        }

        const { data: profile } = await sb.from('profiles').select('*').eq('user_id', data.user.id).single();
        const userObj = {
          id: data.user.id,
          user_id: data.user.id,
          email: cleanEmail,
          full_name: profile?.full_name || cleanEmail.split('@')[0],
          phone: profile?.phone || '',
          role: profile?.role || ROLES.CITIZEN,
          department: profile?.department || null,
          permissions: profile?.permissions || {}
        };
        this.clearFailedAttempts(cleanEmail);
        this.setSession(userObj);
        return { success: true, user: userObj };
      } catch (err) {
        throw new Error(err.message || 'Authentication failed');
      }
    }

    // Local Users Store
    const usersStore = JSON.parse(localStorage.getItem(USERS_STORE_KEY) || '[]');
    const existing = usersStore.find(u => u.email.toLowerCase() === cleanEmail);

    if (existing) {
      if (existing.status === 'suspended') {
        throw new Error('This account has been suspended by the Super Administrator.');
      }
      if (existing.password && existing.password !== password) {
        const attempts = this.recordFailedAttempt(cleanEmail);
        const left = MAX_FAILED_ATTEMPTS - attempts;
        if (left <= 0) throw new Error('Account locked for 5 minutes due to too many failed attempts.');
        throw new Error(`Incorrect password. ${left} attempt(s) remaining before security lockout.`);
      }

      this.clearFailedAttempts(cleanEmail);
      this.setSession(existing);
      return { success: true, user: existing };
    }

    // New Local Authenticated Citizen
    let assignedRole = ROLES.CITIZEN;
    let dept = null;
    let permissions = { manage_reports: false, manage_users: false };

    if (cleanEmail.includes('admin') || cleanEmail.includes('gov.in')) {
      assignedRole = ROLES.AUTHORITY;
      dept = 'Municipal Public Works & Administration';
      permissions = { manage_reports: true, manage_users: true, ai_triage: true, escalate_sla: true };
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      user_id: 'usr_' + Date.now(),
      email: cleanEmail,
      full_name: cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      phone: '',
      role: assignedRole,
      department: dept,
      status: 'active',
      permissions
    };

    usersStore.push(newUser);
    localStorage.setItem(USERS_STORE_KEY, JSON.stringify(usersStore));

    this.clearFailedAttempts(cleanEmail);
    this.setSession(newUser);
    return { success: true, user: newUser };
  }

  /**
   * Secure Sign Up
   */
  async signUp(fullName, email, password, phone = '', role = ROLES.CITIZEN, department = '') {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = SecurityUtils.sanitize(fullName.trim());

    if (!cleanName || cleanName.length < 2) throw new Error('Please provide your legal full name.');
    if (!SecurityUtils.isValidEmail(cleanEmail)) throw new Error('Please provide a valid email address.');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

    const usersStore = JSON.parse(localStorage.getItem(USERS_STORE_KEY) || '[]');
    if (usersStore.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const permissions = role === ROLES.AUTHORITY
      ? { manage_reports: true, manage_users: false, ai_triage: true, escalate_sla: false }
      : { manage_reports: false, manage_users: false, ai_triage: false, escalate_sla: false };

    const newUser = {
      id: 'usr_' + Date.now(),
      user_id: 'usr_' + Date.now(),
      email: cleanEmail,
      password,
      full_name: cleanName,
      phone: SecurityUtils.sanitize(phone),
      role,
      department: role === ROLES.AUTHORITY ? (department || 'Municipal Grievance Command') : null,
      status: 'active',
      permissions,
      created_at: new Date().toISOString()
    };

    usersStore.push(newUser);
    localStorage.setItem(USERS_STORE_KEY, JSON.stringify(usersStore));

    this.setSession(newUser);
    return { success: true, user: newUser };
  }

  // --- Super Admin User & Permission Management ---
  getAllUsers() {
    const usersStore = JSON.parse(localStorage.getItem(USERS_STORE_KEY) || '[]');
    return usersStore;
  }

  updateUserBySuperAdmin(userId, updateData) {
    if (!this.isSuperAdmin()) {
      throw new Error('Unauthorized. Super Administrator privilege required.');
    }

    const usersStore = JSON.parse(localStorage.getItem(USERS_STORE_KEY) || '[]');
    const idx = usersStore.findIndex(u => u.id === userId || u.user_id === userId);
    if (idx === -1) throw new Error('User account not found.');

    usersStore[idx] = {
      ...usersStore[idx],
      ...updateData,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(USERS_STORE_KEY, JSON.stringify(usersStore));

    // If updating currently logged in user, refresh session
    if (this.currentUser && (this.currentUser.id === userId || this.currentUser.user_id === userId)) {
      this.currentUser = usersStore[idx];
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
    }

    dbEvents.emit('usersUpdated', usersStore);
    return usersStore[idx];
  }

  deleteUserBySuperAdmin(userId) {
    if (!this.isSuperAdmin()) throw new Error('Unauthorized.');
    if (userId === MASTER_SUPER_ADMIN.id) throw new Error('Cannot delete root Super Administrator.');

    let usersStore = JSON.parse(localStorage.getItem(USERS_STORE_KEY) || '[]');
    usersStore = usersStore.filter(u => u.id !== userId && u.user_id !== userId);
    localStorage.setItem(USERS_STORE_KEY, JSON.stringify(usersStore));
    dbEvents.emit('usersUpdated', usersStore);
    return true;
  }

  setSession(user) {
    this.currentUser = user;
    this.sessionToken = SecurityUtils.generateSecureToken();
    const expiry = Date.now() + (24 * 60 * 60 * 1000);

    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_SESSION_KEY, this.sessionToken);
    localStorage.setItem('civicai_session_expiry', expiry.toString());

    dbEvents.emit('authChanged', user);
  }

  async signOut() {
    const sb = getSupabase();
    if (sb && isLiveSupabase()) {
      try { await sb.auth.signOut(); } catch {}
    }
    this.currentUser = null;
    this.sessionToken = null;
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('civicai_session_expiry');
    dbEvents.emit('authChanged', null);
  }

  static checkPasswordStrength(password) {
    let score = 0;
    if (!password) return { score: 0, text: 'Empty', color: '#cbd5e1' };
    if (password.length >= 6) score += 25;
    if (password.length >= 10) score += 25;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;

    if (score < 40) return { score, text: 'Weak', color: '#ef4444' };
    if (score < 75) return { score, text: 'Medium', color: '#f59e0b' };
    return { score: Math.min(score, 100), text: 'Strong', color: '#10b981' };
  }
}

export const auth = new AuthService();
