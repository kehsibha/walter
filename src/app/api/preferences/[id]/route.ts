import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseService } from "@/lib/supabase/service";
import { DEMO_USER_ID } from "@/lib/demoUser";

const UpdateSchema = z.object({
  topic: z.string().min(1).max(120).optional(),
  category: z.string().max(120).optional().nullable(),
  geographic_scope: z.string().max(40).optional().nullable(),
  priority: z.number().int().min(1).max(10).optional(),
});

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const svc = createSupabaseService();
  const { data, error } = await svc
    .from("user_preferences")
    .update(body.data)
    .eq("id", id)
    .eq("user_id", DEMO_USER_ID)
    .select("id, topic, category, geographic_scope, priority, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preference: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const svc = createSupabaseService();
  const { error } = await svc.from("user_preferences").delete().eq("id", id).eq("user_id", DEMO_USER_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

