import { AxiosSummarySchema, type AxiosSummary } from "@/lib/schemas/axios";
import { openaiJson } from "@/lib/integrations/openai";
import type { ResearchPackage } from "@/server/research/synthesize";
import { z } from "zod";

// Very loose schema to handle model quirks - we normalize after parsing
const RawAxiosSummarySchema = z.object({
  headline: z.string().min(1),
  lede: z.string().min(1),
  why_it_matters: z.string().min(1),
  key_facts: z.array(z.string()),
  the_big_picture: z.string().min(1),
  what_to_watch: z.any().optional(), // Could be string or array
  sources: z.any(), // Could be array of strings or objects - we'll normalize
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

type RawSource = { title: string; url: string; outlet?: string } | string;

function coerceSources(
  rawSources: RawSource[],
  researchSources: Array<{ title: string; url: string; outlet?: string }>
): AxiosSummary["sources"] {
  return rawSources
    .map((src) => {
      if (typeof src === "object" && src.title && src.url) {
        return { title: src.title, url: src.url, outlet: src.outlet };
      }
      // String source - try to match against research sources or create from string
      const str = typeof src === "string" ? src.trim() : "";
      if (!str) return null;
      
      // Try to find a matching source from the research package
      const match = researchSources.find(
        (rs) =>
          rs.title.toLowerCase().includes(str.toLowerCase()) ||
          str.toLowerCase().includes(rs.title.toLowerCase()) ||
          rs.url.includes(str) ||
          str.includes(rs.url)
      );
      if (match) return match;
      
      // If it looks like a URL, use it directly
      if (str.startsWith("http://") || str.startsWith("https://")) {
        return { title: str, url: str };
      }
      
      // Otherwise, create a placeholder (will be filtered if invalid)
      return null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && !!s.url)
    .slice(0, 12);
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
    "Task: Using the completed research provided, generate an Axios-style newsletter summarizing the most important developments related to the user's interest areas. Produce an Axios-style newsletter that delivers maximum insight per word, feels authoritative and modern, and can be trusted by professional readers.",
    "",
    "Output requirements:",
    "- Generate one newsletter section per user interest area.",
    "- Each section should be concise, skimmable, and high-signal (<100 words).",
    "- Content must be factual, unbiased, and grounded in real, citable information from reputable sources.",
    "- Prioritize what is new, changing, or strategically important.",
    "",
    "Format behavior:",
    "- Write in short paragraphs and compact sentences suitable for email consumption.",
    "- Use clear, direct language optimized for fast scanning.",
    "- Prepend each section with a short, descriptive label for the interest area.",
    "- Do not rely on special formatting, emojis, or visual markup; plain text only.",
    "",
    "Axios-style structure (apply consistently):",
    "- Start with a sharp lead that summarizes the core development in one or two sentences.",
    "- Follow with clearly separated idea blocks that explain:",
    "  - What happened",
    "  - Why it matters",
    "  - What's driving it (data, decisions, or constraints)",
    "- Close with a forward-looking context line that explains implications without speculation.",
    "",
    "Style constraints:",
    "- Highly engaging but restrained; confident, not sensational.",
    "- Neutral and credible, similar to professional news briefings.",
    "- Avoid hype, opinionated framing, or narrative fluff.",
    "- Avoid jargon where possible; explain essential terms succinctly.",
    "",
    "Source behavior:",
    "- Base all claims on reputable, verifiable sources referenced in the research.",
    "- If sources are implied but not explicit, phrase statements conservatively.",
    "- Do not invent statistics, quotes, or attributions.",
    "",
    "Constraints:",
    "- No calls to action.",
    "- No predictions or unsupported forward-looking claims.",
    "- Do not restate research verbatim; synthesize and prioritize.",
    "",
    "Return JSON with keys: headline, lede, why_it_matters, key_facts, the_big_picture, what_to_watch (optional), sources.",
    "Map the content to these keys:",
    "- headline: Short, descriptive label for the interest area (max 80 chars)",
    "- lede: Sharp lead summarizing the core development (1-2 sentences, max 220 chars)",
    "- why_it_matters: Why it matters section (max 420 chars)",
    "- key_facts: Array of 3-5 string bullets describing what happened",
    "- the_big_picture: What's driving it (data, decisions, or constraints, max 520 chars)",
    "- what_to_watch: Array of 1-4 string items for forward-looking context (optional)",
    "- sources: Array of source OBJECTS, each with {title: string, url: string, outlet?: string}. Example: [{\"title\": \"Article Title\", \"url\": \"https://...\", \"outlet\": \"NPR\"}]",
  ].join("\n");

  const user = `Topic: ${pkg.topic}\n\nSources:\n${sourcesText}`;

  const raw = await openaiJson(RawAxiosSummarySchema, { system, user }, { temperature: 0.2 });

  // Coerce sources from strings to objects if needed
  const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
  const coercedSources = coerceSources(rawSources as RawSource[], pkg.sources);
  
  // Fallback: if coercion failed, use first few research sources directly
  const finalSources = coercedSources.length >= 1 
    ? coercedSources 
    : pkg.sources.slice(0, 6).map((s) => ({ title: s.title, url: s.url, outlet: s.outlet }));

  const normalized: AxiosSummary = {
    headline: trimToMax(raw.headline, 80),
    lede: trimToMax(raw.lede, 220),
    why_it_matters: trimToMax(raw.why_it_matters, 420),
    key_facts: raw.key_facts.map((x) => x.trim()).filter(Boolean).slice(0, 6),
    the_big_picture: trimToMax(raw.the_big_picture, 520),
    what_to_watch: coerceWhatToWatch(raw.what_to_watch),
    sources: finalSources,
  };

  // Final strict validation (should always pass after normalization).
  return AxiosSummarySchema.parse(normalized);
}

