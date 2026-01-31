import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";

export default function SettingsPage() {
  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] px-3 py-2 text-[12px] tracking-[0.2em] text-[color:var(--muted)]"
          >
            ← HOME
          </Link>
          <div className="text-[13px] tracking-[0.22em] text-[color:var(--muted)]">
            SETTINGS
          </div>
        </header>

        <main className="mt-8 space-y-4">
          <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_60%,transparent)] p-6 shadow-[0_24px_70px_var(--shadow)]">
            <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
              ACCOUNT
            </div>
            <form action={signOutAction} className="mt-4">
              <button
                type="submit"
                className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-[12px] tracking-[0.18em] text-[color:var(--paper)] shadow-[0_18px_50px_var(--shadow)]"
              >
                LOG OUT
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

