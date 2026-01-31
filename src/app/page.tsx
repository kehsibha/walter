import Link from "next/link";
import { ThemeToggleCompact } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <div className="text-[13px] tracking-[0.22em] text-[color:var(--muted)]">
              WALTER
            </div>
            <div className="h-[1px] w-10 bg-[color:var(--hairline)]" />
            <div className="hidden sm:block text-[13px] text-[color:var(--muted)]">
              trustworthy news, personalized
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggleCompact />
            <Link
              href="/sign-in"
              className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper)_70%,transparent)] px-4 py-2 text-[13px] tracking-wide text-[color:var(--ink2)] shadow-[0_12px_30px_var(--shadow)] transition hover:-translate-y-[1px] hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))]"
            >
              Sign in
            </Link>
          </div>
        </header>

        <section className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <h1 className="text-balance text-4xl leading-[1.06] tracking-[-0.03em] sm:text-6xl">
              News, distilled.
              <span className="block text-[color:color-mix(in_oklab,var(--gold2)_80%,var(--ink))]">
                With receipts.
              </span>
            </h1>
            <p className="mt-5 max-w-[52ch] text-pretty text-[15px] leading-7 text-[color:var(--muted)] sm:text-[16px]">
              Walter takes your interests, surveys sources, cross-checks claims,
              and delivers short videos you can actually trust.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/onboarding"
                className="group inline-flex items-center justify-between rounded-full bg-[color:var(--ink)] px-5 py-3 text-[14px] tracking-wide text-[color:var(--paper)] shadow-[0_18px_50px_var(--shadow)] transition hover:-translate-y-[1px]"
              >
                Get started
                <span className="ml-4 inline-block translate-x-0 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100">
                  →
                </span>
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--hairline)] px-5 py-3 text-[14px] tracking-wide text-[color:var(--ink2)] transition hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))]"
              >
                View demo feed
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_70%,transparent)] p-6 shadow-[0_30px_80px_var(--shadow)]">
            <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
              HOW IT READS
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--paper)] p-4">
                <div className="text-[13px] tracking-wide text-[color:var(--muted)]">
                  Why it matters
                </div>
                <div className="mt-1 text-[15px] leading-6">
                  You get the facts, the context, and what to watch—without the
                  editorial fog.
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--paper)] p-4">
                <div className="text-[13px] tracking-wide text-[color:var(--muted)]">
                  Key facts
                </div>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-[14px] leading-6 text-[color:var(--ink2)]">
                  <li>Multiple sources, not one narrator.</li>
                  <li>Claims separated from opinion.</li>
                  <li>Links to primary documents when possible.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
