import { UserProfile, UserRole } from '../types';

const STORAGE_KEYS = {
  USERS: 'civicai_users_v2',
  CURRENT_USER: 'civicai_current_user_v2',
  LOGIN_ATTEMPTS: 'civicai_login_attempts_v2',
};

// Exclusive Super Admin Credentials
export const MASTER_ADMIN_EMAIL = 'anujvishwakarm1308@gmail.com';
export const MASTER_ADMIN_PASSWORD = 'Anuj@admin12';

interface StoredUser extends UserProfile {
  passwordHash: string;
}

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

// Deterministic hash for client-side storage security
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `civ_${Math.abs(hash).toString(16)}_${password.length}`;
}

export class AuthService {
  // Get all registered users
  static getUsers(): StoredUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Get current authenticated user
  static getCurrentUser(): UserProfile | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // Set current user
  static setCurrentUser(user: UserProfile | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // Check brute force protection
  static checkBruteForce(email: string): { isLocked: boolean; remainingSec: number } {
    try {
      const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      const attempts: Record<string, AttemptRecord> = attemptsStr ? JSON.parse(attemptsStr) : {};
      const record = attempts[email.toLowerCase()];

      if (record?.lockedUntil && Date.now() < record.lockedUntil) {
        const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
        return { isLocked: true, remainingSec };
      }
      return { isLocked: false, remainingSec: 0 };
    } catch {
      return { isLocked: false, remainingSec: 0 };
    }
  }

  static recordFailedAttempt(email: string): void {
    try {
      const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      const attempts: Record<string, AttemptRecord> = attemptsStr ? JSON.parse(attemptsStr) : {};
      const key = email.toLowerCase();
      const current = attempts[key] || { count: 0, lockedUntil: null };

      current.count += 1;
      if (current.count >= 5) {
        // Lock for 5 minutes
        current.lockedUntil = Date.now() + 5 * 60 * 1000;
      }
      attempts[key] = current;
      localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attempts));
    } catch (e) {
      console.error(e);
    }
  }

  static clearFailedAttempts(email: string): void {
    try {
      const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      if (!attemptsStr) return;
      const attempts = JSON.parse(attemptsStr);
      delete attempts[email.toLowerCase()];
      localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attempts));
    } catch (e) {
      console.error(e);
    }
  }

  // Generate secure random password for newly created admins
  static generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'Civic@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  }

  // Citizen Sign Up
  static async signUp(
    fullName: string,
    email: string,
    password: string,
    phone = '',
    ward = 'Central Municipal Zone'
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!fullName || fullName.trim().length < 2) {
      return { success: false, error: 'Please enter your full legal or citizen name.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    // Check if registering with super admin email
    if (email.trim().toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      if (password === MASTER_ADMIN_PASSWORD) {
        const adminProfile: UserProfile = {
          id: 'usr_super_admin_anuj',
          fullName: fullName.trim() || 'Anuj Vishwakarma (Super Admin)',
          email: MASTER_ADMIN_EMAIL,
          phone: phone.trim() || undefined,
          ward,
          role: 'admin',
          isSuperAdmin: true,
          status: 'active',
          department: 'Executive Smart City Administration',
          isVerified: true,
          createdAt: new Date().toISOString(),
        };
        this.setCurrentUser(adminProfile);
        return { success: true, user: adminProfile };
      } else {
        return { success: false, error: 'This official administrator email requires the authorized master password.' };
      }
    }

    const users = this.getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return { success: false, error: 'An account with this email already exists. Please sign in.' };
    }

    const newUser: StoredUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      ward: ward.trim() || 'Central Municipal Ward',
      role: 'citizen',
      isVerified: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const { passwordHash, ...profile } = newUser;
    this.setCurrentUser(profile);
    this.clearFailedAttempts(email);

    return { success: true, user: profile };
  }

  // Sign In (Citizen, Admin, or Super Admin)
  static async signIn(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const lockout = this.checkBruteForce(email);
    if (lockout.isLocked) {
      return {
        success: false,
        error: `Account temporarily locked due to multiple failed attempts. Try again in ${lockout.remainingSec}s.`,
      };
    }

    // Check Exclusive Super Admin Credentials
    if (
      email.trim().toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() &&
      password === MASTER_ADMIN_PASSWORD
    ) {
      const adminProfile: UserProfile = {
        id: 'usr_super_admin_anuj',
        fullName: 'Anuj Vishwakarma',
        email: MASTER_ADMIN_EMAIL,
        role: 'admin',
        isSuperAdmin: true,
        status: 'active',
        department: 'Executive Smart City Administration',
        isVerified: true,
        createdAt: new Date().toISOString(),
      };
      this.setCurrentUser(adminProfile);
      this.clearFailedAttempts(email);
      return { success: true, user: adminProfile };
    }

    const users = this.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.passwordHash !== hashPassword(password)) {
      this.recordFailedAttempt(email);
      return { success: false, error: 'Invalid email or password. Please verify your credentials.' };
    }

    // Check if account is suspended
    if (user.status === 'suspended') {
      return {
        success: false,
        error: 'Your account has been suspended by the municipal administration.',
      };
    }

    this.clearFailedAttempts(email);
    const { passwordHash, ...profile } = user;
    this.setCurrentUser(profile);

    return { success: true, user: profile };
  }

  // Secret Admin Authentication (Accepts Email & Password)
  static unlockAdminViaCredentials(passwordOrKey: string, email?: string): { success: boolean; user?: UserProfile; error?: string } {
    const enteredEmail = email ? email.trim().toLowerCase() : MASTER_ADMIN_EMAIL.toLowerCase();

    // Check Super Admin
    if (
      enteredEmail === MASTER_ADMIN_EMAIL.toLowerCase() &&
      passwordOrKey.trim() === MASTER_ADMIN_PASSWORD
    ) {
      const adminProfile: UserProfile = {
        id: 'usr_super_admin_anuj',
        fullName: 'Anuj Vishwakarma',
        email: MASTER_ADMIN_EMAIL,
        role: 'admin',
        isSuperAdmin: true,
        status: 'active',
        department: 'Executive Smart City Administration',
        isVerified: true,
        createdAt: new Date().toISOString(),
      };
      this.setCurrentUser(adminProfile);
      return { success: true, user: adminProfile };
    }

    // Also allow any admin created by Super Admin
    const users = this.getUsers();
    const adminUser = users.find(
      (u) => u.email.toLowerCase() === enteredEmail && u.role === 'admin'
    );

    if (adminUser && adminUser.passwordHash === hashPassword(passwordOrKey)) {
      if (adminUser.status === 'suspended') {
        return { success: false, error: 'This administrator account has been suspended.' };
      }
      const { passwordHash, ...profile } = adminUser;
      this.setCurrentUser(profile);
      return { success: true, user: profile };
    }

    return { success: false, error: 'Invalid administrator credentials. Access denied.' };
  }

  // Citizen: Update Profile & Change Password (Strict Owner Security)
  static async updateUserProfile(
    userId: string,
    updates: { fullName?: string; phone?: string; ward?: string },
    currentPassword?: string,
    newPassword?: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || currentUser.id !== userId) {
      return { success: false, error: 'Unauthorized. You can only update your own account.' };
    }

    // If Super Admin
    if (currentUser.email === MASTER_ADMIN_EMAIL) {
      const updated: UserProfile = {
        ...currentUser,
        fullName: updates.fullName?.trim() || currentUser.fullName,
        phone: updates.phone?.trim() || currentUser.phone,
        ward: updates.ward?.trim() || currentUser.ward,
      };
      this.setCurrentUser(updated);
      return { success: true, user: updated };
    }

    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return { success: false, error: 'User record not found.' };
    }

    const user = users[idx];

    // If password change is requested, verify current password first
    if (newPassword) {
      if (!currentPassword) {
        return { success: false, error: 'Please enter your current password to verify your identity.' };
      }
      if (user.passwordHash !== hashPassword(currentPassword)) {
        return { success: false, error: 'Current password does not match.' };
      }
      if (newPassword.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters long.' };
      }
      user.passwordHash = hashPassword(newPassword);
    }

    if (updates.fullName && updates.fullName.trim().length >= 2) {
      user.fullName = updates.fullName.trim();
    }
    if (updates.phone !== undefined) {
      user.phone = updates.phone.trim();
    }
    if (updates.ward !== undefined) {
      user.ward = updates.ward.trim();
    }

    users[idx] = user;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const { passwordHash, ...profile } = user;
    this.setCurrentUser(profile);

    return { success: true, user: profile };
  }

  // ===========================================================================
  // SUPER ADMIN ONLY: Create New Municipal Administrators
  // ===========================================================================
  static createAdminBySuperAdmin(
    callerEmail: string,
    adminData: { fullName: string; email: string; department: string; password?: string }
  ): { success: boolean; adminUser?: UserProfile; generatedPassword?: string; error?: string } {
    // Strict verification: ONLY Super Admin can execute this!
    if (callerEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      return {
        success: false,
        error: 'Security Barrier: Only the Super Administrator (anujvishwakarm1308@gmail.com) is authorized to onboard administrators.',
      };
    }

    if (!adminData.fullName || adminData.fullName.trim().length < 2) {
      return { success: false, error: 'Please enter the official administrator full name.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminData.email)) {
      return { success: false, error: 'Please enter a valid official email address.' };
    }

    const users = this.getUsers();
    if (users.some((u) => u.email.toLowerCase() === adminData.email.trim().toLowerCase())) {
      return { success: false, error: 'An administrator or citizen with this email already exists.' };
    }

    const password = adminData.password?.trim() || this.generateRandomPassword();

    const newAdmin: StoredUser = {
      id: `admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fullName: adminData.fullName.trim(),
      email: adminData.email.trim().toLowerCase(),
      role: 'admin',
      isSuperAdmin: false,
      department: adminData.department || 'Municipal Public Works',
      isVerified: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };

    users.push(newAdmin);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const { passwordHash, ...profile } = newAdmin;
    return { success: true, adminUser: profile, generatedPassword: password };
  }

  // Super Admin: List all created admins
  static getAdminsList(callerEmail: string): UserProfile[] {
    if (callerEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      return [];
    }

    const users = this.getUsers();
    const createdAdmins = users
      .filter((u) => u.role === 'admin' && u.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase())
      .map(({ passwordHash, ...profile }) => profile);

    return createdAdmins;
  }

  // Super Admin: Toggle Admin Status (Active / Suspended)
  static toggleAdminStatus(callerEmail: string, adminId: string): { success: boolean; status?: 'active' | 'suspended'; error?: string } {
    if (callerEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: 'Unauthorized.' };
    }

    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === adminId && u.role === 'admin');
    if (idx === -1) {
      return { success: false, error: 'Administrator not found.' };
    }

    const currentStatus = users[idx].status || 'active';
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    users[idx].status = nextStatus;

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return { success: true, status: nextStatus };
  }

  // Sign out
  static signOut(): void {
    this.setCurrentUser(null);
  }
}
