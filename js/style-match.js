// js/style-match.js
// AI Style Match client functions.
// API key is stored in Supabase Edge Function secrets only — never here.
import { supabase } from './supabase.js';

// ─── Constants ──────────────────────────────────────────────────────────────

// Edge function endpoint — resolved from build-time env or fallback to production
const STYLE_MATCH_URL =
  (typeof window !== 'undefined' && window.__ENV?.SUPABASE_URL
    ? window.__ENV.SUPABASE_URL
    : import.meta.env?.VITE_SUPABASE_URL ?? '') +
  '/functions/v1/style-match';

// Max image dimension (long edge) before upload — D-04
const MAX_IMAGE_PX = 800;

// ─── Image Helpers ──────────────────────────────────────────────────────────

/**
 * Resize an image File/Blob to fit within MAX_IMAGE_PX on the long edge.
 * Returns a base64 data URI (image/jpeg, quality 0.85).
 *
 * @param {File} file - The image file from the file input.
 * @returns {Promise<string>} Base64 data URI.
 */
export async function resizeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { width, height } = img;
      const longEdge = Math.max(width, height);
      const scale = longEdge > MAX_IMAGE_PX ? MAX_IMAGE_PX / longEdge : 1;
      const targetWidth = Math.round(width * scale);
      const targetHeight = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = objectUrl;
  });
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Submit a Style Match request to the Edge Function.
 * Photo is resized client-side to ≤800px before sending (D-04).
 * Results are saved to ai_style_sessions for authenticated users (D-06).
 *
 * @param {File|null} photoFile - The user's uploaded photo (or null to skip vision).
 * @param {{ activity: string[], fit: string, aesthetic: string, colour: string }} preferences
 * @returns {Promise<{ recommendations: object[], colour_guidance: string }>}
 */
export async function submitStyleMatch(photoFile, preferences) {
  // Get current session JWT for the Authorization header
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('You must be signed in to use Style Match.');
  }

  // Resize photo to base64 if provided (D-04 canvas resize)
  let photoUrl = null;
  if (photoFile) {
    try {
      photoUrl = await resizeImageToBase64(photoFile);
    } catch (resizeErr) {
      console.error('Photo resize failed, proceeding without photo:', resizeErr);
      // Non-fatal — proceed without photo (AI will rely on preferences only)
    }
  }

  const payload = {
    photo_url: photoUrl,
    preferences: {
      activity: preferences.activity ?? [],
      fit: preferences.fit ?? '',
      aesthetic: preferences.aesthetic ?? '',
      colour: preferences.colour ?? '',
    },
  };

  const response = await fetch(STYLE_MATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': window.__ENV?.SUPABASE_ANON_KEY ?? import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ?? `Style Match request failed (${response.status})`
    );
  }

  return await response.json();
}

/**
 * Retrieve the current user's past AI Style Match sessions.
 * Sorted by created_at descending (newest first).
 * Returns an empty array if the user is not authenticated.
 *
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{
 *   id: string,
 *   user_id: string,
 *   preferences: object,
 *   recommendations: object[],
 *   colour_guidance: string|null,
 *   created_at: string
 * }>>}
 */
export async function getSessions({ limit = 20 } = {}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Guests have no saved sessions (D-06)
    return [];
  }

  const { data, error } = await supabase
    .from('ai_style_sessions')
    .select('id, user_id, preferences, recommendations, colour_guidance, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch AI sessions:', error.message);
    throw new Error('Could not load your style history. Please try again.');
  }

  return data ?? [];
}

/**
 * Delete a specific AI session by ID.
 * Only the session owner can delete (enforced by RLS).
 *
 * @param {string} sessionId - UUID of the session to delete.
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  const { error } = await supabase
    .from('ai_style_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('Failed to delete AI session:', error.message);
    throw new Error('Could not delete session. Please try again.');
  }
}
