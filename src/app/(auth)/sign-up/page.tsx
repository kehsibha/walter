import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] tracking-[0.22em] text-[color:var(--muted)]"
          >
            WALTER
          </Link>
          <Link
            href="/sign-in"
            className="text-[13px] text-[color:var(--ink2)] underline decoration-[color:var(--hairline)] underline-offset-4 hover:decoration-[color:color-mix(in_oklab,var(--gold)_45%,var(--hairline))]"
          >
            Sign in
          </Link>
        </header>

        <h1 className="mt-10 text-3xl tracking-[-0.03em]">Create account</h1>
        <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">
          We’ll send a verification email (Supabase) before your account is fully
          active.
        </p>

        <form className="mt-8 space-y-4">
          <label className="block">
            <div className="text-[12px] tracking-[0.2em] text-[color:var(--muted)]">
              EMAIL
            </div>
            <input
              type="email"
              name="email"
              placeholder="you@domain.com"
              className="mt-2 w-full rounded-2xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] px-4 py-3 text-[15px] outline-none focus:border-[color:color-mix(in_oklab,var(--gold)_55%,var(--hairline))]"
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <div className="text-[12px] tracking-[0.2em] text-[color:var(--muted)]">
              PASSWORD
            </div>
            <input
              type="password"
              name="password"
              placeholder="••••••••••••"
              className="mt-2 w-full rounded-2xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] px-4 py-3 text-[15px] outline-none focus:border-[color:color-mix(in_oklab,var(--gold)_55%,var(--hairline))]"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>

          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-[color:var(--ink)] px-5 py-3 text-[14px] tracking-wide text-[color:var(--paper)] shadow-[0_18px_50px_var(--shadow)] transition hover:-translate-y-[1px]"
          >
            Create account
          </button>
        </form>

        <div className="mt-6 text-[13px] leading-6 text-[color:var(--muted)]">
          Public demo mode: account creation is disabled. Continue to onboarding.
        </div>
      </div>
    </div>
  );
}

