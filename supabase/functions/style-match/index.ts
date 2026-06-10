// Phase 1 stub — returns mock response. Phase 5 replaces the mock block with real Gemini Vision API call.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers — origin locked to production Netlify domain per D-15
// Wildcard (*) is explicitly prohibited by T-05-02 (threat model)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://elvora.netlify.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Request shape (Phase 5 contract):
// {
//   photo_url: string | null,
//   preferences: {
//     activity: string[],
//     fit: string,
//     aesthetic: string,
//     colour: string
//   }
// }

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // JWT verification — reject unauthenticated requests per T-05-01
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // Parse request body — expected shape: { photo_url, preferences: { activity, fit, aesthetic, colour } }
  let body: {
    photo_url?: string | null;
    preferences?: {
      activity?: string[];
      fit?: string;
      aesthetic?: string;
      colour?: string;
    };
  } = {};

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // Log request shape — photo URL logged as "[photo present]" to avoid leaking signed URLs per T-05-03
  console.log(
    "style-match request:",
    JSON.stringify({
      photo_url: body.photo_url ? "[photo present]" : null,
      preferences: body.preferences,
    })
  );

  // TODO: Phase 5 — replace this block with Gemini Vision API call using Deno.env.get('GEMINI_API_KEY')
  const mockResponse = {
    recommendations: [
      {
        name: "Mock Outfit 1",
        product_ids: ["seed-product-id-1", "seed-product-id-2"],
        colour_guidance:
          "Earthy tones complement your natural colouring — lean into sage and ivory.",
      },
    ],
  };

  return new Response(JSON.stringify(mockResponse), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
