import Link from "next/link";
import { createSupabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Article = {
  id: string;
  headline: string;
  content_url: string;
  source: string;
  published_at: string | null;
  ingested_at: string;
  topics: string[];
  geographic_scope: string | null;
  full_text: string | null;
};

function excerpt(text: string | null, max = 240) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/[,\s]+$/g, "")}…`;
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function AggregatorFeedPage() {
  const supabase = createSupabaseService();

  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, headline, content_url, source, published_at, ingested_at, topics, geographic_scope, full_text"
    )
    .order("published_at", { ascending: false })
    .limit(60);

  const items = (data ?? []) as Article[];
  const loadError = error?.message ?? null;

  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link
              href="/home"
              className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] px-3 py-2 text-[12px] tracking-[0.2em] text-[color:var(--muted)]"
            >
              ← HOME
            </Link>
            <div className="text-[13px] tracking-[0.22em] text-[color:var(--muted)]">
              AGGREGATOR
            </div>
          </div>
          <Link
            href="/onboarding"
            className="text-[13px] text-[color:var(--muted)] underline decoration-[color:var(--hairline)] underline-offset-4 hover:text-[color:var(--ink2)]"
          >
            Update preferences
          </Link>
        </header>

        <main className="mt-8">
          <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_60%,transparent)] p-6 shadow-[0_24px_70px_var(--shadow)]">
            <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
              FILTERS
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Past 24h", "Past 7d", "Local", "National", "International"].map(
                (label) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_70%,transparent)] px-4 py-2 text-[12px] tracking-[0.14em] text-[color:var(--ink2)] hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))]"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {loadError ? (
              <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] p-6 text-[14px] leading-7 text-[color:var(--muted)] shadow-[0_24px_70px_var(--shadow)]">
                Couldn’t load articles right now.
                <div className="mt-2 text-[12px] tracking-[0.08em] text-[color:var(--muted)]">
                  {loadError}
                </div>
              </div>
            ) : null}

            {!loadError && items.length === 0 ? (
              <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] p-6 text-[14px] leading-7 text-[color:var(--muted)] shadow-[0_24px_70px_var(--shadow)]">
                No articles yet.
                <div className="mt-2 text-[12px] tracking-[0.12em] text-[color:var(--muted)]">
                  Once RSS ingestion runs, they’ll show up here automatically.
                </div>
              </div>
            ) : null}

            {items.map((it) => {
              const stamp = formatStamp(it.published_at ?? it.ingested_at);
              const snippet = excerpt(it.full_text);
              const tag = it.topics?.[0] ?? it.geographic_scope ?? null;

              return (
                <article
                  key={it.id}
                  className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] p-6 shadow-[0_24px_70px_var(--shadow)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                      {it.source.toUpperCase()}
                      {stamp ? ` · ${stamp}` : ""}
                    </div>
                    {tag ? (
                      <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                        {tag.toUpperCase()}
                      </div>
                    ) : null}
                  </div>

                  <a
                    href={it.content_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group mt-3 block"
                  >
                    <h2 className="text-xl tracking-[-0.03em] group-hover:underline decoration-[color:color-mix(in_oklab,var(--gold)_60%,transparent)] underline-offset-4">
                      {it.headline}
                    </h2>
                  </a>

                  {snippet ? (
                    <p className="mt-2 text-[14px] leading-7 text-[color:var(--muted)]">
                      {snippet}
                    </p>
                  ) : (
                    <div className="mt-2 text-[12px] tracking-[0.14em] text-[color:var(--muted)]">
                      {hostLabel(it.content_url)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

