import Link from "next/link";

export default function AggregatorFeedPage() {
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
            {Array.from({ length: 8 }).map((_, i) => (
              <article
                key={i}
                className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] p-6 shadow-[0_24px_70px_var(--shadow)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                    SOURCE · TIME
                  </div>
                  <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                    TOPIC
                  </div>
                </div>
                <h2 className="mt-3 text-xl tracking-[-0.03em]">
                  Aggregated story headline placeholder {i + 1}
                </h2>
                <p className="mt-2 text-[14px] leading-7 text-[color:var(--muted)]">
                  Snippet from the article… this will be populated from RSS + Exa
                  ingestion.
                </p>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

