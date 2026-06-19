// api/delete-account.js — Vercel Edge Function
// Deletes the authenticated user's account.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
// The service_role key MUST stay server-side only.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server not configured' }, 503);

  // Extract user JWT from Authorization header
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice(7);

  // Verify the token and get the user's ID
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: 'Invalid session' }, 401);
  const { id: userId } = await userRes.json();
  if (!userId) return json({ error: 'Invalid session' }, 401);

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  // Delete user-owned data before removing the auth record.
  // cart_items has a FK to auth.users so it must be deleted first.
  await fetch(`${supabaseUrl}/rest/v1/cart_items?user_id=eq.${userId}`, {
    method: 'DELETE', headers: serviceHeaders,
  });
  await fetch(`${supabaseUrl}/rest/v1/wishlist_items?user_id=eq.${userId}`, {
    method: 'DELETE', headers: serviceHeaders,
  });
  await fetch(`${supabaseUrl}/rest/v1/reviews?user_id=eq.${userId}`, {
    method: 'DELETE', headers: serviceHeaders,
  });
  await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: 'DELETE', headers: serviceHeaders,
  });

  // Delete the Supabase Auth user (requires service_role)
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!deleteRes.ok) {
    const err = await deleteRes.text();
    return json({ error: 'Failed to delete account', detail: err }, 500);
  }

  return json({ success: true });
};

export const config = { runtime: 'edge' };
