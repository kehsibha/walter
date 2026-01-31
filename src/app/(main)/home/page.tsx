/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FEEDS } from "@/config/feeds";

type Mode = "video" | "newsletter";

type FeedItem = {
  id: string;
  video?: {
    id: string;
    video_url: string;
    thumbnail_url?: string | null;
    duration?: number | null;
    script?: string | null;
    summaries?: {
      axios_summary: {
        headline?: string;
        lede?: string;
        why_it_matters?: string;
      };
    } | null;
  } | null;
};

type ContentResponse = {
  job?: { id: string; status: string; step?: string | null; progress?: number | null; error?: string | null } | null;
  events?: Array<{ created_at: string; kind: string; message: string; items?: string[] }>;
  items: FeedItem[];
};

function MenuDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[color:color-mix(in_oklab,var(--ink)_35%,transparent)] backdrop-blur-[6px]"
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={-1}
      />

      <aside className="absolute left-0 top-0 h-full w-[min(420px,92vw)] overflow-y-auto border-r border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_88%,transparent)] shadow-[0_40px_120px_var(--shadow)]">
        <div className="relative p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_15%_15%,color-mix(in_oklab,var(--gold)_16%,transparent),transparent_55%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] tracking-[0.26em] text-[color:var(--muted)]">
                MENU
              </div>
              <div className="mt-2 text-balance text-[15px] leading-7 text-[color:var(--ink2)]">
                RSS sources Walter is currently watching.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="h-11 w-11 rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_65%,transparent)] text-[14px] text-[color:var(--muted)] shadow-[0_18px_60px_var(--shadow)] transition hover:-translate-y-[1px] hover:text-[color:var(--ink2)]"
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>

          <div className="relative mt-6 rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_65%,transparent)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                SOURCES
              </div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted)]">
                {FEEDS.length} FEEDS
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {FEEDS.map((f) => (
                <a
                  key={f.url}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_72%,transparent)] p-4 transition hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[13px] tracking-[0.08em] text-[color:var(--ink2)]">
                      {f.name}
                    </div>
                    <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted)] opacity-80 group-hover:opacity-100">
                      OPEN ↗
                    </div>
                  </div>
                  <div className="mt-1 break-all text-[12px] leading-6 text-[color:var(--muted)]">
                    {f.url}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2">
            <Link
              href="/feed"
              onClick={onClose}
              className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_60%,transparent)] px-4 py-2 text-[12px] tracking-[0.18em] text-[color:var(--ink2)] hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))]"
            >
              VIEW AGGREGATOR FEED →
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_72%,transparent)] px-4 py-2 text-[12px] tracking-[0.18em] text-[color:var(--muted)] hover:text-[color:var(--ink2)]"
            >
              SETTINGS
            </Link>
          </div>

          <div className="relative mt-6 text-[12px] leading-6 text-[color:var(--muted)]">
            Tip: this list comes from <span className="text-[color:var(--ink2)]">`src/config/feeds.ts`</span>.
          </div>
        </div>
      </aside>
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (v: Mode) => void;
}) {
  return (
    <div className="flex items-center rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] p-1">
      {(["video", "newsletter"] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={[
              "rounded-full px-3 py-1.5 text-[12px] tracking-[0.2em] transition",
              active
                ? "bg-[color:var(--ink)] text-[color:var(--paper)] shadow-[0_14px_40px_var(--shadow)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--ink2)]",
            ].join(" ")}
          >
            {m.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function VideoDeck({
  items,
  job,
  events,
  onGenerate,
}: {
  items: FeedItem[];
  job: ContentResponse["job"];
  events: ContentResponse["events"];
  onGenerate: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ y: number; t: number } | null>(null);

  const current = items[index];
  const total = items.length;

  const clampIndex = (i: number) => Math.max(0, Math.min(total - 1, i));

  const go = (delta: number) => setIndex((i) => clampIndex(i + delta));

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (Math.abs(e.deltaY) < 30) return;
    go(e.deltaY > 0 ? 1 : -1);
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchRef.current = { y: e.touches[0].clientY, t: Date.now() };
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const t0 = touchRef.current;
    touchRef.current = null;
    if (!t0) return;
    const y1 = e.changedTouches[0].clientY;
    const dy = y1 - t0.y;
    const dt = Math.max(1, Date.now() - t0.t);
    const v = Math.abs(dy) / dt;
    if (Math.abs(dy) < 42 || v < 0.25) return;
    go(dy < 0 ? 1 : -1);
  };

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative h-[78vh] w-full overflow-hidden rounded-[28px] border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_65%,transparent)] shadow-[0_40px_120px_var(--shadow)]"
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_70%_20%,color-mix(in_oklab,var(--gold)_14%,transparent),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_30%_90%,color-mix(in_oklab,var(--ink)_10%,transparent),transparent_62%)]" />
      </div>

      {!current?.video ? (
        <div className="absolute inset-0 flex items-center justify-center p-10">
          <div className="w-full max-w-md rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_70%,transparent)] p-6 shadow-[0_40px_120px_var(--shadow)]">
            <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
              RESEARCHING YOUR NEWS
            </div>
            <div className="mt-3 text-[15px] leading-7 text-[color:var(--ink2)]">
              {job?.status === "running" || job?.status === "queued"
                ? `Step: ${job?.step ?? "..."}` 
                : "No videos yet. Trigger generation to create your first 4–5 stories."}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="text-[12px] tracking-[0.18em] text-[color:var(--muted)]">
                {job?.status ? job.status.toUpperCase() : "IDLE"} {job?.progress != null ? `· ${job.progress}%` : ""}
              </div>
              <button
                type="button"
                onClick={onGenerate}
                className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-[12px] tracking-[0.18em] text-[color:var(--paper)] shadow-[0_18px_50px_var(--shadow)]"
              >
                GENERATE
              </button>
            </div>
            {job?.error ? (
              <div className="mt-4 text-[13px] leading-6 text-[color:var(--muted)]">
                Error: {job.error}
              </div>
            ) : null}

            {events?.length ? (
              <div className="mt-5">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted)]">
                  WHAT WE’RE LOOKING AT
                </div>
                <div className="mt-3 max-h-[240px] space-y-2 overflow-auto pr-1">
                  {events.slice(-12).map((e, idx) => (
                    <div
                      key={`${e.created_at}-${idx}`}
                      className="rounded-2xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_65%,transparent)] p-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted)]">
                          {e.kind.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-[color:var(--muted)]">
                          {new Date(e.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="mt-1 text-[13px] leading-6 text-[color:var(--ink2)]">
                        {e.message}
                      </div>
                      {e.items?.length ? (
                        <div className="mt-2 space-y-1 text-[12px] leading-6 text-[color:var(--muted)]">
                          {e.items.slice(0, 4).map((it) => (
                            <div key={it} className="truncate">
                              — {it}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {current?.video ? (
        <div className="absolute inset-0">
          <video
            key={current.video.id}
            src={current.video.video_url}
            className="h-full w-full object-cover"
            playsInline
            muted={false}
            controls={false}
            autoPlay
            loop
          />
        </div>
      ) : null}

      <div className="absolute bottom-6 left-6 right-20">
        {current?.video?.summaries?.axios_summary ? (
          <>
            <div className="text-balance text-2xl tracking-[-0.03em] sm:text-3xl">
              {current.video.summaries.axios_summary.headline}
            </div>
            <div className="mt-2 max-w-[62ch] text-[14px] leading-6 text-[color:var(--muted)]">
              {current.video.summaries.axios_summary.lede}
            </div>
          </>
        ) : (
          <>
            <div className="text-balance text-2xl tracking-[-0.03em] sm:text-3xl">
              Your personalized feed
            </div>
            <div className="mt-2 max-w-[62ch] text-[14px] leading-6 text-[color:var(--muted)]">
              Generate content to populate videos and Axios-style summaries.
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col items-center gap-3">
        <button
          type="button"
          className="h-11 w-11 rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_75%,transparent)] shadow-[0_20px_60px_var(--shadow)] transition hover:-translate-y-[1px]"
          aria-label="Like"
          title="Like"
        >
          <span className="block text-[14px]">★</span>
        </button>
        <button
          type="button"
          className="h-11 w-11 rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_75%,transparent)] shadow-[0_20px_60px_var(--shadow)] transition hover:-translate-y-[1px]"
          aria-label="Bookmark"
          title="Bookmark"
        >
          <span className="block text-[14px]">⟡</span>
        </button>
        <button
          type="button"
          className="h-11 w-11 rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_75%,transparent)] shadow-[0_20px_60px_var(--shadow)] transition hover:-translate-y-[1px]"
          aria-label="Share"
          title="Share"
        >
          <span className="block text-[14px]">↗</span>
        </button>
      </div>

      <div className="absolute right-5 top-5 flex flex-col items-end gap-2">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted)]">
          {index + 1}/{total}
        </div>
        <div className="flex gap-1.5">
          {items.map((it, i) => (
            <div
              key={it.id}
              className={[
                "h-1.5 w-1.5 rounded-full",
                i === index
                  ? "bg-[color:var(--gold)]"
                  : "bg-[color:var(--hairline)]",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Newsletter({ items }: { items: FeedItem[] }) {
  return (
    <div className="grid gap-4">
      {items.map((it) => (
        <article
          key={it.id}
          className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_60%,transparent)] p-6 shadow-[0_24px_70px_var(--shadow)]"
        >
          <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
            SUMMARY
          </div>
          <h2 className="mt-3 text-2xl tracking-[-0.03em]">
            {it.video?.summaries?.axios_summary?.headline ?? "Pending"}
          </h2>
          <p className="mt-2 text-[14px] leading-7 text-[color:var(--muted)]">
            {it.video?.summaries?.axios_summary?.why_it_matters ??
              "Generate content to create your first newsletter items."}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-[12px] tracking-[0.18em] text-[color:var(--paper)] shadow-[0_18px_50px_var(--shadow)]"
            >
              EXPAND
            </button>
            <span className="text-[12px] tracking-[0.18em] text-[color:var(--muted)]">
              ~2 min read
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function HomeFeedPage() {
  const [mode, setMode] = useState<Mode>("video");
  const [data, setData] = useState<ContentResponse | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = useMemo(() => data?.items ?? [], [data]);

  const load = async () => {
    const res = await fetch("/api/content", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as ContentResponse;
    setData(json);
  };

  const generate = async () => {
    await fetch("/api/generate-content", { method: "POST" });
    await load();
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] px-3 py-2 text-[12px] tracking-[0.2em] text-[color:var(--muted)]"
              aria-label="Menu"
              title="Menu"
            >
              ≡
            </button>
            <div className="text-[13px] tracking-[0.22em] text-[color:var(--muted)]">
              WALTER
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <ModeToggle value={mode} onChange={setMode} />
            <Link
              href="/onboarding"
              className="text-[13px] text-[color:var(--muted)] underline decoration-[color:var(--hairline)] underline-offset-4 hover:text-[color:var(--ink2)]"
            >
              Update preferences
            </Link>
          </div>
        </header>

        <main className="mt-8">
          {mode === "video" ? (
            <VideoDeck
              items={items.length ? items : [{ id: "empty", video: null }]}
              job={data?.job ?? null}
              events={data?.events ?? []}
              onGenerate={generate}
            />
          ) : (
            <Newsletter items={items} />
          )}

          <div className="mt-6 text-[12px] tracking-[0.18em] text-[color:var(--muted)]">
            Tip: run the worker with `npm run worker` to process queued jobs.
          </div>
        </main>
      </div>
    </div>
  );
}

