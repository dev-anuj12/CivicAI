import { UserProfile, UserRole } from '../types';
import {
  clearStoredSession,
  getResponseError,
  getValidAccessToken,
  isLiveSupabaseConfigured,
  saveSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './supabaseConfig';

const CURRENT_USER_KEY = 'civicai_current_user_v3';

export const MASTER_ADMIN_EMAIL = (
  (import.meta.env?.VITE_SUPER_ADMIN_EMAIL as string) || 'anujvishwakarm1308@gmail.com'
).trim();

type AuthResult = { success: boolean; user?: UserProfile; error?: string };

interface SupabaseProfileRow {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  ward?: string | null;
  role?: string | null;
  department?: string | null;
  status?: 'active' | 'suspended' | null;
  is_super_admin?: boolean | null;
  created_at?: string;
}

function saveCurrentUser(user: UserProfile | null): void {
  if (user) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(CURRENT_USER_KEY);
}

function toUserProfile(row: SupabaseProfileRow): UserProfile {
  const role: UserRole = row.role === 'admin' || row.role === 'authority' ? 'admin' : 'citizen';
  return {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || undefined,
    ward: row.ward || undefined,
    role,
    department: row.department || undefined,
    isVerified: true,
    status: row.status || 'active',
    isSuperAdmin: Boolean(row.is_super_admin),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function notConfigured(): AuthResult {
  return {
    success: false,
    error: 'Cloud authentication is not configured. Add the Supabase VITE variables and redeploy.',
  };
}

function getUserIdFromJwt(token: string): string {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof decoded.sub === 'string') return decoded.sub;
  } catch {
    // The API request below will reject the invalid token.
  }
  return '';
}

async function fetchOwnProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=*&user_id=eq.${encodeURIComponent(getUserIdFromJwt(accessToken))}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) throw new Error(await getResponseError(response));
  const rows = (await response.json()) as SupabaseProfileRow[];
  if (!rows[0]) {
    throw new Error('Your account profile is still being created. Please wait a moment and sign in again.');
  }
  return toUserProfile(rows[0]);
}

async function callAdminApi(path: string, init: RequestInit = {}): Promise<any> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error('Please sign in as a Super Admin first.');

  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) throw new Error(await getResponseError(response));
  return response.status === 204 ? undefined : response.json();
}

export class AuthService {
  static getCurrentUser(): UserProfile | null {
    try {
      const data = localStorage.getItem(CURRENT_USER_KEY);
      return data ? (JSON.parse(data) as UserProfile) : null;
    } catch {
      return null;
    }
  }

  /** Restores the real Supabase session after a reload or on another device. */
  static async restoreSession(): Promise<UserProfile | null> {
    if (!isLiveSupabaseConfigured()) return this.getCurrentUser();
    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        saveCurrentUser(null);
        return null;
      }
      const user = await fetchOwnProfile(accessToken);
      saveCurrentUser(user);
      return user;
    } catch {
      this.signOut();
      return null;
    }
  }

  static async signUp(
    fullName: string,
    email: string,
    password: string,
    phone = '',
    ward = 'Central Municipal Zone'
  ): Promise<AuthResult> {
    if (!isLiveSupabaseConfigured()) return notConfigured();
    if (fullName.trim().length < 2) return { success: false, error: 'Please enter your full name.' };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: 'Please enter a valid email address.' };
    if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters long.' };

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          data: { full_name: fullName.trim(), phone: phone.trim(), ward: ward.trim() },
        }),
      });
      if (!response.ok) return { success: false, error: await getResponseError(response) };

      const data = await response.json();
      if (!data.session) {
        return {
          success: false,
          error: 'Account created. Please verify the email sent by Supabase, then sign in.',
        };
      }

      saveSession({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: Date.now() + Number(data.session.expires_in || 3600) * 1000,
      });
      const user = await fetchOwnProfile(data.session.access_token);
      saveCurrentUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not create the account.' };
    }
  }

  static async signIn(email: string, password: string): Promise<AuthResult> {
    if (!isLiveSupabaseConfigured()) return notConfigured();
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!response.ok) return { success: false, error: await getResponseError(response) };

      const data = await response.json();
      saveSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
      });
      const user = await fetchOwnProfile(data.access_token);
      if (user.status === 'suspended') {
        this.signOut();
        return { success: false, error: 'This account has been suspended.' };
      }
      saveCurrentUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not sign in.' };
    }
  }

  static async unlockAdminViaCredentials(password: string, email: string): Promise<AuthResult> {
    const result = await this.signIn(email, password);
    if (!result.success || !result.user) return result;
    if (result.user.role !== 'admin') {
      this.signOut();
      return { success: false, error: 'This account does not have municipal administrator access.' };
    }
    return result;
  }

  static async updateUserProfile(
    userId: string,
    updates: { fullName?: string; phone?: string; ward?: string },
    currentPassword?: string,
    newPassword?: string
  ): Promise<AuthResult> {
    const accessToken = await getValidAccessToken();
    if (!accessToken || getUserIdFromJwt(accessToken) !== userId) {
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    try {
      if (newPassword) {
        if (!currentPassword) return { success: false, error: 'Enter your current password to set a new password.' };
        if (newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters long.' };

        const current = this.getCurrentUser();
        if (!current) return { success: false, error: 'Your session has expired. Please sign in again.' };
        const verification = await this.signIn(current.email, currentPassword);
        if (!verification.success) return { success: false, error: 'Current password does not match.' };
        const passwordResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: 'PUT',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword }),
        });
        if (!passwordResponse.ok) return { success: false, error: await getResponseError(passwordResponse) };
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          full_name: updates.fullName?.trim(),
          phone: updates.phone?.trim() || null,
          ward: updates.ward?.trim() || null,
        }),
      });
      if (!response.ok) return { success: false, error: await getResponseError(response) };
      const rows = (await response.json()) as SupabaseProfileRow[];
      if (!rows[0]) return { success: false, error: 'Profile could not be updated.' };
      const user = toUserProfile(rows[0]);
      saveCurrentUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not update profile.' };
    }
  }

  static async createAdminBySuperAdmin(
    _callerEmail: string,
    adminData: { fullName: string; email: string; department: string; password?: string }
  ): Promise<{ success: boolean; adminUser?: UserProfile; generatedPassword?: string; error?: string }> {
    try {
      const data = await callAdminApi('/api/admin-officers', {
        method: 'POST',
        body: JSON.stringify(adminData),
      });
      return { success: true, adminUser: toUserProfile(data.profile), generatedPassword: data.generatedPassword };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not create administrator.' };
    }
  }

  static async getAdminsList(_callerEmail: string): Promise<UserProfile[]> {
    try {
      const data = await callAdminApi('/api/admin-officers');
      return (data.profiles || []).map(toUserProfile);
    } catch {
      return [];
    }
  }

  static async toggleAdminStatus(
    _callerEmail: string,
    adminId: string
  ): Promise<{ success: boolean; status?: 'active' | 'suspended'; error?: string }> {
    try {
      const data = await callAdminApi('/api/admin-officers', {
        method: 'PATCH',
        body: JSON.stringify({ userId: adminId }),
      });
      return { success: true, status: data.profile.status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not update administrator.' };
    }
  }

  static generateRandomPassword(): string {
    return `Civic@${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  }

  static signOut(): void {
    clearStoredSession();
    saveCurrentUser(null);
  }
}
