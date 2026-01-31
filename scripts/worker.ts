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
import { generateTalkingAnchorClips, KLING_VOICE_IDS } from "@/server/video/klingAnchor";

/**
 * Video generation mode:
 * - "scenes": Generate visual scene clips + ElevenLabs voiceover (original approach)
 * - "anchor": Generate talking anchor with Kling lipsync + built-in TTS (no ElevenLabs needed)
 */
const VIDEO_MODE: "scenes" | "anchor" = (process.env.VIDEO_MODE as "scenes" | "anchor") || "anchor";

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

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:runJob:entry',message:'runJob started',data:{jobId:job.id,userId:job.user_id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
  // #endregion

  // Note: status already set to "running" by pollLoop's atomic claim
  await update(
    { step: "ingest", progress: 3 },
    { kind: "ingest", message: "Starting RSS ingest…" }
  );

  // Step 0: RSS ingest (keeps aggregator alive)
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:ingestRss:before',message:'Calling ingestRss',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const ingest = await ingestRss(supabase, { maxItemsPerFeed: 10, fetchFullText: true });
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:ingestRss:after',message:'ingestRss completed',data:{inserted:ingest.insertedOrUpdated,errors:ingest.errors.length,sampleHeadlines:ingest.sampleHeadlines.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  await update(
    { step: "ingest", progress: 6 },
    {
      kind: "ingest",
      message: `Scanning ${ingest.insertedOrUpdated} new stories from your feeds`,
      items: ingest.sampleHeadlines.slice(0, 10),
    }
  );

  // Step 1: topic identification
  await update({ step: "topics", progress: 10 }, { kind: "topics", message: "Identifying the most important trends for you…" });
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:getPreferences:before',message:'Fetching preferences',data:{userId:job.user_id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const preferences = await getPreferences(job.user_id);
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:getPreferences:after',message:'Preferences fetched',data:{preferencesCount:preferences.length,preferences:preferences.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const topics = pickTopTopics(preferences, 5);
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:pickTopTopics:after',message:'Topics selected',data:{topicsCount:topics.length,topics:topics.map(t=>t.topic)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  if (!topics.length) {
    throw new Error("No preferences found for user; complete onboarding first.");
  }
  await update(
    { step: "topics", progress: 12 },
    { kind: "topics", message: "Curated a custom list of topics to explore", items: topics.map((t) => t.topic) }
  );

  // Step 2–5: research -> summarize -> script -> video
  let done = 0;
  for (const pref of topics) {
    done++;
    const baseProgress = 10 + Math.round(((done - 1) / topics.length) * 80);

    await update(
      { step: `research:${pref.topic}`, progress: baseProgress + 5 },
      { kind: "research", message: `Deep diving into: ${pref.topic}` }
    );
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:buildResearchPackage:before',message:'Calling buildResearchPackage',data:{topic:pref.topic,topicIdx:done},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const research = await buildResearchPackage(supabase, pref.topic, { exaDays: 7, exaNumResults: 12, maxRssArticles: 8 });
    
    // Count Exa sources (those without an outlet)
    const exaCount = research.sources.filter(s => !s.outlet).length;
    const rssCount = research.sources.length - exaCount;

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:buildResearchPackage:after',message:'Research package built',data:{topic:pref.topic,sourcesCount:research.sources.length,exaCount,rssCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    await update(
      { step: `research:${pref.topic}`, progress: baseProgress + 9 },
      {
        kind: "research",
        message: `Analyzing ${research.sources.length} primary sources (${exaCount} from research, ${rssCount} from news)`,
        items: research.sources.slice(0, 6).map((s) => s.title),
      }
    );

    await update(
      { step: `summarize:${pref.topic}`, progress: baseProgress + 12 },
      { kind: "summarize", message: `Synthesizing key insights for: ${pref.topic}` }
    );
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:generateAxiosSummary:before',message:'Calling generateAxiosSummary',data:{topic:pref.topic},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const axios = await generateAxiosSummary(research);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:generateAxiosSummary:after',message:'Axios summary generated',data:{topic:pref.topic,headline:axios.headline},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    await update(
      { step: `summarize:${pref.topic}`, progress: baseProgress + 14 },
      { kind: "summarize", message: `Drafted: ${axios.headline}` }
    );

    const { data: summaryRow, error: summaryErr } = await supabase
      .from("summaries")
      .insert({ article_id: null, axios_summary: axios, fact_check_score: null })
      .select("id")
      .single();
    if (summaryErr) throw new Error(`Insert summary failed: ${summaryErr.message}`);

    await update(
      { step: `script:${pref.topic}`, progress: baseProgress + 20 },
      { kind: "script", message: `Crafting the narrative for: ${pref.topic}` }
    );
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:generateVideoScript:before',message:'Calling generateVideoScript',data:{topic:pref.topic,headline:axios.headline},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const script = await generateVideoScript(axios);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:generateVideoScript:after',message:'Video script generated',data:{topic:pref.topic,scenesCount:script.scenes.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    await update(
      { step: `script:${pref.topic}`, progress: baseProgress + 22 },
      { kind: "script", message: `Story script finalized with ${script.scenes.length} scenes` }
    );

    let stitched: { mp4: Buffer; thumbnailPng: Buffer };

    if (VIDEO_MODE === "anchor") {
      // Anchor mode: Generate talking anchor with Kling lipsync (no ElevenLabs needed)
      await update(
        { step: `kling:${pref.topic}`, progress: baseProgress + 35 },
        { kind: "kling", message: `Generating news anchor presentation…` }
      );

      const anchorResult = await generateTalkingAnchorClips(script.voiceover, {
        voiceId: KLING_VOICE_IDS.uk_man,
        voiceSpeed: 0.95,
        aspectRatio: "16:9",
        gender: "male",
        onStatus: (status) => {
          // Log progress but don't await DB updates for each status
          console.log(`[anchor] ${status.step}: ${status.message}`);
        },
      });

      await update(
        { step: `kling:${pref.topic}`, progress: baseProgress + 50 },
        { kind: "kling", message: `Anchor recorded ${anchorResult.clips.length} segments` }
      );

      await update(
        { step: `assemble:${pref.topic}`, progress: baseProgress + 62 },
        { kind: "assemble", message: "Assembling the final presentation…" }
      );

      // Stitch anchor clips (audio is already baked in, no separate voiceover needed)
      stitched = await stitchClipsToMp4(
        anchorResult.clips.map((c) => c.url),
        { headlineOverlay: axios.headline }
      );

      await update(
        { step: `assemble:${pref.topic}`, progress: baseProgress + 70 },
        { kind: "assemble", message: `Presentation assembled` }
      );
    } else {
      // Scene mode: Original approach with visual scenes + ElevenLabs voiceover
      await update(
        { step: `kling:${pref.topic}`, progress: baseProgress + 35 },
        { kind: "kling", message: `Generating cinematic visuals for ${script.scenes.length} scenes…` }
      );
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:generateKlingClips:before',message:'Calling generateKlingClips',data:{topic:pref.topic,scenesCount:script.scenes.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const clips = await generateKlingClips(script);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:generateKlingClips:after',message:'Kling clips generated',data:{topic:pref.topic,clipsCount:clips.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      await update(
        { step: `kling:${pref.topic}`, progress: baseProgress + 42 },
        { kind: "kling", message: `Visuals ready`, items: clips.map((c) => `Scene ${c.sceneIndex + 1}`) }
      );

      await update(
        { step: `voice:${pref.topic}`, progress: baseProgress + 50 },
        { kind: "voice", message: "Recording the voiceover…" }
      );
      const tts = await elevenlabsTextToSpeech(script.voiceover);
      await update(
        { step: `voice:${pref.topic}`, progress: baseProgress + 54 },
        { kind: "voice", message: `Voiceover complete` }
      );

      await update(
        { step: `assemble:${pref.topic}`, progress: baseProgress + 62 },
        { kind: "assemble", message: "Editing and assembling the final story…" }
      );
      stitched = await stitchClipsToMp4(
        clips.map((c) => c.url),
        { headlineOverlay: axios.headline, voiceoverMp3: tts.audio }
      );
      await update(
        { step: `assemble:${pref.topic}`, progress: baseProgress + 70 },
        { kind: "assemble", message: `Story assembly finished` }
      );
    }

    await update(
      { step: `upload:${pref.topic}`, progress: baseProgress + 74 },
      { kind: "upload", message: "Finalizing and preparing for playback…" }
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
    // First, find the oldest queued job
    const { data: queuedJob, error: findError } = await supabase
      .from("generation_jobs")
      .select("id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Failed to find job:", findError.message);
      await sleep(2_000);
      continue;
    }

    if (!queuedJob) {
      await sleep(2_000);
      continue;
    }

    // Atomically claim the job by updating status from "queued" to "running"
    // Only succeeds if the job is still "queued" (prevents race conditions)
    const { data: claimedJobs, error: claimError } = await supabase
      .from("generation_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", queuedJob.id)
      .eq("status", "queued") // Only claim if still queued
      .select("id, user_id, status, step, progress, payload");

    if (claimError) {
      console.error("Failed to claim job:", claimError.message);
      await sleep(2_000);
      continue;
    }

    const job = claimedJobs?.[0];
    if (!job) {
      // Another worker claimed it first, try again
      continue;
    }

    console.log(`Claimed job ${job.id}, starting...`);

    try {
      await runJob(job as JobRow);
      await succeedJob(job.id);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:pollLoop:success',message:'Job completed successfully',data:{jobId:job.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
      // #endregion
      console.log(`Job ${job.id} succeeded`);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      const stack = (e as Error).stack ?? '';
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.ts:pollLoop:error',message:'Job FAILED',data:{jobId:job.id,errorMessage:msg,errorStack:stack.slice(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
      // #endregion
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

