import { AxiosSummarySchema, type AxiosSummary } from "@/lib/schemas/axios";
import { openaiJson } from "@/lib/integrations/openai";
import type { ResearchPackage } from "@/server/research/synthesize";
import { z } from "zod";

const RawAxiosSummarySchema = AxiosSummarySchema.extend({
  // The model sometimes runs long; we'll safely trim to spec before final validation.
  lede: z.string().min(1).max(600),
  // The model sometimes returns a single string instead of an array.
  what_to_watch: z.union([z.array(z.string().min(1)).max(12), z.string().min(1).max(600)]).optional(),
});

function trimToMax(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function coerceWhatToWatch(
  input: AxiosSummary["what_to_watch"] | string | undefined
): AxiosSummary["what_to_watch"] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) {
    const cleaned = input.map((x) => x.trim()).filter(Boolean).slice(0, 4);
    return cleaned.length ? cleaned : undefined;
  }
  // Split common formats: newline bullets, semicolons, commas.
  const parts = input
    .split(/\n+|•|\u2022|;|,|-/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
  return parts.length ? parts : undefined;
}

export async function generateAxiosSummary(pkg: ResearchPackage): Promise<AxiosSummary> {
  const sourcesText = pkg.sources
    .map((s, i) => {
      const outlet = s.outlet ? ` (${s.outlet})` : "";
      return `${i + 1}. ${s.title}${outlet}\n${s.url}\n${(s.excerpt ?? s.full_text ?? "")
        .slice(0, 700)
        .replace(/\s+/g, " ")
        .trim()}`;
    })
    .join("\n\n");

  const system = [
    "You are a careful news editor. Be factual, concise, and non-partisan.",
    "Write in an Axios-style format: scannable, direct, with clear sections.",
    "Avoid sensational language. Do not invent facts not supported by the sources text.",
    "If sources disagree, reflect that as 'what we know' vs 'what's disputed'.",
    "Return JSON with keys: headline, lede, why_it_matters, key_facts, the_big_picture, what_to_watch (optional), sources.",
    "Constraints:",
    "- headline <= 10 words",
    "- lede must be ONE sentence, <= 220 characters",
    "- total length about 150–220 words",
    "- key_facts: 3–5 bullets",
    "- what_to_watch must be an ARRAY of 1–2 short bullets, or omit the field",
    "- sources: include 3–8 entries with title+url (+ outlet when known)",
  ].join("\n");

  const user = `Topic: ${pkg.topic}\n\nSources:\n${sourcesText}`;

  const raw = await openaiJson(RawAxiosSummarySchema, { system, user }, { temperature: 0.2 });

  const normalized: AxiosSummary = {
    headline: trimToMax(raw.headline, 80),
    lede: trimToMax(raw.lede, 220),
    why_it_matters: trimToMax(raw.why_it_matters, 420),
    key_facts: raw.key_facts.map((x) => x.trim()).filter(Boolean).slice(0, 6),
    the_big_picture: trimToMax(raw.the_big_picture, 520),
    what_to_watch: coerceWhatToWatch(raw.what_to_watch),
    sources: raw.sources.slice(0, 12),
  };

  // Final strict validation (should always pass after normalization).
  return AxiosSummarySchema.parse(normalized);
}

