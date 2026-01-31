import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseService } from "@/lib/supabase/service";
import { DEMO_USER_ID } from "@/lib/demoUser";
import { ExtractedPreferencesSchema } from "@/lib/schemas/preferences";
import { openaiJson } from "@/lib/integrations/openai";
import { hyperspellUpsertPreferences } from "@/lib/integrations/hyperspell";

const BodySchema = z.object({
  text: z.string().min(3).max(4000),
});

export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const system = [
    "You extract structured news preferences from a user's freeform text.",
    "Return JSON of the shape: { preferences: [{ topic, category?, geographic_scope?, priority }] }.",
    "Prefer discrete topics (2–12). Categories should be short (e.g. Politics, Climate, Technology, Health).",
    "geographic_scope: local | state | federal | international when inferable.",
    "priority: integer 1–10; infer intensity from wording.",
    "Do not include duplicates.",
  ].join("\n");

  const extracted = await openaiJson(ExtractedPreferencesSchema, {
    system,
    user: body.data.text,
  });

  // Hyperspell is optional for demo: if it fails, we still persist to Supabase.
  try {
    await hyperspellUpsertPreferences(DEMO_USER_ID, extracted.preferences);
  } catch {
    // swallow: fallback is Supabase
  }

  // Fallback mirror: Supabase table (service role to bypass RLS if needed)
  const svc = createSupabaseService();
  await svc.from("user_preferences").delete().eq("user_id", DEMO_USER_ID);
  if (extracted.preferences.length) {
    const { error } = await svc.from("user_preferences").insert(
      extracted.preferences.map((p) => ({
        user_id: DEMO_USER_ID,
        topic: p.topic,
        category: p.category ?? null,
        geographic_scope: p.geographic_scope ?? null,
        priority: p.priority,
      }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, extracted });
}

