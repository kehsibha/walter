import { NextResponse } from "next/server";

import { createSupabaseService } from "@/lib/supabase/service";
import { DEMO_USER_ID } from "@/lib/demoUser";

type ContentRow = {
  id: string;
  viewed: boolean;
  liked: boolean;
  created_at: string;
  videos: unknown;
};

export async function GET() {
  const supabase = createSupabaseService();

  const { data: job } = await supabase
    .from("generation_jobs")
    .select("id, status, step, progress, error, created_at, updated_at")
    .eq("user_id", DEMO_USER_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: events } = job?.id
    ? await supabase
        .from("generation_job_events")
        .select("kind, message, items, created_at")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as Array<{ kind: string; message: string; items: string[]; created_at: string }> };

  const { data: content, error } = await supabase
    .from("user_content")
    .select(
      `
      id,
      viewed,
      view_duration,
      liked,
      created_at,
      videos:video_id (
        id,
        video_url,
        thumbnail_url,
        duration,
        script,
        created_at,
        summaries:summary_id (
          id,
          axios_summary,
          created_at
        )
      )
    `
    )
    .eq("user_id", DEMO_USER_ID)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((content ?? []) as ContentRow[]).map((row) => ({
    id: row.id,
    viewed: row.viewed,
    liked: row.liked,
    created_at: row.created_at,
    video: row.videos,
  }));

  return NextResponse.json({ job, events: (events ?? []).reverse(), items });
}

