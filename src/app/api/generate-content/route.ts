import { NextResponse } from "next/server";

import { createSupabaseService } from "@/lib/supabase/service";
import { DEMO_USER_ID } from "@/lib/demoUser";

export async function POST() {
  const supabase = createSupabaseService();

  const { data, error } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: DEMO_USER_ID,
      status: "queued",
      progress: 0,
      step: "queued",
      payload: {},
    })
    .select("id, status, progress, step, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data });
}

