export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const SESSION_KEY = 'civicai_supabase_session_v1';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, '') || '';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isLiveSupabaseConfigured = (): boolean =>
  Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes('your-project-url') &&
      !SUPABASE_ANON_KEY.includes('your-anon-key')
  );

export function getStoredSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SupabaseSession;
    return session.accessToken && session.refreshToken ? session : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SupabaseSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message || body.error_description || body.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

/** Returns a fresh Supabase access token, refreshing an expired browser session when possible. */
export async function getValidAccessToken(): Promise<string | null> {
  const session = getStoredSession();
  if (!session) return null;

  if (session.expiresAt > Date.now() + 30_000) {
    return session.accessToken;
  }

  if (!isLiveSupabaseConfigured()) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  if (!response.ok) {
    clearStoredSession();
    throw new Error(`Your session has expired. Please sign in again. (${await getErrorMessage(response)})`);
  }

  const refreshed = await response.json();
  saveSession({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
  });
  return refreshed.access_token;
}

export async function getResponseError(response: Response): Promise<string> {
  return getErrorMessage(response);
}
