import { VideoScriptSchema, type VideoScript } from "@/lib/schemas/videoScript";
import { openaiJson } from "@/lib/integrations/openai";
import type { AxiosSummary } from "@/lib/schemas/axios";

export async function generateVideoScript(summary: AxiosSummary): Promise<VideoScript> {
  const system = [
    "You write short-form news video scripts.",
    "Tone: conversational, crisp, not a traditional anchor read.",
    "Target length: 60–80 words of voiceover for ~25 seconds.",
    "Hook within first 3 seconds.",
    "Add scene markers for 3–5 scenes, 5 seconds each.",
    "Include a few punchy text overlays (short phrases) suitable for vertical video.",
    "Return ONLY JSON matching the requested schema.",
  ].join("\n");

  const user = `Use this Axios-style summary:\n\n${JSON.stringify(summary, null, 2)}\n\nReturn JSON with:\n- duration_seconds_target (25)\n- hook\n- voiceover\n- pacing_notes\n- background_music_tone\n- text_overlays (optional)\n- scenes: 3–5 items, each with seconds (5) and description and optional overlay.\n\nThe visuals should be modern, news-appropriate: dynamic motion graphics, relevant b-roll feel, no talking heads, no cheesy stock.\n`;

  const out = await openaiJson(VideoScriptSchema, { system, user }, { temperature: 0.35 });
  return { ...out, duration_seconds_target: 25 };
}

