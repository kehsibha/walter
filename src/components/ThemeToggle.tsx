"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] p-1">
      {(["light", "system", "dark"] as const).map((t) => {
        const active = theme === t;
        const icon = t === "light" ? "☀" : t === "dark" ? "◐" : "◑";
        const label = t === "light" ? "Light" : t === "dark" ? "Dark" : "System";

        return (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] tracking-[0.12em] transition",
              active
                ? "bg-[color:var(--ink)] text-[color:var(--paper)] shadow-[0_8px_24px_var(--shadow)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--ink2)]",
            ].join(" ")}
            aria-label={`${label} theme`}
            title={`${label} theme`}
          >
            <span className="text-[11px]">{icon}</span>
            <span className="hidden sm:inline">{label.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemeToggleCompact() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const icon = theme === "system" 
    ? "◑" 
    : resolvedTheme === "light" 
      ? "☀" 
      : "◐";

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="h-10 w-10 rounded-full border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] text-[14px] text-[color:var(--muted)] transition hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))] hover:text-[color:var(--ink2)]"
      aria-label="Toggle theme"
      title={`Current: ${theme}`}
    >
      {icon}
    </button>
  );
}
