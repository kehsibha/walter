import type { SupabaseClient } from "@supabase/supabase-js";
import { exaSearchNews, type ExaSource } from "@/lib/integrations/exa";

export type ResearchSource = {
  title: string;
  url: string;
  outlet?: string;
  published_at?: string | null;
  excerpt?: string | null;
  full_text?: string | null;
};

export type ResearchPackage = {
  topic: string;
  sources: ResearchSource[];
  notes: string;
};

type ArticleRow = {
  headline: string;
  content_url: string;
  source: string;
  published_at: string | null;
  full_text: string | null;
};

export async function buildResearchPackage(
  supabase: SupabaseClient,
  topic: string,
  opts?: { exaDays?: number; exaNumResults?: number; maxRssArticles?: number }
): Promise<ResearchPackage> {
  const exaSources: ExaSource[] = await exaSearchNews(topic, {
    days: opts?.exaDays ?? 7,
    numResults: opts?.exaNumResults ?? 10,
  });

  const { data: rssArticles } = await supabase
    .from("articles")
    .select("headline, content_url, source, published_at, full_text")
    .order("published_at", { ascending: false })
    .limit(opts?.maxRssArticles ?? 10);

  const merged: ResearchSource[] = [];
  const seen = new Set<string>();

  for (const exa of exaSources) {
    if (!exa.url || seen.has(exa.url)) continue;
    merged.push({
      title: exa.title,
      url: exa.url,
      published_at: exa.publishedDate ?? null,
      excerpt: exa.text ? exa.text.slice(0, 420) : null,
      full_text: exa.text ?? null,
    });
    seen.add(exa.url);
  }

  for (const a of (rssArticles ?? []) as ArticleRow[]) {
    const url = a.content_url;
    if (!url || seen.has(url)) continue;
    merged.push({
      title: a.headline,
      url,
      outlet: a.source,
      published_at: a.published_at ?? null,
      excerpt: a.full_text ? String(a.full_text).slice(0, 420) : null,
      full_text: a.full_text ?? null,
    });
    seen.add(url);
  }

  return {
    topic,
    sources: merged.slice(0, 20),
    notes:
      "This research package aggregates diverse sources. Summaries should separate verifiable facts from speculation and avoid loaded language.",
  };
}

