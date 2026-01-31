import Exa from "exa-js";
import { getServerEnv } from "@/lib/env/server";

let cached: Exa | null = null;

export function getExa() {
  if (cached) return cached;
  const env = getServerEnv();
  cached = new Exa(env.EXA_API_KEY);
  return cached;
}

export type ExaSource = {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
};

export async function exaSearchNews(topic: string, opts?: { days?: number; numResults?: number }) {
  const exa = getExa();
  const days = opts?.days ?? 7;
  const numResults = opts?.numResults ?? 10;

  const res = await exa.searchAndContents(topic, {
    numResults,
    useAutoprompt: true,
    text: true,
    highlights: false,
    startPublishedDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
  });

  const results = (res?.results ?? []) as unknown[];
  const mapped: ExaSource[] = results
    .map((r) => {
      const obj = r as Record<string, unknown>;
      const url = typeof obj.url === "string" ? obj.url : "";
      const title =
        (typeof obj.title === "string" && obj.title) || url || "Untitled";
      return {
        title,
        url,
        publishedDate: typeof obj.publishedDate === "string" ? obj.publishedDate : undefined,
        author: typeof obj.author === "string" ? obj.author : undefined,
        text: typeof obj.text === "string" ? obj.text : undefined,
      } satisfies ExaSource;
    })
    .filter((r) => typeof r.url === "string" && r.url.length > 0);

  return mapped;
}

