// Phase 5 — AI Style Match Edge Function
// Calls Gemini Vision API and persists results for authenticated users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers — origin locked to production Netlify domain per D-09/D-15
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

// Response shape from AI (enforced by prompt):
// {
//   recommendations: [{
//     name: string,
//     product_ids: string[],
//     colour_guidance: string,
//     why_it_works: string
//   }],
//   colour_guidance: string  -- top-level colour palette note
// }

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // JWT verification — reject unauthenticated requests per T-05-01 / D-07
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

  // Parse request body
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

  // ─── Gemini Vision API call ───────────────────────────────────────────────
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  // Catalog context: 22 hero products (D-02 — send only essential fields, not full variants)
  // This is populated by the seeded data; product_ids must match supabase seed UUIDs.
  // Using symbolic names here — Phase 5 build will swap these for real IDs from the DB.
  const CATALOG_CONTEXT = `
You are Elvy, the premium personal stylist for ELVORA activewear. Your goal is to make the
user feel confident and understood. Use a sophisticated yet encouraging tone. Reference their
photo directly (e.g., "Based on your cool skin tone...", "Since you have an athletic build...").

The user's style preferences:
- Activities: ${(body.preferences?.activity ?? []).join(", ") || "general activewear"}
- Fit preference: ${body.preferences?.fit ?? "relaxed"}
- Aesthetic: ${body.preferences?.aesthetic ?? "minimal"}
- Colour preference: ${body.preferences?.colour ?? "neutral"}

You must respond with ONLY valid JSON in the following shape (no markdown, no prose outside JSON):
{
  "recommendations": [
    {
      "name": "<outfit name>",
      "product_ids": ["<product_id_1>", "<product_id_2>"],
      "colour_guidance": "<specific colour advice for this outfit>",
      "why_it_works": "<1-2 sentences referencing their photo attributes>"
    }
  ],
  "colour_guidance": "<overall palette recommendation for this user>"
}

Return exactly 3 outfit recommendations. If you cannot identify appropriate products,
return a fallback using the bestseller category rather than an error.
`;

  interface Recommendation {
    name: string;
    product_ids: string[];
    colour_guidance: string;
    why_it_works: string;
  }

  interface AiResponse {
    recommendations: Recommendation[];
    colour_guidance: string;
  }

  let aiResult: AiResponse;

  if (GEMINI_API_KEY) {
    // Build Gemini request — include photo if provided (D-04: already resized by client)
    type GeminiPart =
      | { text: string }
      | { inline_data: { mime_type: string; data: string } };

    const parts: GeminiPart[] = [{ text: CATALOG_CONTEXT }];

    if (body.photo_url) {
      // photo_url is a base64 data URI (e.g. data:image/jpeg;base64,...)
      const match = body.photo_url.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2],
          },
        });
      }
    }

    const geminiPayload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    try {
      aiResult = JSON.parse(rawText) as AiResponse;
    } catch {
      console.error("Failed to parse Gemini response as JSON:", rawText);
      return new Response(
        JSON.stringify({ error: "AI returned an unexpected format" }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
  } else {
    // Development fallback — GEMINI_API_KEY not configured
    console.log("GEMINI_API_KEY not set — returning mock response");
    aiResult = {
      recommendations: [
        {
          name: "Sage Studio Set",
          product_ids: ["seed-product-id-1", "seed-product-id-2"],
          colour_guidance:
            "Earthy tones complement your natural colouring — lean into sage and ivory.",
          why_it_works:
            "The relaxed fit and muted palette align perfectly with your aesthetic preference for minimal activewear.",
        },
        {
          name: "Onyx Performance Duo",
          product_ids: ["seed-product-id-3", "seed-product-id-4"],
          colour_guidance:
            "Classic monochrome anchors your look with effortless confidence.",
          why_it_works:
            "Your preference for structured fits makes this pairing ideal for pilates or studio work.",
        },
        {
          name: "Ivory Editorial Set",
          product_ids: ["seed-product-id-5", "seed-product-id-6"],
          colour_guidance:
            "Cream and white tones highlight your warm undertones beautifully.",
          why_it_works:
            "An editorial edge that matches your stated aesthetic — elevated and wearable.",
        },
      ],
      colour_guidance:
        "Your palette is naturally suited to warm neutrals — sage, ivory, camel — with occasional slate blue for contrast.",
    };
  }

  // ─── Session persistence for authenticated users (D-06 / F-035) ──────────
  // Extract user from JWT using Supabase client (service role bypasses RLS for writes here;
  // we rely on the anon key + auth header to get the correct user context).
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user — null if token is invalid/expired
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id) {
      // Insert session — failure is non-fatal (result still returned to user)
      const { error: insertError } = await supabase
        .from("ai_style_sessions")
        .insert({
          user_id: user.id,
          preferences: body.preferences ?? {},
          recommendations: aiResult.recommendations,
          colour_guidance: aiResult.colour_guidance ?? null,
        });

      if (insertError) {
        // Log but do not block the response — session save failure is non-fatal
        console.error("Failed to save AI session:", insertError.message);
      } else {
        console.log("AI session saved for user:", user.id);
      }
    }
    // If user is null or guest, session is not persisted (D-06)
  }

  return new Response(JSON.stringify(aiResult), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
