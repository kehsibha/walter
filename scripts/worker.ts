import path from "node:path";
import fs from "node:fs";

import { createSupabaseService } from "@/lib/supabase/service";
import { ingestRss } from "@/server/ingest/rss";
import { pickTopTopics, type Preference } from "@/server/match/rank";
import { buildResearchPackage } from "@/server/research/synthesize";
import { generateAxiosSummary } from "@/server/summarize/axios";
import { generateVideoScript } from "@/server/script/videoScript";
import { generateKlingClips } from "@/server/video/falKling";
import { stitchClipsToMp4 } from "@/server/video/assemble";
import { elevenlabsTextToSpeech } from "@/lib/integrations/elevenlabs";
import { hyperspellGetPreferences } from "@/lib/integrations/hyperspell";

type JobRow = {
  id: string;
  user_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  step: string | null;
  progress: number;
  payload: unknown;
};

type JobEvent = {
  ts: string;
  kind:
    | "ingest"
    | "topics"
    | "research"
    | "summarize"
    | "script"
    | "kling"
    | "voice"
    | "assemble"
    | "upload"
    | "error"
    | "done";
  message: string;
  items?: string[];
};

function loadEnvFromDotEnvLocal() {
  // Next loads env automatically; standalone scripts do not.
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const supabase = createSupabaseService();
  const { error } = await supabase.from("generation_jobs").update(patch).eq("id", jobId);
  if (error) throw new Error(`Failed to update job: ${error.message}`);
}

async function logJobEvent(jobId: string, e: Omit<JobEvent, "ts">) {
  const supabase = createSupabaseService();
  const { error } = await supabase.from("generation_job_events").insert({
    job_id: jobId,
    kind: e.kind,
    message: e.message,
    items: e.items ?? [],
  });
  if (error) throw new Error(`Failed to log job event: ${error.message}`);
}

async function failJob(jobId: string, error: string) {
  await updateJob(jobId, {
    status: "failed",
    error,
    progress: 100,
    finished_at: new Date().toISOString(),
  });
  await logJobEvent(jobId, { kind: "error", message: error });
}

async function succeedJob(jobId: string) {
  await updateJob(jobId, {
    status: "succeeded",
    progress: 100,
    finished_at: new Date().toISOString(),
  });
  await logJobEvent(jobId, { kind: "done", message: "Job succeeded" });
}

async function getPreferences(userId: string): Promise<Preference[]> {
  // Primary: Hyperspell, fallback: Supabase table.
  try {
    const hs = await hyperspellGetPreferences(userId);
    if (hs?.preferences?.length) {
      return hs.preferences.map((p) => ({
        topic: p.topic,
        category: p.category ?? null,
        geographic_scope: p.geographic_scope ?? null,
        priority: p.priority,
      }));
    }
  } catch {
    // ignore; fallback to DB
  }

  const supabase = createSupabaseService();
  const { data } = await supabase
    .from("user_preferences")
    .select("topic, category, geographic_scope, priority")
    .eq("user_id", userId);

  type PrefRow = { topic: string; category: string | null; geographic_scope: string | null; priority: number };
  return ((data ?? []) as PrefRow[]).map((p) => ({
    topic: p.topic,
    category: p.category,
    geographic_scope: p.geographic_scope,
    priority: p.priority,
  }));
}

async function uploadToStorage(bucket: "videos" | "thumbnails", pathInBucket: string, data: Buffer, contentType: string) {
  const supabase = createSupabaseService();
  const { error } = await supabase.storage.from(bucket).upload(pathInBucket, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed (${bucket}/${pathInBucket}): ${error.message}`);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(pathInBucket);
  return urlData.publicUrl;
}

async function runJob(job: JobRow) {
  const supabase = createSupabaseService();

  const update = async (patch: Record<string, unknown>, e?: Omit<JobEvent, "ts">) => {
    if (e) await logJobEvent(job.id, e);
    // Keep payload lightweight: last human-readable message only.
    await updateJob(job.id, { ...patch, payload: e ? { last: e } : job.payload ?? {} });
  };

  await update(
    { status: "running", started_at: new Date().toISOString(), step: "ingest", progress: 3 },
    { kind: "ingest", message: "Starting RSS ingest…" }
  );

  // Step 0: RSS ingest (keeps aggregator alive)
  const ingest = await ingestRss(supabase, { maxItemsPerFeed: 10, fetchFullText: true });
  await update(
    { step: "ingest", progress: 6 },
    {
      kind: "ingest",
      message: `Ingested ${ingest.insertedOrUpdated} items (${ingest.errors.length} feed errors)`,
      items: ingest.sampleHeadlines.slice(0, 10),
    }
  );

  // Step 1: topic identification
  await update({ step: "topics", progress: 10 }, { kind: "topics", message: "Selecting top topics…" });
  const preferences = await getPreferences(job.user_id);
  const topics = pickTopTopics(preferences, 5);

  if (!topics.length) {
    throw new Error("No preferences found for user; complete onboarding first.");
  }
  await update(
    { step: "topics", progress: 12 },
    { kind: "topics", message: "Top topics chosen", items: topics.map((t) => t.topic) }
  );

  // Step 2–5: research -> summarize -> script -> video
  let done = 0;
  for (const pref of topics) {
    done++;
    const baseProgress = 10 + Math.round(((done - 1) / topics.length) * 80);

    await update(
      { step: `research:${pref.topic}`, progress: baseProgress + 5 },
      { kind: "research", message: `Gathering sources for: ${pref.topic}` }
    );
    const research = await buildResearchPackage(supabase, pref.topic, { exaDays: 7, exaNumResults: 12, maxRssArticles: 8 });
    await update(
      { step: `research:${pref.topic}`, progress: baseProgress + 9 },
      {
        kind: "research",
        message: `Collected ${research.sources.length} sources`,
        items: research.sources.slice(0, 6).map((s) => s.title),
      }
    );

    await update(
      { step: `summarize:${pref.topic}`, progress: baseProgress + 12 },
      { kind: "summarize", message: `Writing Axios summary: ${pref.topic}` }
    );
    const axios = await generateAxiosSummary(research);
    await update(
      { step: `summarize:${pref.topic}`, progress: baseProgress + 14 },
      { kind: "summarize", message: `Summary drafted: ${axios.headline}` }
    );

    const { data: summaryRow, error: summaryErr } = await supabase
      .from("summaries")
      .insert({ article_id: null, axios_summary: axios, fact_check_score: null })
      .select("id")
      .single();
    if (summaryErr) throw new Error(`Insert summary failed: ${summaryErr.message}`);

    await update(
      { step: `script:${pref.topic}`, progress: baseProgress + 20 },
      { kind: "script", message: `Writing video script: ${pref.topic}` }
    );
    const script = await generateVideoScript(axios);
    await update(
      { step: `script:${pref.topic}`, progress: baseProgress + 22 },
      { kind: "script", message: `Script ready (${script.scenes.length} scenes)` }
    );

    await update(
      { step: `kling:${pref.topic}`, progress: baseProgress + 35 },
      { kind: "kling", message: `Generating Kling clips (${script.scenes.length} scenes)…` }
    );
    const clips = await generateKlingClips(script);
    await update(
      { step: `kling:${pref.topic}`, progress: baseProgress + 42 },
      { kind: "kling", message: `Kling clips ready`, items: clips.map((c) => `Scene ${c.sceneIndex + 1}`) }
    );

    await update(
      { step: `voice:${pref.topic}`, progress: baseProgress + 50 },
      { kind: "voice", message: "Synthesizing voiceover (ElevenLabs)…" }
    );
    const tts = await elevenlabsTextToSpeech(script.voiceover);
    await update(
      { step: `voice:${pref.topic}`, progress: baseProgress + 54 },
      { kind: "voice", message: `Voiceover ready (${Math.round(tts.audio.byteLength / 1024)} KB)` }
    );

    await update(
      { step: `assemble:${pref.topic}`, progress: baseProgress + 62 },
      { kind: "assemble", message: "Assembling final video (ffmpeg)…" }
    );
    const stitched = await stitchClipsToMp4(
      clips.map((c) => c.url),
      { headlineOverlay: axios.headline, voiceoverMp3: tts.audio }
    );
    await update(
      { step: `assemble:${pref.topic}`, progress: baseProgress + 70 },
      { kind: "assemble", message: `Assembled MP4 (${Math.round(stitched.mp4.byteLength / 1024 / 1024)} MB)` }
    );

    await update(
      { step: `upload:${pref.topic}`, progress: baseProgress + 74 },
      { kind: "upload", message: "Uploading assets to Supabase Storage…" }
    );
    const videoPath = `${job.user_id}/${job.id}/${summaryRow.id}.mp4`;
    const thumbPath = `${job.user_id}/${job.id}/${summaryRow.id}.png`;
    const videoUrl = await uploadToStorage("videos", videoPath, stitched.mp4, "video/mp4");
    const thumbnailUrl = await uploadToStorage("thumbnails", thumbPath, stitched.thumbnailPng, "image/png");
    await update(
      { step: `upload:${pref.topic}`, progress: baseProgress + 78 },
      { kind: "upload", message: "Uploaded", items: [videoUrl, thumbnailUrl].filter(Boolean) as string[] }
    );

    const { data: videoRow, error: videoErr } = await supabase
      .from("videos")
      .insert({
        summary_id: summaryRow.id,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration: 25,
        script: script.voiceover,
        fal_job_id: null,
      })
      .select("id")
      .single();
    if (videoErr) throw new Error(`Insert video failed: ${videoErr.message}`);

    const { error: ucErr } = await supabase.from("user_content").insert({
      user_id: job.user_id,
      video_id: videoRow.id,
      viewed: false,
      view_duration: 0,
      liked: false,
    });
    if (ucErr) throw new Error(`Insert user_content failed: ${ucErr.message}`);
  }
}

async function pollLoop() {
  const supabase = createSupabaseService();
  while (true) {
    const { data: job, error } = await supabase
      .from("generation_jobs")
      .select("id, user_id, status, step, progress, payload")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to poll jobs:", error.message);
      await sleep(2_000);
      continue;
    }

    if (!job) {
      await sleep(2_000);
      continue;
    }

    try {
      await runJob(job as JobRow);
      await succeedJob(job.id);
      console.log(`Job ${job.id} succeeded`);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      console.error(`Job ${job.id} failed:`, msg);
      await failJob(job.id, msg);
    }
  }
}

loadEnvFromDotEnvLocal();

pollLoop().catch((e) => {
  console.error(e);
  process.exit(1);
});

