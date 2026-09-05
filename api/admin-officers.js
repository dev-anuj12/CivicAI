/*
 * Vercel serverless route for Super Admin officer provisioning.
 * SUPABASE_SERVICE_ROLE_KEY is read only on the server and must never use a
 * VITE_ prefix or be committed to git.
 */

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function sendError(res, status, message) {
  return res.status(status).json({ message });
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function responseMessage(response) {
  try {
    const body = await response.json();
    return body.message || body.error_description || body.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function requireSuperAdmin(req) {
  const authorization = req.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return { error: 'Missing administrator session.', status: 401 };

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return { error: 'Your administrator session is invalid or expired.', status: 401 };

  const user = await userResponse.json();
  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=user_id,role,status,is_super_admin&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: serviceHeaders() }
  );
  if (!profileResponse.ok) return { error: await responseMessage(profileResponse), status: 500 };
  const [profile] = await profileResponse.json();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active' || !profile.is_super_admin) {
    return { error: 'Super Admin access is required for officer management.', status: 403 };
  }
  return { user };
}

function generatedPassword() {
  return `Civic@${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return sendError(res, 500, 'Server-side Supabase configuration is incomplete.');
  }

  const administrator = await requireSuperAdmin(req);
  if (administrator.error) return sendError(res, administrator.status, administrator.error);

  if (req.method === 'GET') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=*&role=in.(admin,authority)&order=created_at.desc`,
      { headers: serviceHeaders() }
    );
    if (!response.ok) return sendError(res, response.status, await responseMessage(response));
    return res.status(200).json({ profiles: await response.json() });
  }

  if (req.method === 'POST') {
    const { fullName, email, department, password } = req.body || {};
    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return sendError(res, 400, 'An officer name is required.');
    }
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return sendError(res, 400, 'A valid officer email is required.');
    }

    const officerPassword = typeof password === 'string' && password.length >= 8 ? password : generatedPassword();
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: officerPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim() },
      }),
    });
    if (!authResponse.ok) return sendError(res, authResponse.status, await responseMessage(authResponse));
    const createdUserResponse = await authResponse.json();
    const authUser = createdUserResponse.user || createdUserResponse;
    if (!authUser.id) return sendError(res, 502, 'Supabase did not return the new officer ID.');

    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(authUser.id)}`,
      {
        method: 'PATCH',
        headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify({ role: 'admin', department: department || 'Municipal Administration', status: 'active' }),
      }
    );
    if (!profileResponse.ok) return sendError(res, profileResponse.status, await responseMessage(profileResponse));
    const [profile] = await profileResponse.json();
    return res.status(201).json({ profile, generatedPassword: officerPassword });
  }

  if (req.method === 'PATCH') {
    const userId = req.body?.userId;
    if (typeof userId !== 'string') return sendError(res, 400, 'Officer user ID is required.');

    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=user_id,status,is_super_admin&user_id=eq.${encodeURIComponent(userId)}`,
      { headers: serviceHeaders() }
    );
    if (!lookup.ok) return sendError(res, lookup.status, await responseMessage(lookup));
    const [existing] = await lookup.json();
    if (!existing) return sendError(res, 404, 'Officer account was not found.');
    if (existing.is_super_admin) return sendError(res, 400, 'The Super Admin account cannot be suspended here.');

    const nextStatus = existing.status === 'suspended' ? 'active' : 'suspended';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) return sendError(res, response.status, await responseMessage(response));
    const [profile] = await response.json();
    return res.status(200).json({ profile });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return sendError(res, 405, 'Method not allowed.');
};
