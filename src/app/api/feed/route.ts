import { NextResponse } from "next/server";

import { createSupabaseService } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const supabase = createSupabaseService();

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "50")));
  const q = (url.searchParams.get("q") ?? "").trim();

  let query = supabase
    .from("articles")
    .select("id, headline, content_url, source, published_at, ingested_at, topics, geographic_scope")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (q) query = query.ilike("headline", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

