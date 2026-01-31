import Parser from "rss-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEEDS, type RssFeed } from "@/config/feeds";

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
};

const parser = new Parser<Record<string, never>, RssItem>({
  timeout: 20_000,
});

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    // keep query (some outlets put tracking here) but trim common trackers
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) =>
      u.searchParams.delete(k)
    );
    return u.toString();
  } catch {
    return url;
  }
}

async function extractArticleText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) WalterDemo/0.1 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article?.textContent) return null;
  const text = article.textContent.replace(/\s+\n/g, "\n").trim();
  return text.length > 200 ? text : null;
}

export async function ingestRss(
  supabase: SupabaseClient,
  opts?: { maxItemsPerFeed?: number; fetchFullText?: boolean; feeds?: RssFeed[] }
) {
  const feeds = opts?.feeds ?? FEEDS;
  const maxItems = opts?.maxItemsPerFeed ?? 12;
  const fetchFullText = opts?.fetchFullText ?? true;

  let insertedOrUpdated = 0;
  const errors: Array<{ feed: string; error: string }> = [];
  const sampleHeadlines: string[] = [];

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items ?? []).slice(0, maxItems);

      for (const item of items) {
        const title = (item.title ?? "").trim();
        const link = item.link ? normalizeUrl(item.link) : null;
        if (!title || !link) continue;

        const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : null;

        const fullText =
          fetchFullText && link
            ? await extractArticleText(link).catch(() => null)
            : null;

        const { error } = await supabase
          .from("articles")
          .upsert(
            {
              headline: title,
              content_url: link,
              source: feed.name,
              published_at: publishedAt,
              full_text: fullText,
              topics: [],
              geographic_scope: null,
            },
            { onConflict: "content_url" }
          );

        if (!error) {
          insertedOrUpdated++;
          if (sampleHeadlines.length < 12) {
            sampleHeadlines.push(`${feed.name}: ${title}`);
          }
        }
      }
    } catch (e) {
      errors.push({ feed: feed.name, error: (e as Error).message });
    }
  }

  return { insertedOrUpdated, errors, sampleHeadlines };
}

