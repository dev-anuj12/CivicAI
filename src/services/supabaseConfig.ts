export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const SESSION_KEY = 'civicai_supabase_session_v1';

const DEFAULT_SUPABASE_URL = 'https://lsyupqpuhcnzchxcujtx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_k8U-vLhmoFvLTJ2rYZPD5g_s9XI-enE';

function cleanEnvValue(raw?: string, defaultValue = ''): string {
  if (!raw) return defaultValue;
  let val = raw.trim();
  if (val.startsWith('VITE_') && val.includes('=')) {
    val = val.substring(val.indexOf('=') + 1).trim();
  }
  return val || defaultValue;
}

export const SUPABASE_URL = cleanEnvValue(
  import.meta.env?.VITE_SUPABASE_URL as string,
  DEFAULT_SUPABASE_URL
).replace(/\/$/, '');

export const SUPABASE_ANON_KEY = cleanEnvValue(
  import.meta.env?.VITE_SUPABASE_ANON_KEY as string,
  DEFAULT_SUPABASE_ANON_KEY
);

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
    const text = await response.text();
    if (!text) return `Request failed (${response.status})`;
    try {
      const body = JSON.parse(text);
      if (typeof body === 'string') return body;
      const rawMsg =
        body.msg ||
        body.message ||
        body.error_description ||
        body.error ||
        body.hint;
      if (rawMsg) {
        const msg = String(rawMsg);
        const lower = msg.toLowerCase();
        if (lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit')) {
          return "Supabase email rate limit reached. To bypass this, disable 'Confirm email' in Supabase Dashboard (Authentication > Providers > Email) or try again later.";
        }
        if (lower.includes('user already registered') || lower.includes('already exists')) {
          return "An account with this email is already registered. Please sign in instead.";
        }
        if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
          return "Incorrect email or password. Please verify your credentials or create a new account.";
        }
        if (lower.includes('email not confirmed')) {
          return "Your email address has not been confirmed yet. Please click the link sent to your email or disable 'Confirm email' in Supabase Auth settings.";
        }
        return msg;
      }
    } catch {
      // response was not JSON
    }

    if (response.status === 404) {
      return 'The requested authentication or database service was not found (404). Please verify your Supabase configuration.';
    }
    if (response.status === 401 || response.status === 403) {
      return 'Invalid credentials or unauthorized access.';
    }
    if (response.status === 429) {
      return 'Rate limit exceeded. Please try again in a few minutes or disable email confirmations in your Supabase project.';
    }
    return `Request failed (${response.status})`;
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
