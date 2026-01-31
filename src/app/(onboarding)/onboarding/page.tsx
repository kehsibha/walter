/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type OrbState = "idle" | "listening" | "thinking";

function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");

  type SpeechRecognitionCtor = new () => {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: null | (() => void);
    onend: null | (() => void);
    onerror: null | (() => void);
    onresult: null | ((event: unknown) => void);
    start: () => void;
    stop: () => void;
  };

  const recognitionRef = useRef<null | InstanceType<SpeechRecognitionCtor>>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | SpeechRecognitionCtor
      | undefined;
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event: unknown) => {
      const e = event as {
        resultIndex?: number;
        results?: ArrayLike<{
          isFinal?: boolean;
          0?: { transcript?: string };
        }>;
      };
      let interim = "";
      let fin = "";
      const startIndex = typeof e.resultIndex === "number" ? e.resultIndex : 0;
      const results = e.results;
      const len = results?.length ?? 0;
      for (let i = startIndex; i < len; i++) {
        const res = results?.[i];
        const text = res?.[0]?.transcript ?? "";
        if (res.isFinal) fin += text;
        else interim += text;
      }
      if (interim) setPartial(interim.trim());
      if (fin) setFinalText((prev) => `${prev} ${fin}`.trim());
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
    };
  }, []);

  const start = () => {
    setFinalText("");
    setPartial("");
    try {
      recognitionRef.current?.start?.();
    } catch {}
  };
  const stop = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  };

  return { supported, listening, partial, finalText, start, stop };
}

function Orb({
  state,
  energy,
}: {
  state: OrbState;
  energy: number; // 0..1
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const accent = useMemo(() => {
    if (state === "thinking") return "rgba(176, 141, 58, 0.95)";
    if (state === "listening") return "rgba(176, 141, 58, 0.65)";
    return "rgba(20, 19, 18, 0.22)";
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      const t = (now - t0) / 1000;
      const baseR = Math.min(w, h) * 0.22;
      const breathe = 1 + 0.07 * Math.sin(t * 1.5);
      const pulse = state === "listening" ? 1 + 0.12 * energy : 1;
      const R = baseR * breathe * pulse;

      ctx.clearRect(0, 0, w, h);

      // faint halo
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.05, 0, Math.PI * 2);
      const g0 = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.05);
      g0.addColorStop(0, "rgba(176, 141, 58, 0.12)");
      g0.addColorStop(1, "rgba(176, 141, 58, 0)");
      ctx.fillStyle = g0;
      ctx.fill();

      // core orb
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(
        cx - R * 0.35,
        cy - R * 0.35,
        R * 0.2,
        cx,
        cy,
        R
      );
      g.addColorStop(0, "rgba(251, 250, 247, 0.92)");
      g.addColorStop(0.35, "rgba(244, 241, 234, 0.72)");
      g.addColorStop(0.7, accent);
      g.addColorStop(1, "rgba(20, 19, 18, 0.18)");
      ctx.fillStyle = g;
      ctx.fill();

      // inner ring
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(20, 19, 18, 0.16)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      // small shimmer
      const shimmer = 0.5 + 0.5 * Math.sin(t * 2.3);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + shimmer * 0.07})`;
      ctx.beginPath();
      ctx.arc(cx - R * 0.28, cy - R * 0.22, R * 0.32, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [accent, energy, state]);

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[380px] items-center justify-center">
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-[999px]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 rounded-[999px] shadow-[0_40px_120px_var(--shadow)]" />
    </div>
  );
}

async function startMicEnergyMeter(
  onValue: (v: number) => void
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const ctx = new AudioCtx();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    analyser.getByteTimeDomainData(data);
    // RMS around midpoint 128.
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) {
      const x = (data[i] - 128) / 128;
      sumSq += x * x;
    }
    const rms = Math.sqrt(sumSq / data.length);
    onValue(Math.max(0, Math.min(1, rms * 2.6)));
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelled = true;
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      ctx.close();
    } catch {}
  };
}

export default function OnboardingPage() {
  const [text, setText] = useState("");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [energy, setEnergy] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopEnergyRef = useRef<null | (() => void)>(null);

  const speech = useSpeechRecognition();

  useEffect(() => {
    if (speech.listening) setOrbState("listening");
    else setOrbState("idle");
  }, [speech.listening]);

  useEffect(() => {
    const combined = `${speech.finalText} ${speech.partial}`.trim();
    if (combined) setText(combined);
  }, [speech.finalText, speech.partial]);

  const startListening = async () => {
    speech.start();
    try {
      if (stopEnergyRef.current) stopEnergyRef.current();
      const stop = await startMicEnergyMeter((v) => {
        // slight smoothing so it feels alive, not jittery
        setEnergy((prev) => Math.max(prev * 0.6, v));
      });
      stopEnergyRef.current = stop;
    } catch {
      // mic denied: orb still works, just no energy
    }
  };

  const stopListening = () => {
    speech.stop();
    if (stopEnergyRef.current) {
      stopEnergyRef.current();
      stopEnergyRef.current = null;
    }
    setEnergy(0);
  };

  // Gentle decay so the orb doesn't "stick" at the last peak.
  useEffect(() => {
    if (!speech.listening) return;

    let raf = 0;
    const tick = () => {
      setEnergy((e) => Math.max(0, Math.min(1, e * 0.92)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speech.listening]);

  const canUseVoice = speech.supported;
  const listening = speech.listening;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/preferences/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Request failed (${res.status})`);
      }
      window.location.href = "/home";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] tracking-[0.22em] text-[color:var(--muted)]"
          >
            WALTER
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="text-[13px] text-[color:var(--muted)] underline decoration-[color:var(--hairline)] underline-offset-4 hover:text-[color:var(--ink2)]"
            >
              Skip
            </Link>
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="text-4xl tracking-[-0.03em] sm:text-5xl">
              What do you want to stay informed about?
            </h1>
            <p className="mt-3 max-w-[56ch] text-[15px] leading-7 text-[color:var(--muted)]">
              Speak naturally or type. We’ll translate your words into topics,
              regions, and priorities.
            </p>

            <div className="mt-7 space-y-3">
              <div className="rounded-2xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_60%,transparent)] p-4">
                <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                  TRY SOMETHING LIKE
                </div>
                <div className="mt-3 grid gap-2 text-[14px] leading-6 text-[color:var(--ink2)]">
                  <div>“Climate policy — especially what Congress is doing.”</div>
                  <div>
                    “Tech regulation, antitrust, and AI safety. U.S. + EU.”
                  </div>
                  <div>“What’s happening in my state around housing.”</div>
                </div>
              </div>

              <label className="block">
                <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
                  YOUR INTERESTS
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-2xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_55%,transparent)] px-4 py-3 text-[15px] leading-7 outline-none focus:border-[color:color-mix(in_oklab,var(--gold)_55%,var(--hairline))]"
                  placeholder="Type here if you’d rather not use the mic…"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={!canUseVoice}
                  onClick={listening ? stopListening : startListening}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--ink)] px-5 py-3 text-[14px] tracking-wide text-[color:var(--paper)] shadow-[0_18px_50px_var(--shadow)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {canUseVoice
                    ? listening
                      ? "Stop listening"
                      : "Press to talk"
                    : "Voice not supported"}
                </button>

                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--hairline)] px-5 py-3 text-[14px] tracking-wide text-[color:var(--ink2)] transition hover:border-[color:color-mix(in_oklab,var(--gold)_40%,var(--hairline))]"
                >
                  {saving ? "Saving…" : "Continue"}
                </Link>
              </div>
              {error ? (
                <div className="text-[13px] leading-6 text-[color:var(--muted)]">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:color-mix(in_oklab,var(--paper2)_70%,transparent)] p-6 shadow-[0_30px_80px_var(--shadow)]">
            <div className="text-[12px] tracking-[0.22em] text-[color:var(--muted)]">
              LISTEN
            </div>
            <div className="mt-4">
              <Orb state={orbState} energy={energy} />
            </div>
            <div className="mt-6 text-[13px] leading-6 text-[color:var(--muted)]">
              {orbState === "listening"
                ? "I’m listening. Keep going—rough notes are fine."
                : "Tap “Press to talk” when you’re ready."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

