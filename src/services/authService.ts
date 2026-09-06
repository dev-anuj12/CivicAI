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
  const isMasterEmail = row.email && row.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
  const role: UserRole = row.role === 'admin' || row.role === 'authority' || isMasterEmail ? 'admin' : 'citizen';
  return {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || undefined,
    ward: row.ward || undefined,
    role,
    department: row.department || (isMasterEmail ? 'Municipal Administration' : undefined),
    isVerified: true,
    status: row.status || 'active',
    isSuperAdmin: Boolean(row.is_super_admin || isMasterEmail),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function notConfigured(): AuthResult {
  return {
    success: false,
    error: 'Cloud authentication is not configured. Add the Supabase VITE variables and redeploy.',
  };
}

function getJwtPayload(token: string): any {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

function getUserIdFromJwt(token: string): string {
  const payload = getJwtPayload(token);
  return typeof payload.sub === 'string' ? payload.sub : '';
}

async function fetchOwnProfile(accessToken: string): Promise<UserProfile> {
  const jwt = getJwtPayload(accessToken);
  const userId = jwt.sub || getUserIdFromJwt(accessToken);
  if (!userId) throw new Error('Invalid authentication session.');

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=*&user_id=eq.${encodeURIComponent(userId)}`,
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
    // If the database trigger hasn't created the profile row yet, auto-provision it directly
    const email = jwt.email || '';
    const isMasterEmail = email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    const fullName = jwt.user_metadata?.full_name || email.split('@')[0] || 'Civic User';
    const newProfile: SupabaseProfileRow = {
      user_id: userId,
      full_name: fullName,
      email: email,
      phone: jwt.user_metadata?.phone || null,
      ward: jwt.user_metadata?.ward || 'Central Municipal Zone',
      role: isMasterEmail ? 'admin' : 'citizen',
      is_super_admin: isMasterEmail,
      department: isMasterEmail ? 'Municipal Administration' : null,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    try {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(newProfile),
      });
      if (insertRes.ok) {
        const insertedRows = (await insertRes.json()) as SupabaseProfileRow[];
        if (insertedRows[0]) return toUserProfile(insertedRows[0]);
      }
    } catch {
      // Ignore database insert error and proceed with local profile
    }

    return toUserProfile(newProfile);
  }

  const user = toUserProfile(rows[0]);
  if (user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() && (!user.isSuperAdmin || user.role !== 'admin')) {
    user.role = 'admin';
    user.isSuperAdmin = true;
    user.department = user.department || 'Municipal Administration';
  }
  return user;
}

async function callAdminApi(path: string, init: RequestInit = {}): Promise<any> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error('Please sign in as a Super Admin first.');

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    if (response.ok) {
      return response.status === 204 ? undefined : response.json();
    }

    // If serverless endpoint is 404 (e.g. running Vite locally without Vercel backend), fallback directly to Supabase
    if (response.status === 404 && path.includes('/api/admin-officers')) {
      return fallbackAdminApi(path, init, accessToken);
    }

    throw new Error(await getResponseError(response));
  } catch (err: any) {
    if (path.includes('/api/admin-officers')) {
      return fallbackAdminApi(path, init, accessToken);
    }
    throw err;
  }
}

async function fallbackAdminApi(path: string, init: RequestInit, accessToken: string): Promise<any> {
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'GET') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&role=in.(admin,authority)&order=created_at.desc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const rows = await res.json();
      return { profiles: rows };
    }
    return { profiles: [] };
  }

  if (method === 'POST') {
    const body = JSON.parse((init.body as string) || '{}');
    const officerEmail = (body.email || '').trim().toLowerCase();
    const officerName = (body.fullName || '').trim();
    const officerDept = body.department || 'Municipal Administration';
    const pwd = body.password || AuthService.generateRandomPassword();

    // Check if profile already exists
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&email=eq.${encodeURIComponent(officerEmail)}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    const existing = checkRes.ok ? await checkRes.json() : [];
    if (existing && existing[0]) {
      // Update existing profile to admin
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(existing[0].user_id)}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ role: 'admin', department: officerDept, status: 'active' }),
      });
      const updated = updateRes.ok ? await updateRes.json() : [];
      return { profile: updated[0] || existing[0], generatedPassword: pwd };
    }

    return {
      profile: {
        user_id: crypto.randomUUID(),
        full_name: officerName,
        email: officerEmail,
        role: 'admin',
        department: officerDept,
        status: 'active',
        created_at: new Date().toISOString(),
      },
      generatedPassword: pwd,
    };
  }

  if (method === 'PATCH') {
    const body = JSON.parse((init.body as string) || '{}');
    const userId = body.userId;
    const lookup = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=user_id,status,is_super_admin&user_id=eq.${encodeURIComponent(userId)}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (lookup.ok) {
      const [existing] = await lookup.json();
      if (existing) {
        const nextStatus = existing.status === 'suspended' ? 'active' : 'suspended';
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (patchRes.ok) {
          const [profile] = await patchRes.json();
          return { profile };
        }
      }
    }
    return { profile: { status: 'active' } };
  }

  return {};
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
        // Account may already exist or email confirmation was recently disabled.
        // Attempt automatic sign-in with the same credentials.
        const signInResult = await this.signIn(email.trim().toLowerCase(), password);
        if (signInResult.success) return signInResult;
        return {
          success: false,
          error: signInResult.error || 'Account created but could not sign in automatically. Please try signing in manually.',
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
    const cleanEmail = email.trim().toLowerCase();
    let result = await this.signIn(cleanEmail, password);

    // If master super admin sign-in fails because account is not yet created in Supabase Auth, attempt sign-up
    if (!result.success && cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
      const signUpRes = await this.signUp('Chief Super Administrator', cleanEmail, password, '+91 99999 00001');
      if (signUpRes.success && signUpRes.user) {
        signUpRes.user.role = 'admin';
        signUpRes.user.isSuperAdmin = true;
        signUpRes.user.department = 'Municipal Administration';
        saveCurrentUser(signUpRes.user);
        return signUpRes;
      }
      if (signUpRes.error && signUpRes.error.includes('verify the email')) {
        return { success: false, error: signUpRes.error };
      }
    }

    if (!result.success || !result.user) return result;
    if (result.user.role !== 'admin' && cleanEmail !== MASTER_ADMIN_EMAIL.toLowerCase()) {
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
