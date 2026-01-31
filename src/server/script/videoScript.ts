import { VideoScriptSchema, type VideoScript } from "@/lib/schemas/videoScript";
import { openaiJson } from "@/lib/integrations/openai";
import type { AxiosSummary } from "@/lib/schemas/axios";
import { z } from "zod";

// Looser schema to handle model quirks (e.g., seconds as string "5" instead of number 5)
const RawVideoScriptSchema = z.object({
  duration_seconds_target: z.union([z.number(), z.string()]),
  hook: z.string().min(1),
  voiceover: z.string().min(1),
  pacing_notes: z.string().optional(),
  background_music_tone: z.string().optional(),
  text_overlays: z.array(z.string()).optional(),
  scenes: z.array(
    z.object({
      seconds: z.union([z.number(), z.string()]), // Model sometimes returns "5" instead of 5
      description: z.string().min(1),
      overlay: z.string().optional(),
    })
  ),
});

export async function generateVideoScript(summary: AxiosSummary): Promise<VideoScript> {
  const system = [
    "Task: Using the completed research provided, generate short-form video scripts for a direct-to-camera presenter in the style of Mayor Zohran Mamdani—conversational, authentic, like a knowledgeable friend explaining something important to you.",
    "",
    "Presenter style (Mamdani-inspired):",
    "- Speak directly to the viewer as if you're a friend who happens to know a lot about this topic.",
    "- Warm, genuine, approachable—never stiff or anchor-like.",
    "- Confident but not condescending; explain complex ideas simply without dumbing them down.",
    "- Natural speech patterns with occasional pauses for emphasis, not robotic delivery.",
    "- Policy-substantive content delivered through snappy, memorable soundbites.",
    "",
    "Output requirements:",
    "- Each script must be 15–30 seconds of spoken content (approximately 35–75 words).",
    "- Content must be factual, unbiased, and strictly grounded in the research.",
    "- Tone must be engaging and native to TikTok—like a friend catching you up, not a news broadcast.",
    "",
    "Format behavior:",
    "- Output the script as a single spoken paragraph meant to be delivered on-camera.",
    "- Write for natural speech: contractions, conversational phrasing, human rhythm.",
    "- Do not include headings, bullet points, stage directions, emojis, or hashtags.",
    "",
    "Content behavior:",
    "- Start with a strong scroll-stopping hook in the first 1–2 seconds.",
    "- Communicate exactly one primary insight per script.",
    "- Clearly explain why the insight matters in concrete terms.",
    "- End with a strong closing line that lands the point.",
    "- Prioritize clarity, pacing, and momentum over completeness.",
    "",
    "Allowed structures (choose the best fit per topic):",
    "- Pattern-break or counterintuitive opener.",
    "- Rapid context drop (\"here's what just happened and why it matters\").",
    "- Timeline compression (past → now → implication).",
    "- Myth vs reality framing, only if directly supported by the research.",
    "",
    "Constraints:",
    "- No speculation, predictions, or opinionated framing.",
    "- No filler, buzzwords, or generic hype.",
    "- Avoid jargon unless essential; if used, make it instantly understandable.",
    "- One idea only. Short sentences.",
    "",
    "Return ONLY JSON matching the requested schema.",
  ].join("\n");

  const user = [
    "Use this Axios-style summary:",
    JSON.stringify(summary, null, 2),
    "",
    "Return JSON with:",
    "- duration_seconds_target (15-30)",
    "- hook: The scroll-stopping first line the presenter says",
    "- voiceover: The full script as a single spoken paragraph for on-camera delivery",
    "- pacing_notes: Notes on delivery style, pauses, emphasis",
    "- background_music_tone: e.g., 'subtle ambient', 'upbeat but understated'",
    "- text_overlays: 2-4 punchy short phrases that appear on screen during key moments",
    "- scenes: 3–5 items, each with seconds and description of presenter framing/background",
    "",
    "Visual style: Presenter speaking directly to camera in a clean, modern setting. Warm lighting, minimal distractions. Think: trusted friend in their apartment explaining the news, not a TV studio. Occasional subtle motion graphics or text overlays to reinforce key points.",
  ].join("\n");

  const raw = await openaiJson(RawVideoScriptSchema, { system, user }, { temperature: 0.35 });
  
  // Normalize the output (coerce strings to numbers)
  const normalized: VideoScript = {
    duration_seconds_target: 25, // Override to fixed value
    hook: raw.hook,
    voiceover: raw.voiceover,
    pacing_notes: raw.pacing_notes,
    background_music_tone: raw.background_music_tone,
    text_overlays: raw.text_overlays?.slice(0, 8),
    scenes: raw.scenes.slice(0, 6).map((s) => {
      const rawSeconds = typeof s.seconds === "string" ? parseInt(s.seconds, 10) || 5 : s.seconds;
      // Clamp to valid range (1-15)
      const seconds = Math.max(1, Math.min(15, rawSeconds));
      return { seconds, description: s.description, overlay: s.overlay };
    }),
  };

  // Final validation
  return VideoScriptSchema.parse(normalized);
}
