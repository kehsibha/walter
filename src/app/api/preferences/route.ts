import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseService } from "@/lib/supabase/service";
import { DEMO_USER_ID } from "@/lib/demoUser";

const CreateSchema = z.object({
  topic: z.string().min(1).max(120),
  category: z.string().max(120).optional(),
  geographic_scope: z.string().max(40).optional(),
  priority: z.number().int().min(1).max(10),
});

export async function GET() {
  const svc = createSupabaseService();
  const { data, error } = await svc
    .from("user_preferences")
    .select("id, topic, category, geographic_scope, priority, created_at")
    .eq("user_id", DEMO_USER_ID)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data ?? [] });
}

export async function POST(request: Request) {
  const body = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Use service role insert so this endpoint works even if cookie-session hasn't refreshed.
  const svc = createSupabaseService();
  const { data, error } = await svc
    .from("user_preferences")
    .insert({
      user_id: DEMO_USER_ID,
      topic: body.data.topic,
      category: body.data.category ?? null,
      geographic_scope: body.data.geographic_scope ?? null,
      priority: body.data.priority,
    })
    .select("id, topic, category, geographic_scope, priority, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preference: data });
}

