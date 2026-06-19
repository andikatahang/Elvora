// api/delete-account.js — Vercel Node.js Function (nodejs20.x)
// Deletes the authenticated user's account and all owned data.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (server-side only).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: 'Server not configured' });

  // Node.js req.headers is a plain object — keys are lowercase
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.slice(7);

  // Verify the token and get the user's ID
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid session' });
  const { id: userId } = await userRes.json();
  if (!userId) return res.status(401).json({ error: 'Invalid session' });

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  // Delete all user-owned rows with FK constraints to auth.users (parallel).
  const userFilter = `user_id=eq.${userId}`;
  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/cart_items?${userFilter}`,        { method: 'DELETE', headers: serviceHeaders }),
    fetch(`${supabaseUrl}/rest/v1/wishlist_items?${userFilter}`,    { method: 'DELETE', headers: serviceHeaders }),
    fetch(`${supabaseUrl}/rest/v1/orders?${userFilter}`,            { method: 'DELETE', headers: serviceHeaders }),
    fetch(`${supabaseUrl}/rest/v1/ai_style_sessions?${userFilter}`, { method: 'DELETE', headers: serviceHeaders }),
    fetch(`${supabaseUrl}/rest/v1/reviews?${userFilter}`,           { method: 'DELETE', headers: serviceHeaders }),
  ]);
  await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: 'DELETE', headers: serviceHeaders,
  });

  // Delete the Supabase Auth user (requires service_role)
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!deleteRes.ok) {
    const detail = await deleteRes.text();
    return res.status(500).json({ error: 'Failed to delete account', detail });
  }

  return res.status(200).json({ success: true });
}
