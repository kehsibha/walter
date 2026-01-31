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

type SummaryRow = {
  id: string;
  axios_summary: unknown;
  created_at: string;
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

  // Only show events for jobs that are actively running (not stale failed/succeeded jobs)
  const isActiveJob = job?.status === "queued" || job?.status === "running";
  const { data: events } = job?.id && isActiveJob
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

  // Also fetch orphaned summaries (summaries without videos yet - from current/recent jobs)
  // Only show summaries from the last 30 minutes to avoid stale data accumulation
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: orphanedSummaries } = await supabase
    .from("summaries")
    .select("id, axios_summary, created_at")
    .gte("created_at", thirtyMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  // Filter to only summaries that aren't already in items (via videos)
  const existingSummaryIds = new Set(
    items
      .map((it) => (it.video as { summaries?: { id: string } } | null)?.summaries?.id)
      .filter(Boolean)
  );
  
  const pendingSummaries = ((orphanedSummaries ?? []) as SummaryRow[])
    .filter((s) => !existingSummaryIds.has(s.id))
    .map((s) => ({
      id: `pending-${s.id}`,
      viewed: false,
      liked: false,
      created_at: s.created_at,
      video: {
        id: null,
        video_url: null,
        thumbnail_url: null,
        duration: null,
        script: null,
        summaries: {
          id: s.id,
          axios_summary: s.axios_summary,
          created_at: s.created_at,
        },
      },
    }));

  return NextResponse.json({ 
    job, 
    events: (events ?? []).reverse(), 
    items,
    pendingSummaries, // Summaries without videos (for newsletter view)
  });
}

